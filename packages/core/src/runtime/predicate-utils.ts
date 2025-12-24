import { Predicate, RuntimeTypedBinder } from './values';
import { SchemaArray } from './data-structures';

/**
 * Check if a predicate holds for a given value
 */
export function checkPredicate(predicate: Predicate, value: RuntimeTypedBinder): boolean {
  const val = value.value;
  const type = value.type.static.kind;

  switch (predicate.kind) {
    // Numeric predicates
    case 'int_range':
      if (type === 'int' || type === 'float') {
        const num = val as number;
        return num >= predicate.min && num <= predicate.max;
      }
      return false;

    case 'positive':
      if (type === 'int' || type === 'float') {
        const num = val as number;
        return predicate.strict ? num > 0 : num >= 0;
      }
      return false;

    case 'negative':
      if (type === 'int' || type === 'float') {
        const num = val as number;
        return predicate.strict ? num < 0 : num <= 0;
      }
      return false;

    case 'divisible_by':
      if (type === 'int') {
        const num = val as number;
        return num % predicate.divisor === 0;
      }
      return false;

    case 'parity':
      if (type === 'int') {
        const num = val as number;
        const isEven = num % 2 === 0;
        return predicate.value === 'even' ? isEven : !isEven;
      }
      return false;

    // Collection size predicates
    case 'size_range':
    case 'size_equals':
    case 'non_empty': {
      let size = 0;
      if (type === 'array' && val instanceof SchemaArray) {
        size = val.length;
      } else if (typeof val === 'object' && val !== null && 'size' in val) {
        size = (val as any).size;
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
      if (type !== 'array' || !(val instanceof SchemaArray)) return false;
      const arr = val as SchemaArray<RuntimeTypedBinder>;
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
      if (type !== 'array' || !(val instanceof SchemaArray)) return false;
      const arr = val as SchemaArray<RuntimeTypedBinder>;
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

    // Predicates that require historical context (not supported for single-value checks)
    case 'monotonic':
      throw new Error('Monotonic predicates require historical context and cannot be checked on a single value');

    // Unimplemented predicates
    case 'heap_property':
    case 'acyclic':
    case 'connected':
    case 'bipartite':
    case 'bst_property':
    case 'balanced':
    case 'complete_tree':
    case 'all_values_satisfy':
      throw new Error(`Predicate checking for '${predicate.kind}' is not yet implemented`);

    default:
      const _exhaustive: never = predicate;
      return false;
  }
}

/**
 * Get a hashable key for an element (for uniqueness checking)
 */
function getElementKey(elem: RuntimeTypedBinder): any {
  const type = elem.type.static.kind;
  if (type === 'int' || type === 'float' || type === 'string' || type === 'boolean') {
    return elem.value;
  }
  return elem; // For complex types, use object identity
}

/**
 * Parse a predicate name and optional arguments into a Predicate object
 */
export function parsePredicateName(name: string, args?: RuntimeTypedBinder[]): Predicate {
  // Strip @ prefix if present
  const cleanName = name.startsWith('@') ? name.substring(1) : name;
  const lowerName = cleanName.toLowerCase();

  // Handle predicates with arguments
  if (args && args.length > 0) {
    switch (lowerName) {
      case 'sorted': {
        const orderArg = args[0];
        if (orderArg.type.static.kind !== 'string') {
          throw new Error('sorted predicate expects string argument (asc or desc)');
        }
        const order = orderArg.value as string;
        if (order !== 'asc' && order !== 'desc') {
          throw new Error(`sorted predicate expects 'asc' or 'desc', got '${order}'`);
        }
        return { kind: 'sorted', order };
      }

      case 'divisible_by': {
        const divisorArg = args[0];
        if (divisorArg.type.static.kind !== 'int') {
          throw new Error('divisible_by predicate expects integer argument');
        }
        return { kind: 'divisible_by', divisor: divisorArg.value as number };
      }

      case 'positive': {
        const strictArg = args[0];
        if (strictArg.type.static.kind !== 'boolean') {
          throw new Error('positive predicate expects boolean argument for strictness');
        }
        return { kind: 'positive', strict: strictArg.value as boolean };
      }

      case 'negative': {
        const strictArg = args[0];
        if (strictArg.type.static.kind !== 'boolean') {
          throw new Error('negative predicate expects boolean argument for strictness');
        }
        return { kind: 'negative', strict: strictArg.value as boolean };
      }

      default:
        throw new Error(`Predicate '${name}' does not accept arguments`);
    }
  }

  // Handle predicates without arguments (using defaults)
  switch (lowerName) {
    case 'sorted':
      return { kind: 'sorted', order: 'asc' }; // Default to ascending

    case 'non_empty':
    case 'nonempty':
      return { kind: 'non_empty' };

    case 'unique_elements':
    case 'unique':
      return { kind: 'unique_elements' };

    case 'positive':
      return { kind: 'positive', strict: false }; // Default to >= 0

    case 'negative':
      return { kind: 'negative', strict: false }; // Default to <= 0

    case 'even':
      return { kind: 'parity', value: 'even' };

    case 'odd':
      return { kind: 'parity', value: 'odd' };

    default:
      throw new Error(`Unknown predicate: ${name}`);
  }
}

/**
 * Convert a predicate to a human-readable string
 */
export function predicateToString(predicate: Predicate): string {
  switch (predicate.kind) {
    case 'int_range':
      return `∈ [${predicate.min}, ${predicate.max}]`;

    case 'positive':
      return predicate.strict ? '> 0' : '≥ 0';

    case 'negative':
      return predicate.strict ? '< 0' : '≤ 0';

    case 'divisible_by':
      return `divisible by ${predicate.divisor}`;

    case 'parity':
      return predicate.value === 'even' ? 'even' : 'odd';

    case 'size_range':
      return `size ∈ [${predicate.min}, ${predicate.max}]`;

    case 'non_empty':
      return 'non-empty';

    case 'size_equals':
      return `size = ${predicate.size}`;

    case 'sorted':
      return `sorted (${predicate.order})`;

    case 'unique_elements':
      return 'unique elements';

    case 'heap_property':
      return `${predicate.heapType}-heap property`;

    case 'acyclic':
      return 'acyclic';

    case 'connected':
      return 'connected';

    case 'bipartite':
      return 'bipartite';

    case 'bst_property':
      return 'BST property';

    case 'balanced':
      return `balanced (${predicate.balanceType})`;

    case 'complete_tree':
      return 'complete tree';

    case 'monotonic':
      const strictness = predicate.strict ? 'strictly ' : '';
      return `${strictness}monotonic ${predicate.direction}`;

    case 'all_values_satisfy':
      return `all values satisfy: ${predicateToString(predicate.predicate)}`;

    default:
      const _exhaustive: never = predicate;
      return 'unknown predicate';
  }
}

/**
 * Convert an array of predicates to a formatted string
 */
export function predicatesToString(predicates: Predicate[]): string {
  if (predicates.length === 0) {
    return 'no predicates';
  }
  return predicates.map(p => predicateToString(p)).join(', ');
}
