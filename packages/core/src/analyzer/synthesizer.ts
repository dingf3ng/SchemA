import { RuntimeTypedBinder } from '../runtime/runtime-utils';
import { Environment } from '../runtime/environment';
import { Predicate, getElementKey } from './analyzer-utils';
import { SchemaArray, SchemaMap, SchemaSet, Graph } from '../builtins/data-structures';

/**
 * State snapshot for a single variable at a specific iteration
 * Stores primitive/immutable data extracted from the value to avoid mutable reference issues
 */
interface VariableSnapshot {
  value: RuntimeTypedBinder;
  iteration: number;
  // Cached immutable data
  numericValue?: number;
  arrayLength?: number;
  collectionSize?: number;
}

/**
 * Tracks variable evolution across loop iterations
 */
class VariableHistory {
  private snapshots: VariableSnapshot[] = [];

  addSnapshot(value: RuntimeTypedBinder, iteration: number): void {
    // Extract immutable data at snapshot time to avoid reference issues
    const snapshot: VariableSnapshot = { value, iteration };

    const type = value.type.static.kind;
    if (type === 'int' || type === 'float') {
      snapshot.numericValue = value.value as number;
    } else if (type === 'array' && value.value instanceof SchemaArray) {
      snapshot.arrayLength = (value.value as SchemaArray<RuntimeTypedBinder>).length;
    } else if (typeof value.value === 'object' && value.value !== null && 'size' in value.value) {
      snapshot.collectionSize = (value.value as any).size;
    }

    this.snapshots.push(snapshot);
  }

  getSnapshots(): VariableSnapshot[] {
    return this.snapshots;
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }
}

/**
 * InvariantTracker - Tracks runtime state across loop iterations for invariant synthesis
 * Based on the Houdini algorithm for invariant inference
 */
export class InvariantTracker {
  private histories: Map<string, VariableHistory> = new Map();
  private variableNames: Set<string> = new Set();

  /**
   * Record the state of all variables in the environment at the current iteration
   */
  recordState(env: Environment, iteration: number): void {
    const allBindings = env.getAllBindings();

    for (const [name, value] of allBindings) {
      // Skip underscore and function bindings
      if (name === '_' || value.type.static.kind === 'function') {
        continue;
      }

      this.variableNames.add(name);

      if (!this.histories.has(name)) {
        this.histories.set(name, new VariableHistory());
      }

      this.histories.get(name)!.addSnapshot(value, iteration);
    }
  }

  /**
   * Check if a predicate holds for a given value
   *
   * This method routes predicates to the appropriate checker:
   * - Temporal predicates (require history): monotonic, size_monotonic
   * - Meta predicates with temporal components: range_satisfies
   * - Point-in-time predicates: all others (checked on latest snapshot)
   */
  public check(predicate: Predicate, value: RuntimeTypedBinder, variableName?: string): boolean {
    let snapshots: VariableSnapshot[];

    if (variableName && this.histories.has(variableName)) {
      snapshots = this.histories.get(variableName)!.getSnapshots();
    } else {
      const history = new VariableHistory();
      history.addSnapshot(value, 0);
      snapshots = history.getSnapshots();
    }

    // Route to appropriate checker based on predicate type
    if (this.isTemporalPredicate(predicate)) {
      // Temporal predicates require full history
      return this.checkTemporalPredicate(predicate, snapshots);
    } else {
      // Point-in-time predicates only check current state
      return this.checkPredicate(predicate, snapshots[snapshots.length - 1]);
    }
  }

  /**
   * Determine if a predicate is temporal (requires history)
   */
  private isTemporalPredicate(predicate: Predicate): boolean {
    return predicate.kind === 'monotonic' ||
           predicate.kind === 'size_monotonic';
  }

  /**
   * Check temporal predicates that require full snapshot history
   */
  private checkTemporalPredicate(predicate: Predicate, snapshots: VariableSnapshot[]): boolean {
    switch (predicate.kind) {
      case 'monotonic':
        return this.checkMonotonicPredicate(predicate, snapshots);
      case 'size_monotonic':
        return this.checkSizeMonotonicPredicate(predicate, snapshots);
      default:
        throw new Error(`Unknown temporal predicate: ${(predicate as any).kind}`);
    }
  }

  /**
   * Synthesize invariants using the Houdini algorithm
   * Returns a map of variable names to their inferred predicates
   */
  synthesize(): Map<string, Predicate[]> {
    const result = new Map<string, Predicate[]>();

    for (const varName of this.variableNames) {
      const history = this.histories.get(varName);
      if (!history || history.getSnapshotCount() === 0) {
        continue;
      }

      const predicates = this.synthesizeForVariable(varName, history);
      if (predicates.length > 0) {
        result.set(varName, predicates);
      }
    }

    return result;
  }

  /**
   * Synthesize predicates for a single variable using Houdini approach:
   * 1. Generate candidate predicates
   * 2. Eliminate those that are violated by any snapshot
   */
  private synthesizeForVariable(_varName: string, history: VariableHistory): Predicate[] {
    const snapshots = history.getSnapshots();
    if (snapshots.length === 0) return [];

    const firstSnapshot = snapshots[0];
    const type = firstSnapshot.value.type.static.kind;

    // Generate candidate predicates based on type
    const candidates = this.generateCandidates(snapshots, type);

    // Houdini filtering: keep only predicates that hold for ALL snapshots
    const validPredicates: Predicate[] = [];

    for (const candidate of candidates) {
      // Special handling for predicates that need full snapshot context
      let holds = false;
      if (candidate.kind === 'monotonic') {
        holds = this.checkMonotonicPredicate(candidate, snapshots);
      } else if (candidate.kind === 'size_monotonic') {
        holds = this.checkSizeMonotonicPredicate(candidate, snapshots);
      } else if (candidate.kind === 'range_satisfies') {
        holds = this.checkRangeSatisfiesPredicate(candidate, snapshots);
      } else if (candidate.kind === 'all_elements_satisfy') {
        holds = this.checkAllElementsSatisfy(candidate, snapshots);
      } else {
        holds = this.holdsForAllSnapshots(candidate, snapshots);
      }

      if (holds) {
        validPredicates.push(candidate);
      }
    }

    return validPredicates;
  }

  /**
   * Generate candidate predicates based on observed values
   * This is the initial hypothesis generation phase of Houdini
   */
  private generateCandidates(snapshots: VariableSnapshot[], type: string): Predicate[] {
    const candidates: Predicate[] = [];

    if (type === 'int' || type === 'float') {
      candidates.push(...this.generateNumericCandidates(snapshots));
    } else if (type === 'array') {
      candidates.push(...this.generateArrayCandidates(snapshots));
    } else if (type === 'set' || type === 'map') {
      candidates.push(...this.generateCollectionCandidates(snapshots));
    } 
    return candidates;
  }

  /**
   * Generate numeric predicate candidates
   */
  private generateNumericCandidates(snapshots: VariableSnapshot[]): Predicate[] {
    const candidates: Predicate[] = [];
    const values = snapshots.map(s => s.numericValue ?? (s.value.value as number));

    // Range candidates - use iterative approach to avoid stack overflow with large arrays
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (min !== Infinity && max !== -Infinity) {
      candidates.push({ kind: 'int_range', min, max });
    }

    // Positive/negative candidates
    candidates.push({ kind: 'positive', strict: true });   // > 0
    candidates.push({ kind: 'positive', strict: false });  // >= 0
    candidates.push({ kind: 'negative', strict: true });   // < 0
    candidates.push({ kind: 'negative', strict: false });  // <= 0

    // Parity candidates
    candidates.push({ kind: 'parity', value: 'even' });
    candidates.push({ kind: 'parity', value: 'odd' });

    // Divisibility candidates (check common divisors)
    for (const divisor of [2, 3, 4, 5, 10]) {
      candidates.push({ kind: 'divisible_by', divisor });
    }

    // Monotonic value (increasing/decreasing over time)
    if (snapshots.length > 1) {
      candidates.push({ kind: 'monotonic', direction: 'increasing', strict: true });
      candidates.push({ kind: 'monotonic', direction: 'increasing', strict: false });
      candidates.push({ kind: 'monotonic', direction: 'decreasing', strict: true });
      candidates.push({ kind: 'monotonic', direction: 'decreasing', strict: false });
    }

    return candidates;
  }

  /**
   * Generate array predicate candidates
   */
  private generateArrayCandidates(snapshots: VariableSnapshot[]): Predicate[] {
    const candidates: Predicate[] = [];

    // Size constraints - use cached array length with iterative approach
    const sizes = snapshots.map(s => s.arrayLength ?? 0);
    let minSize = Infinity;
    let maxSize = -Infinity;
    for (const size of sizes) {
      if (size < minSize) minSize = size;
      if (size > maxSize) maxSize = size;
    }

    if (minSize === maxSize) {
      candidates.push({ kind: 'size_equals', size: minSize });
    } else {
      candidates.push({ kind: 'size_range', min: minSize, max: maxSize });
    }

    // Non-empty
    candidates.push({ kind: 'non_empty' });

    // Structural properties
    candidates.push({ kind: 'sorted', order: 'asc' });
    candidates.push({ kind: 'sorted', order: 'desc' });
    candidates.push({ kind: 'unique_elements' });

    // Monotonic size (growing/shrinking arrays)
    if (snapshots.length > 1) {
      candidates.push({ kind: 'size_monotonic', direction: 'increasing', strict: true });
      candidates.push({ kind: 'size_monotonic', direction: 'increasing', strict: false });
      candidates.push({ kind: 'size_monotonic', direction: 'decreasing', strict: true });
      candidates.push({ kind: 'size_monotonic', direction: 'decreasing', strict: false });
    }

    return candidates;
  }

  /**
   * Generate collection (Set/Map) predicate candidates
   */
  private generateCollectionCandidates(snapshots: VariableSnapshot[]): Predicate[] {
    const candidates: Predicate[] = [];

    // Size constraints - use cached collection size with iterative approach
    const sizes = snapshots.map(s => s.collectionSize ?? 0);

    let minSize = Infinity;
    let maxSize = -Infinity;
    for (const size of sizes) {
      if (size < minSize) minSize = size;
      if (size > maxSize) maxSize = size;
    }

    if (minSize === maxSize) {
      candidates.push({ kind: 'size_equals', size: minSize });
    } else {
      candidates.push({ kind: 'size_range', min: minSize, max: maxSize });
    }

    candidates.push({ kind: 'non_empty' });

    // Monotonic size
    if (snapshots.length > 1) {
      candidates.push({ kind: 'size_monotonic', direction: 'increasing', strict: true });
      candidates.push({ kind: 'size_monotonic', direction: 'increasing', strict: false });
      candidates.push({ kind: 'size_monotonic', direction: 'decreasing', strict: true });
      candidates.push({ kind: 'size_monotonic', direction: 'decreasing', strict: false });
    }

    return candidates;
  }

  /**
   * Check if a predicate holds for all snapshots (Houdini verification)
   */
  private holdsForAllSnapshots(predicate: Predicate, snapshots: VariableSnapshot[]): boolean {
    for (const snapshot of snapshots) {
      if (!this.checkPredicate(predicate, snapshot)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a specific predicate holds for a single snapshot
   */
  private checkPredicate(predicate: Predicate, snapshot: VariableSnapshot): boolean {
    const value = snapshot.value.value;
    const type = snapshot.value.type.static.kind;

    switch (predicate.kind) {
      // Numeric predicates
      case 'int_range':
        if (type === 'int' || type === 'float') {
          const num = value as number;
          return num >= predicate.min && num <= predicate.max;
        }
        return false;

      case 'positive':
        if (type === 'int' || type === 'float') {
          const num = value as number;
          return predicate.strict ? num > 0 : num >= 0;
        }
        return false;

      case 'negative':
        if (type === 'int' || type === 'float') {
          const num = value as number;
          return predicate.strict ? num < 0 : num <= 0;
        }
        return false;

      case 'divisible_by':
        if (type === 'int') {
          const num = value as number;
          return num % predicate.divisor === 0;
        }
        return false;

      case 'parity':
        if (type === 'int') {
          const num = value as number;
          const isEven = num % 2 === 0;
          return predicate.value === 'even' ? isEven : !isEven;
        }
        return false;

      case 'greater_than':
        if (type === 'int' || type === 'float') {
          const num = value as number;
          return num > predicate.threshold;
        }
        return false;

      case 'greater_equal_than':
        if (type === 'int' || type === 'float') {
          const num = value as number;
          return num >= predicate.threshold;
        }
        return false;

      // Collection size predicates
      case 'size_range':
      case 'size_equals':
      case 'non_empty': {
        let size = 0;
        if (type === 'array' && value instanceof SchemaArray) {
          size = value.length;
        } else if (value instanceof SchemaMap) {
          size = value.size;
        } else if (value instanceof SchemaSet) {
          size = value.size;
        } else {
          return false;
        }

        if (predicate.kind === 'size_range') {
          return size >= predicate.min && size <= predicate.max;
        } else if (predicate.kind === 'size_equals') {
          return size === predicate.size;
        } else { // non_empty
          return size > 0;
        }
      }

      // Structural predicates
      case 'sorted': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        if (arr.length <= 1) return true;

        for (let i = 0; i < arr.length - 1; i++) {
          const curr = arr.get(i);
          const next = arr.get(i + 1);
          if (!curr || !next) return false;

          const currVal = curr.value;
          const nextVal = next.value;

          if (typeof currVal !== 'number' || typeof nextVal !== 'number') {
            return false;
          }

          if (predicate.order === 'asc' && currVal > nextVal) return false;
          if (predicate.order === 'desc' && currVal < nextVal) return false;
        }
        return true;
      }

      case 'unique_elements': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        const seen = new Set<any>();

        for (let i = 0; i < arr.length; i++) {
          const elem = arr.get(i);
          if (!elem) continue;

          const key = getElementKey(elem);
          if (seen.has(key)) return false;
          seen.add(key);
        }
        return true;
      }

      // Logical predicates
      case 'not':
        return !this.checkPredicate(predicate.predicate, snapshot);

      // Meta predicates
      case 'range_satisfies': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        const { from, to, predicate: nestedPredicate } = predicate;

        // Check range bounds
        if (from < 0 || to > arr.length || from > to) return false;

        // For nested predicates that need historical context,
        // we cannot check them here in single-snapshot mode
        // Return true and let the special handler deal with it
        if (nestedPredicate.kind === 'monotonic' || nestedPredicate.kind === 'size_monotonic') {
          return true; // Handled separately
        }

        // Check that all elements in range [from, to) satisfy the nested predicate
        for (let i = from; i < to; i++) {
          const elem = arr.get(i);
          if (!elem) return false;

          // Create a snapshot for the element to check the nested predicate
          const elemSnapshot: VariableSnapshot = {
            value: elem,
            iteration: snapshot.iteration,
            numericValue: (elem.type.static.kind === 'int' || elem.type.static.kind === 'float') ? elem.value as number : undefined,
            arrayLength: (elem.type.static.kind === 'array' && elem.value instanceof SchemaArray) ? (elem.value as SchemaArray<RuntimeTypedBinder>).length : undefined,
            collectionSize: (elem.value instanceof SchemaMap || elem.value instanceof SchemaSet) ? (elem.value as any).size : undefined
          };

          // Recursively check the nested predicate on the element
          if (!this.checkPredicate(nestedPredicate, elemSnapshot)) {
            return false;
          }
        }
        return true;
      }

      // Graph predicates
      case 'no_negative_cycles': {
        if (type !== 'graph') return false;

        // Type guard for Graph instance
        if (!(value instanceof Graph)) {
          throw new Error('Graph predicate expects Graph instance');
        }
        const graph = value as Graph<RuntimeTypedBinder>;

        // Use Bellman-Ford algorithm to detect negative cycles
        const vertices = graph.getVertices();
        const edges = graph.getEdges();

        // Validate edges have required weight property
        for (const edge of edges) {
          if (!edge || typeof edge.weight !== 'number') {
            throw new Error('Graph edges must have numeric weight property');
          }
          if (!edge.from || !edge.to) {
            throw new Error('Graph edges must have from and to properties');
          }
        }

        if (vertices.length === 0) return true;

        // Initialize distances
        const dist = new Map<any, number>();
        for (const v of vertices) {
          const key = getElementKey(v);
          dist.set(key, Infinity);
        }
        const startKey = getElementKey(vertices[0]);
        dist.set(startKey, 0);

        // Relax edges V-1 times
        for (let i = 0; i < vertices.length - 1; i++) {
          for (const edge of edges) {
            const fromKey = getElementKey(edge.from);
            const toKey = getElementKey(edge.to);
            const fromDist = dist.get(fromKey) ?? Infinity;
            const toDist = dist.get(toKey) ?? Infinity;

            if (fromDist !== Infinity && fromDist + edge.weight < toDist) {
              dist.set(toKey, fromDist + edge.weight);
            }
          }
        }

        // Check for negative cycles
        for (const edge of edges) {
          const fromKey = getElementKey(edge.from);
          const toKey = getElementKey(edge.to);
          const fromDist = dist.get(fromKey) ?? Infinity;
          const toDist = dist.get(toKey) ?? Infinity;

          if (fromDist !== Infinity && fromDist + edge.weight < toDist) {
            return false; // Negative cycle detected
          }
        }

        return true;
      }

      case 'all_weights_non_negative': {
        if (type !== 'graph') return false;

        // Type guard for Graph instance
        if (!(value instanceof Graph)) {
          throw new Error('Graph predicate expects Graph instance');
        }
        const graph = value as Graph<RuntimeTypedBinder>;

        const edges = graph.getEdges();
        for (const edge of edges) {
          if (!edge || typeof edge.weight !== 'number') {
            throw new Error('Graph edges must have numeric weight property');
          }
          if (edge.weight < 0) return false;
        }
        return true;
      }

      // Distance/Map predicates
      case 'distance_to_self_zero': {
        if (type !== 'map') return false;

        // Type guard for SchemaMap instance
        if (!(value instanceof SchemaMap)) {
          throw new Error('Map predicate expects SchemaMap instance');
        }
        const map = value as SchemaMap<any, any>;

        // Check if this is a distance map where dist[v] should have v->0
        // This works if the map has entries for each vertex
        const entries = map.entries();

        for (const [key, val] of entries) {
          // If key is a RuntimeTypedBinder, extract its value
          const keyValue = (key as RuntimeTypedBinder).value !== undefined ? (key as RuntimeTypedBinder).value : key;
          const distance = (val as RuntimeTypedBinder).value !== undefined ? (val as RuntimeTypedBinder).value : val;

          // Check if key maps to itself with distance 0
          if (typeof distance === 'object' && distance !== null) {
            // This might be a nested map structure like dist[u][v]
            const selfDist = (typeof (distance as any).get === 'function') ? (distance as any).get(keyValue) : undefined;
            if (selfDist !== undefined && selfDist !== 0) return false;
          }
        }
        return true;
      }

      case 'triangle_inequality': {
        if (type !== 'map') return false;

        // Type guard for SchemaMap instance
        if (!(value instanceof SchemaMap)) {
          throw new Error('Map predicate expects SchemaMap instance');
        }
        const map = value as SchemaMap<any, any>;

        // For a distance map dist[u][v], triangle inequality: dist[u][v] <= dist[u][k] + dist[k][v]
        const entries = map.entries();
        const vertices = new Set<any>();

        // Collect all vertices and build distance lookup
        const distMap = new Map<any, Map<any, number>>();
        for (const [key, val] of entries) {
          const u = (key as RuntimeTypedBinder).value !== undefined ? (key as RuntimeTypedBinder).value : key;
          vertices.add(u);

          if (typeof val === 'object' && val !== null && typeof (val as any).entries === 'function') {
            const innerMap = new Map<any, number>();
            for (const [k2, v2] of (val as any).entries()) {
              const v = (k2 as RuntimeTypedBinder).value !== undefined ? (k2 as RuntimeTypedBinder).value : k2;
              const dist = (v2 as RuntimeTypedBinder).value !== undefined ? (v2 as RuntimeTypedBinder).value : v2;
              vertices.add(v);
              innerMap.set(v, dist);
            }
            distMap.set(u, innerMap);
          }
        }

        // Check triangle inequality for all vertex triples
        const vertexArray = Array.from(vertices);
        for (const u of vertexArray) {
          for (const v of vertexArray) {
            const uMap = distMap.get(u);
            if (!uMap) continue;
            const distUV = uMap.get(v);
            if (distUV === undefined) continue;

            for (const k of vertexArray) {
              const distUK = uMap.get(k);
              const kMap = distMap.get(k);
              if (!kMap || distUK === undefined) continue;
              const distKV = kMap.get(v);
              if (distKV === undefined) continue;

              // Check: dist[u][v] <= dist[u][k] + dist[k][v]
              if (distUV > distUK + distKV) return false;
            }
          }
        }
        return true;
      }

      // Set predicates
      case 'subset_of': {
        if (type !== 'set') return false;

        // Type guard for SchemaSet instance
        if (!(value instanceof SchemaSet)) {
          throw new Error('Set predicate expects SchemaSet instance');
        }
        const thisSet = value as SchemaSet<RuntimeTypedBinder>;
        const otherSet = predicate.superset;

        // Check if all elements in this set are in the superset
        const elements = thisSet.toArray();
        for (const elem of elements) {
          if (!otherSet.has(elem)) return false;
        }
        return true;
      }

      case 'disjoint_from': {
        if (type !== 'set') return false;

        // Type guard for SchemaSet instance
        if (!(value instanceof SchemaSet)) {
          throw new Error('Set predicate expects SchemaSet instance');
        }
        const thisSet = value as SchemaSet<RuntimeTypedBinder>;
        const otherSet = predicate.other;

        // Check if no elements in this set are in the other set
        const elements = thisSet.toArray();
        for (const elem of elements) {
          if (otherSet.has(elem)) return false;
        }
        return true;
      }

      // Predicates that require full history context
      case 'monotonic':
        // Handled separately
        return true;

      case 'size_monotonic':
        // Handled separately
        return true;

      case 'is_permutation_of': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        const original = predicate.original;

        // Check if lengths match
        if (arr.length !== original.length) return false;

        // Count occurrences in both arrays
        const arrCounts = new Map<any, number>();
        const origCounts = new Map<any, number>();

        for (let i = 0; i < arr.length; i++) {
          const elem = arr.get(i);
          if (!elem) return false;
          const key = getElementKey(elem);
          arrCounts.set(key, (arrCounts.get(key) || 0) + 1);
        }

        for (let i = 0; i < original.length; i++) {
          const elem = original.get(i);
          if (!elem) return false;
          const key = getElementKey(elem);
          origCounts.set(key, (origCounts.get(key) || 0) + 1);
        }

        // Check if counts match
        if (arrCounts.size !== origCounts.size) return false;
        for (const [key, count] of arrCounts) {
          if (origCounts.get(key) !== count) return false;
        }

        return true;
      }

      case 'all_elements_satisfy': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;

        // Check if all elements satisfy the nested predicate
        for (let i = 0; i < arr.length; i++) {
          const elem = arr.get(i);
          if (!elem) return false;

          // Convert element to a snapshot for checking
          const elemSnapshot: VariableSnapshot = {
            value: elem,
            iteration: 0  // Not applicable for element checking
          };

          // Check the nested predicate on this element
          if (!this.checkPredicate(predicate.predicate, elemSnapshot)) {
            return false;
          }
        }
        return true;
      }

      // Unimplemented predicates - explicitly list them and throw errors
      case 'acyclic':
      case 'connected':
      case 'bipartite':
      case 'bst_property':
      case 'balanced':
      case 'complete_tree':
      case 'heap_property':
        throw new Error(`Predicate '${predicate.kind}' is not yet implemented in checkPredicate`);

      default: {
        const _exhaustive: never = predicate;
        throw new Error(`Unknown predicate kind in checkPredicate: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  /**
   * Special check for monotonic predicates across snapshots (for numeric values)
   */
  private checkMonotonicPredicate(
    predicate: { kind: 'monotonic'; direction: 'increasing' | 'decreasing'; strict: boolean },
    snapshots: VariableSnapshot[]
  ): boolean {
    if (snapshots.length < 2) return true;

    for (let i = 0; i < snapshots.length - 1; i++) {
      const curr = snapshots[i];
      const next = snapshots[i + 1];

      const currValue = curr.numericValue ?? (curr.value.value as number);
      const nextValue = next.numericValue ?? (next.value.value as number);

      if (typeof currValue !== 'number' || typeof nextValue !== 'number') return false;

      if (predicate.direction === 'increasing') {
        if (predicate.strict && currValue >= nextValue) return false;
        if (!predicate.strict && currValue > nextValue) return false;
      } else { // decreasing
        if (predicate.strict && currValue <= nextValue) return false;
        if (!predicate.strict && currValue < nextValue) return false;
      }
    }

    return true;
  }

  /**
   * Special check for size_monotonic predicates across snapshots
   */
  private checkSizeMonotonicPredicate(
    predicate: { kind: 'size_monotonic'; direction: 'increasing' | 'decreasing'; strict: boolean },
    snapshots: VariableSnapshot[]
  ): boolean {
    if (snapshots.length < 2) return true;

    for (let i = 0; i < snapshots.length - 1; i++) {
      const curr = snapshots[i];
      const next = snapshots[i + 1];

      // Use cached size values from snapshots to avoid mutable reference issues
      const currValue = curr.arrayLength ?? curr.collectionSize ?? null;
      const nextValue = next.arrayLength ?? next.collectionSize ?? null;

      if (currValue === null || nextValue === null) return false;

      if (predicate.direction === 'increasing') {
        if (predicate.strict && currValue >= nextValue) return false;
        if (!predicate.strict && currValue > nextValue) return false;
      } else { // decreasing
        if (predicate.strict && currValue <= nextValue) return false;
        if (!predicate.strict && currValue < nextValue) return false;
      }
    }

    return true;
  }

  private checkAllElementsSatisfy(
    predicate: { kind: 'all_elements_satisfy'; predicate: Predicate },
    snapshots: VariableSnapshot[]
  ): boolean {
    if (snapshots.length === 0) return true;

    for (const snapshot of snapshots) {
      const type = snapshot.value.type.static.kind;
      if (type !== 'array') return false;

      const arr = snapshot.value.value;
      if (!(arr instanceof SchemaArray)) return false;

      const { predicate: nestedPredicate } = predicate;

      for (let i = 0; i < arr.length; i++) {
        const elem = arr.get(i);
        if (!elem) return false;

        // Create a snapshot for the element to check the nested predicate
        const elemSnapshot: VariableSnapshot = {
          value: elem,
          iteration: snapshot.iteration,
          numericValue: (elem.type.static.kind === 'int' || elem.type.static.kind === 'float') ? elem.value as number : undefined,
          arrayLength: (elem.type.static.kind === 'array' && elem.value instanceof SchemaArray) ? (elem.value as SchemaArray<RuntimeTypedBinder>).length : undefined,
          collectionSize: (elem.value instanceof SchemaMap || elem.value instanceof SchemaSet) ? (elem.value as any).size : undefined
        };

        if (!this.checkPredicate(nestedPredicate, elemSnapshot)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Special check for range_satisfies predicates with nested temporal predicates
   * Handles cases like @range_satisfies(0, i, @positive)
   */
  private checkRangeSatisfiesPredicate(
    predicate: { kind: 'range_satisfies'; from: number; to: number; predicate: Predicate },
    snapshots: VariableSnapshot[]
  ): boolean {
    if (snapshots.length === 0) return true;

    // Check that all snapshots satisfy the range_satisfies predicate
    for (const snapshot of snapshots) {
      const type = snapshot.value.type.static.kind;
      if (type !== 'array') return false;

      const arr = snapshot.value.value;
      if (!(arr instanceof SchemaArray)) return false;

      const { from, to, predicate: nestedPredicate } = predicate;

      // Check range bounds
      if (from < 0 || to > arr.length || from > to) return false;

      // For other predicates, check normally
      for (let i = from; i < to; i++) {
        const elem = arr.get(i);
        if (!elem) return false;

        // Create a snapshot for the element to check the nested predicate
        const elemSnapshot: VariableSnapshot = {
          value: elem,
          iteration: snapshot.iteration,
          numericValue: (elem.type.static.kind === 'int' || elem.type.static.kind === 'float') ? elem.value as number : undefined,
          arrayLength: (elem.type.static.kind === 'array' && elem.value instanceof SchemaArray) ? (elem.value as SchemaArray<RuntimeTypedBinder>).length : undefined,
          collectionSize: (elem.value instanceof SchemaMap || elem.value instanceof SchemaSet) ? (elem.value as any).size : undefined
        };

        if (!this.checkPredicate(nestedPredicate, elemSnapshot)) {
          return false;
        }
      }
    }

    return true;
  }
}
