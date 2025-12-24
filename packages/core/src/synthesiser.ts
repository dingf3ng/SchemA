import { RuntimeTypedBinder } from './runtime/values';
import { Environment } from './runtime/environment';
import { Predicate } from './runtime/values';
import { SchemaArray } from './runtime/data-structures';

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
      // Special handling for monotonic predicates
      const holds = candidate.kind === 'monotonic'
        ? this.checkMonotonicPredicate(candidate, snapshots)
        : this.holdsForAllSnapshots(candidate, snapshots);

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

    // Monotonicity candidates (based on iteration order)
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
      candidates.push({ kind: 'monotonic', direction: 'increasing', strict: true });
      candidates.push({ kind: 'monotonic', direction: 'increasing', strict: false });
      candidates.push({ kind: 'monotonic', direction: 'decreasing', strict: true });
      candidates.push({ kind: 'monotonic', direction: 'decreasing', strict: false });
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
      candidates.push({ kind: 'monotonic', direction: 'increasing', strict: true });
      candidates.push({ kind: 'monotonic', direction: 'increasing', strict: false });
      candidates.push({ kind: 'monotonic', direction: 'decreasing', strict: true });
      candidates.push({ kind: 'monotonic', direction: 'decreasing', strict: false });
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

      case 'monotonic': {
        // For monotonic, we need the full history, not just one snapshot
        // This is a special case handled differently
        // We skip it here and handle it in holdsForAllSnapshots with special logic
        return true; // Placeholder, will be properly checked in context
      }

      // Predicates that require full history context
      default:
        return true; // Default to true for unimplemented predicates
    }
  }

  /**
   * Special check for monotonic predicates across snapshots
   */
  private checkMonotonicPredicate(
    predicate: { kind: 'monotonic'; direction: 'increasing' | 'decreasing'; strict: boolean },
    snapshots: VariableSnapshot[]
  ): boolean {
    if (snapshots.length < 2) return true;

    for (let i = 0; i < snapshots.length - 1; i++) {
      const curr = snapshots[i];
      const next = snapshots[i + 1];

      const currValue = this.getComparableValue(curr.value);
      const nextValue = this.getComparableValue(next.value);

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
   * Extract comparable value from RuntimeTypedBinder
   */
  private getComparableValue(binder: RuntimeTypedBinder): number | null {
    const type = binder.type.static.kind;
    const value = binder.value;

    if (type === 'int' || type === 'float') {
      return value as number;
    } else if (type === 'array' && value instanceof SchemaArray) {
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
