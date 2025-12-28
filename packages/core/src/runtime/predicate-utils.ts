import { Predicate, RuntimeTypedBinder } from './values';

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

      case 'range_satisfies': {
        if (args.length !== 3) {
          throw new Error('range_satisfies predicate expects 3 arguments: from, to, predicate');
        }
        const fromArg = args[0];
        const toArg = args[1];
        const predArg = args[2];

        if (fromArg.type.static.kind !== 'int') {
          throw new Error('range_satisfies: from argument must be an integer');
        }
        if (toArg.type.static.kind !== 'int') {
          throw new Error('range_satisfies: to argument must be an integer');
        }
        if (predArg.type.static.kind !== 'string') {
          throw new Error('range_satisfies: predicate argument must be a string/identifier');
        }

        const nestedPredicate = parsePredicateName(predArg.value as string);
        
        return {
          kind: 'range_satisfies',
          from: fromArg.value as number,
          to: toArg.value as number,
          predicate: nestedPredicate
        };
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

    case 'frozen':
      return { kind: 'frozen' };

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

    case 'monotonic': {
      const strictness = predicate.strict ? 'strictly ' : '';
      return `${strictness}monotonic ${predicate.direction}`;
    }

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

    case 'size_monotonic': {
      const strictness = predicate.strict ? 'strictly ' : '';
      return `size ${strictness}monotonic ${predicate.direction}`;
    }

    case 'all_values_satisfy':
      return `all values satisfy: ${predicateToString(predicate.predicate)}`;

    case 'range_satisfies':
      return `range [${predicate.from}, ${predicate.to}) satisfies: ${predicateToString(predicate.predicate)}`;

    case 'partitioned_at':
      return `partitioned at index ${predicate.pivotIndex}`;

    case 'partitioned_by_value':
      return `partitioned by value ${predicate.pivotValue}`;

    case 'is_permutation_of':
      return 'is permutation of original';

    case 'no_negative_cycles':
      return 'no negative cycles';

    case 'all_weights_non_negative':
      return 'all weights non-negative';

    case 'distance_to_self_zero':
      return 'distance to self is zero';

    case 'triangle_inequality':
      return 'satisfies triangle inequality';

    case 'subset_of':
      return 'subset of reference set';

    case 'disjoint_from':
      return 'disjoint from reference set';

    case 'frozen':
      return 'frozen (immutable)';

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
