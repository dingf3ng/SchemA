import { RuntimeTypedBinder } from './runtime/values';
import { Environment } from './runtime/environment';
import { Predicate } from './runtime/values';
import { SchemaArray, SchemaSet, SchemaMap, Graph } from './runtime/data-structures';

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
  // For frozen predicate: cache array elements
  arrayElements?: Map<number, any>;
  // For frozen predicate: cache primitive value for comparison
  frozenValue?: any;
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
      snapshot.frozenValue = value.value as number;
    } else if (type === 'string' || type === 'boolean') {
      snapshot.frozenValue = value.value;
    } else if (type === 'array' && value.value instanceof SchemaArray) {
      snapshot.arrayLength = (value.value as SchemaArray<RuntimeTypedBinder>).length;
      // Cache array elements for frozen checking
      const arr = value.value as SchemaArray<RuntimeTypedBinder>;
      const elements = new Map<number, any>();
      for (let i = 0; i < arr.length; i++) {
        const elem = arr.get(i);
        if (elem) {
          // Store primitive value or serialized form
          const elemType = elem.type.static.kind;
          if (elemType === 'int' || elemType === 'float' || elemType === 'string' || elemType === 'boolean') {
            elements.set(i, elem.value);
          } else {
            // For complex types, store reference (not ideal but necessary)
            elements.set(i, elem);
          }
        }
      }
      snapshot.arrayElements = elements;
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
   */
  public check(predicate: Predicate, value: RuntimeTypedBinder): boolean {
    const history = new VariableHistory();
    history.addSnapshot(value, 0);
    const snapshots = history.getSnapshots();

    if (predicate.kind === 'monotonic') {
      return this.checkMonotonicPredicate(predicate, snapshots);
    } else if (predicate.kind === 'size_monotonic') {
      return this.checkSizeMonotonicPredicate(predicate, snapshots);
    } else if (predicate.kind === 'frozen') {
      return this.checkFrozenPredicate(predicate, snapshots);
    } else if (predicate.kind === 'range_satisfies') {
      return this.checkRangeSatisfiesPredicate(predicate, snapshots);
    } else if (predicate.kind === 'partitioned_at' || predicate.kind === 'partitioned_by_value') {
      return this.holdsForAllSnapshots(predicate, snapshots);
    } else {
      return this.checkPredicate(predicate, snapshots[0]);
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
      } else if (candidate.kind === 'frozen') {
        holds = this.checkFrozenPredicate(candidate, snapshots);
      } else if (candidate.kind === 'range_satisfies') {
        holds = this.checkRangeSatisfiesPredicate(candidate, snapshots);
      } else if (candidate.kind === 'partitioned_at' || candidate.kind === 'partitioned_by_value') {
        holds = this.holdsForAllSnapshots(candidate, snapshots);
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
    } else if (type === 'string' || type === 'boolean') {
      // For strings and booleans, we can only check if they're frozen
      if (snapshots.length > 1) {
        candidates.push({ kind: 'frozen' });
      }
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

      // Frozen: value never changes
      candidates.push({ kind: 'frozen' });
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

    // Partitioning properties (for quicksort verification)
    // We'll generate these based on observed pivot positions
    const firstArr = snapshots[0].value.value;
    if (firstArr instanceof SchemaArray && firstArr.length > 0) {
      for (let i = 0; i < Math.min(firstArr.length, 5); i++) {
        const pivotElem = firstArr.get(i);
        if (pivotElem && typeof pivotElem.value === 'number') {
          candidates.push({ kind: 'partitioned_at', pivotIndex: i });
          candidates.push({ kind: 'partitioned_by_value', pivotValue: pivotElem.value });
        }
      }
    }

    // Monotonic size (growing/shrinking arrays)
    if (snapshots.length > 1) {
      candidates.push({ kind: 'size_monotonic', direction: 'increasing', strict: true });
      candidates.push({ kind: 'size_monotonic', direction: 'increasing', strict: false });
      candidates.push({ kind: 'size_monotonic', direction: 'decreasing', strict: true });
      candidates.push({ kind: 'size_monotonic', direction: 'decreasing', strict: false });

      // Frozen: array elements never change
      candidates.push({ kind: 'frozen' });
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

      // Collection size predicates
      case 'size_range':
      case 'size_equals':
      case 'non_empty': {
        let size = 0;
        if (type === 'array' && value instanceof SchemaArray) {
          size = value.length;
        } else if (typeof value === 'object' && value !== null && 'size' in value) {
          size = (value as any).size;
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

          const key = this.getElementKey(elem);
          if (seen.has(key)) return false;
          seen.add(key);
        }
        return true;
      }

      // Partitioning predicates
      case 'partitioned_at': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        const pivotIndex = predicate.pivotIndex;

        if (pivotIndex >= arr.length) return false;

        const pivot = arr.get(pivotIndex);
        if (!pivot || typeof pivot.value !== 'number') return false;
        const pivotValue = pivot.value;

        // Check all elements before pivot are <= pivotValue
        for (let i = 0; i < pivotIndex; i++) {
          const elem = arr.get(i);
          if (!elem || typeof elem.value !== 'number') return false;
          if (elem.value > pivotValue) return false;
        }

        // Check all elements after pivot are >= pivotValue
        for (let i = pivotIndex + 1; i < arr.length; i++) {
          const elem = arr.get(i);
          if (!elem || typeof elem.value !== 'number') return false;
          if (elem.value < pivotValue) return false;
        }

        return true;
      }

      case 'partitioned_by_value': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        const pivotValue = predicate.pivotValue;

        let foundPivot = false;
        let pivotIndex = -1;

        // Find the pivot
        for (let i = 0; i < arr.length; i++) {
          const elem = arr.get(i);
          if (elem && typeof elem.value === 'number' && elem.value === pivotValue) {
            foundPivot = true;
            pivotIndex = i;
            break;
          }
        }

        if (!foundPivot) return false;

        // Check partitioning
        for (let i = 0; i < pivotIndex; i++) {
          const elem = arr.get(i);
          if (!elem || typeof elem.value !== 'number') return false;
          if (elem.value > pivotValue) return false;
        }

        for (let i = pivotIndex + 1; i < arr.length; i++) {
          const elem = arr.get(i);
          if (!elem || typeof elem.value !== 'number') return false;
          if (elem.value < pivotValue) return false;
        }

        return true;
      }

      // Meta predicates
      case 'range_satisfies': {
        if (type !== 'array' || !(value instanceof SchemaArray)) return false;
        const arr = value as SchemaArray<RuntimeTypedBinder>;
        const { from, to, predicate: nestedPredicate } = predicate;

        // Check range bounds
        if (from < 0 || to > arr.length || from > to) return false;

        // For nested predicates that need historical context (like frozen),
        // we cannot check them here in single-snapshot mode
        // Return true and let the special handler deal with it
        if (nestedPredicate.kind === 'frozen' || nestedPredicate.kind === 'monotonic' || nestedPredicate.kind === 'size_monotonic') {
          return true; // Handled separately
        }

        // Check that all elements in range [from, to) satisfy the nested predicate
        for (let i = from; i < to; i++) {
          const elem = arr.get(i);
          if (!elem) return false;

          // Recursively check the nested predicate on the element
          if (!this.checkPredicate(nestedPredicate, snapshot)) {
            return false;
          }
        }
        return true;
      }

      // Graph predicates
      case 'no_negative_cycles': {
        if (type !== 'graph') return false;
        const graph = value as any; // Graph<RuntimeTypedBinder>
        if (!graph || typeof graph.getEdges !== 'function') return false;

        // Use Bellman-Ford algorithm to detect negative cycles
        const vertices = graph.getVertices();
        const edges = graph.getEdges();

        if (vertices.length === 0) return true;

        // Initialize distances
        const dist = new Map<any, number>();
        for (const v of vertices) {
          const key = this.getElementKey(v);
          dist.set(key, Infinity);
        }
        const startKey = this.getElementKey(vertices[0]);
        dist.set(startKey, 0);

        // Relax edges V-1 times
        for (let i = 0; i < vertices.length - 1; i++) {
          for (const edge of edges) {
            const fromKey = this.getElementKey(edge.from);
            const toKey = this.getElementKey(edge.to);
            const fromDist = dist.get(fromKey) ?? Infinity;
            const toDist = dist.get(toKey) ?? Infinity;

            if (fromDist !== Infinity && fromDist + edge.weight < toDist) {
              dist.set(toKey, fromDist + edge.weight);
            }
          }
        }

        // Check for negative cycles
        for (const edge of edges) {
          const fromKey = this.getElementKey(edge.from);
          const toKey = this.getElementKey(edge.to);
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
        const graph = value as any; // Graph<RuntimeTypedBinder>
        if (!graph || typeof graph.getEdges !== 'function') return false;

        const edges = graph.getEdges();
        for (const edge of edges) {
          if (edge.weight < 0) return false;
        }
        return true;
      }

      // Distance/Map predicates
      case 'distance_to_self_zero': {
        if (type !== 'map') return false;
        const map = value as any; // SchemaMap or Map

        // Check if this is a distance map where dist[v] should have v->0
        // This works if the map has entries for each vertex
        const entries = (typeof map.entries === 'function') ? map.entries() : [];

        for (const [key, val] of entries) {
          // If key is a RuntimeTypedBinder, extract its value
          const keyValue = (key as any).value !== undefined ? (key as any).value : key;
          const distance = (val as any).value !== undefined ? (val as any).value : val;

          // Check if key maps to itself with distance 0
          if (typeof distance === 'object' && distance !== null) {
            // This might be a nested map structure like dist[u][v]
            const selfDist = (typeof distance.get === 'function') ? distance.get(keyValue) : undefined;
            if (selfDist !== undefined && selfDist !== 0) return false;
          }
        }
        return true;
      }

      case 'triangle_inequality': {
        if (type !== 'map') return false;
        const map = value as any; // SchemaMap representing distances

        // For a distance map dist[u][v], triangle inequality: dist[u][v] <= dist[u][k] + dist[k][v]
        const entries = (typeof map.entries === 'function') ? map.entries() : [];
        const vertices = new Set<any>();

        // Collect all vertices and build distance lookup
        const distMap = new Map<any, Map<any, number>>();
        for (const [key, val] of entries) {
          const u = (key as any).value !== undefined ? (key as any).value : key;
          vertices.add(u);

          if (typeof val === 'object' && val !== null && typeof val.entries === 'function') {
            const innerMap = new Map<any, number>();
            for (const [k2, v2] of val.entries()) {
              const v = (k2 as any).value !== undefined ? (k2 as any).value : k2;
              const dist = (v2 as any).value !== undefined ? (v2 as any).value : v2;
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
        const thisSet = value as any; // SchemaSet
        const otherSet = predicate.superset;

        if (!thisSet || typeof thisSet.toArray !== 'function') return false;
        if (!otherSet || typeof otherSet.has !== 'function') return false;

        // Check if all elements in this set are in the superset
        const elements = thisSet.toArray();
        for (const elem of elements) {
          if (!otherSet.has(elem)) return false;
        }
        return true;
      }

      case 'disjoint_from': {
        if (type !== 'set') return false;
        const thisSet = value as any; // SchemaSet
        const otherSet = predicate.other;

        if (!thisSet || typeof thisSet.toArray !== 'function') return false;
        if (!otherSet || typeof otherSet.has !== 'function') return false;

        // Check if no elements in this set are in the other set
        const elements = thisSet.toArray();
        for (const elem of elements) {
          if (otherSet.has(elem)) return false;
        }
        return true;
      }

      // Immutability
      case 'frozen':
        // Handled separately via checkFrozenPredicate which has access to historical snapshots
        return true;

      // Predicates that require full history context
      case 'monotonic':
        // Handled separately
        return true;

      case 'size_monotonic':
        // Handled separately
        return true;

      default:
        return true; // Default to true for unimplemented predicates
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

      const currValue = this.getSizeValue(curr.value);
      const nextValue = this.getSizeValue(next.value);

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

  /**
   * Special check for range_satisfies predicates with nested temporal predicates
   * Handles cases like range_satisfies(0, i, frozen)
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

      // For frozen nested predicate, check that elements in range don't change across snapshots
      if (nestedPredicate.kind === 'frozen') {
        // We need to check this across ALL snapshots
        return this.checkRangeFrozen(from, to, snapshots);
      }

      // For other predicates, check normally
      for (let i = from; i < to; i++) {
        const elem = arr.get(i);
        if (!elem) return false;
        if (!this.checkPredicate(nestedPredicate, snapshot)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if elements in a specific range remain frozen across all snapshots
   */
  private checkRangeFrozen(from: number, to: number, snapshots: VariableSnapshot[]): boolean {
    if (snapshots.length < 2) return true;

    // For each index in the range, check if it stays the same across all snapshots
    for (let index = from; index < to; index++) {
      const firstElements = snapshots[0].arrayElements;
      if (!firstElements || !firstElements.has(index)) return false;

      const firstValue = firstElements.get(index);

      // Check this index in all subsequent snapshots
      for (let i = 1; i < snapshots.length; i++) {
        const currentElements = snapshots[i].arrayElements;
        if (!currentElements || !currentElements.has(index)) return false;

        const currentValue = currentElements.get(index);
        if (firstValue !== currentValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Special check for frozen predicates across snapshots
   * Verifies that a value (or array elements) never changes across iterations
   */
  private checkFrozenPredicate(
    _predicate: { kind: 'frozen' },
    snapshots: VariableSnapshot[]
  ): boolean {
    if (snapshots.length < 2) return true;

    const firstSnapshot = snapshots[0];
    const type = firstSnapshot.value.type.static.kind;

    // For primitives: check if value never changes
    if (type === 'int' || type === 'float' || type === 'string' || type === 'boolean') {
      const firstValue = firstSnapshot.frozenValue;
      for (let i = 1; i < snapshots.length; i++) {
        const currentValue = snapshots[i].frozenValue;
        if (firstValue !== currentValue) {
          return false;
        }
      }
      return true;
    }

    // For arrays: check if ALL elements never change
    if (type === 'array') {
      const firstElements = firstSnapshot.arrayElements;
      if (!firstElements) return false;

      // Check each subsequent snapshot
      for (let i = 1; i < snapshots.length; i++) {
        const currentElements = snapshots[i].arrayElements;
        if (!currentElements) return false;

        // If array length changed, it's not frozen
        if (firstElements.size !== currentElements.size) {
          return false;
        }

        // Check each element remains the same
        for (const [index, firstValue] of firstElements.entries()) {
          const currentValue = currentElements.get(index);
          if (firstValue !== currentValue) {
            return false;
          }
        }
      }
      return true;
    }

    // For other types, we can't reliably check frozen property
    return false;
  }

  /**
   * Extract size value from RuntimeTypedBinder (for collections)
   */
  private getSizeValue(binder: RuntimeTypedBinder): number | null {
    const type = binder.type.static.kind;
    const value = binder.value;

    if (type === 'array' && value instanceof SchemaArray) {
      return value.length;
    } else if (typeof value === 'object' && value !== null && 'size' in value) {
      return (value as any).size;
    }

    return null;
  }

  /**
   * Get a hashable key for an element (for uniqueness checking)
   */
  private getElementKey(elem: RuntimeTypedBinder): any {
    const type = elem.type.static.kind;
    if (type === 'int' || type === 'float' || type === 'string' || type === 'boolean') {
      return elem.value;
    }
    return elem; // For complex types, use object identity
  }
}
