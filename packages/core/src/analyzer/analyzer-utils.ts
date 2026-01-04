import { SchemaSet, SchemaArray } from '../builtins/data-structures';
import { RuntimeTypedBinder } from '../runtime/runtime-utils';

export type Predicate =
  // Numeric constraints
  | { kind: 'int_range'; min: number; max: number }
  | { kind: 'positive'; strict: boolean }  // > 0 or >= 0
  | { kind: 'negative'; strict: boolean }  // < 0 or <= 0
  | { kind: 'greater_than'; threshold: number }  // > threshold
  | { kind: 'greater_equal_than'; threshold: number }  // >= threshold
  | { kind: 'divisible_by'; divisor: number }
  | { kind: 'parity'; value: 'even' | 'odd' }
  | { kind: 'monotonic'; direction: 'increasing' | 'decreasing'; strict: boolean }  // For numeric values over time

  // Collection size constraints
  | { kind: 'size_range'; min: number; max: number }
  | { kind: 'non_empty' }
  | { kind: 'size_equals'; size: number }

  // Collection ordering/structure constraints
  | { kind: 'sorted'; order: 'asc' | 'desc' }
  | { kind: 'unique_elements' }  // For arrays
  | { kind: 'heap_property'; heapType: 'min' | 'max' }

  // Graph-specific invariants
  | { kind: 'acyclic' }
  | { kind: 'connected' }
  | { kind: 'bipartite' }
  | { kind: 'no_negative_cycles' }
  | { kind: 'all_weights_non_negative' }

  // Tree-specific invariants
  | { kind: 'bst_property' }
  | { kind: 'balanced'; balanceType: 'avl' | 'redblack' }
  | { kind: 'complete_tree' }

  // Relational constraints (for maps/arrays)
  | { kind: 'size_monotonic'; direction: 'increasing' | 'decreasing'; strict: boolean }
  | { kind: 'range_satisfies'; from: number; to: number; predicate: Predicate }  // All elements in range satisfy predicate, for arrays
  | { kind: 'all_elements_satisfy'; predicate: Predicate }  // Recursive for nested

  // Logical predicates
  | { kind: 'not'; predicate: Predicate }  // Negation of a predicate

  // Permutation invariant (for sorting)
  | { kind: 'is_permutation_of'; original: SchemaArray<RuntimeTypedBinder> }  // Array is a permutation of original

  // Map/distance properties (for graph algorithms)
  | { kind: 'distance_to_self_zero' }  // dist[start] == 0
  | { kind: 'triangle_inequality' }  // dist[u] + weight(u,v) >= dist[v]

  // Set properties
  | { kind: 'subset_of'; superset: SchemaSet<any> }  // Set is subset of another
  | { kind: 'disjoint_from'; other: SchemaSet<any> }  // Set has no overlap with another

/**
 * Get a hashable key for an element (for uniqueness checking)
 */
export function getElementKey(elem: RuntimeTypedBinder): any {
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

        // Parse the nested predicate
        let nestedPredicate: Predicate;
        if (predArg.type.static.kind === 'predicate') {
          // This is a predicate call like @greater_than(5) that was evaluated by the interpreter
          const predicateValue = predArg.value as { predicateName: string; predicateArgs: RuntimeTypedBinder[] };
          nestedPredicate = parsePredicateName(predicateValue.predicateName, predicateValue.predicateArgs);
        } else if (predArg.type.static.kind === 'string') {
          // Simple predicate name string (backward compatibility)
          nestedPredicate = parsePredicateName(predArg.value as string);
        } else {
          throw new Error('range_satisfies: predicate argument must be a predicate or string');
        }

        return {
          kind: 'range_satisfies',
          from: fromArg.value as number,
          to: toArg.value as number,
          predicate: nestedPredicate
        };
      }

      case 'greater_than':
      case 'gt': {
        const thresholdArg = args[0];
        if (thresholdArg.type.static.kind !== 'int' && thresholdArg.type.static.kind !== 'float') {
          throw new Error('greater_than predicate expects numeric argument');
        }
        return { kind: 'greater_than', threshold: thresholdArg.value as number };
      }

      case 'greater_equal_than':
      case 'gte':
      case 'ge': {
        const thresholdArg = args[0];
        if (thresholdArg.type.static.kind !== 'int' && thresholdArg.type.static.kind !== 'float') {
          throw new Error('greater_equal_than predicate expects numeric argument');
        }
        return { kind: 'greater_equal_than', threshold: thresholdArg.value as number };
      }

      case 'not': {
        const predArg = args[0];

        // Parse the nested predicate
        let nestedPredicate: Predicate;
        if (predArg.type.static.kind === 'predicate') {
          // This is a predicate call like @sorted("desc") that was evaluated by the interpreter
          const predicateValue = predArg.value as { predicateName: string; predicateArgs: RuntimeTypedBinder[] };
          nestedPredicate = parsePredicateName(predicateValue.predicateName, predicateValue.predicateArgs);
        } else if (predArg.type.static.kind === 'string') {
          // Simple predicate name string (backward compatibility)
          nestedPredicate = parsePredicateName(predArg.value as string);
        } else {
          throw new Error('not predicate expects predicate or string argument');
        }

        return { kind: 'not', predicate: nestedPredicate };
      }

      case 'is_permutation_of': {
        const arrayArg = args[0];
        if (arrayArg.type.static.kind !== 'array') {
          throw new Error('is_permutation_of predicate expects array argument');
        }
        if (!arrayArg.value || !(arrayArg.value instanceof SchemaArray)) {
          throw new Error('is_permutation_of: array argument must be a SchemaArray instance');
        }
        return { kind: 'is_permutation_of', original: arrayArg.value as SchemaArray<RuntimeTypedBinder> };
      }

      case 'all_elements_satisfy': {
        const predArg = args[0];

        // Parse the nested predicate
        let nestedPredicate: Predicate;
        if (predArg.type.static.kind === 'predicate') {
          // This is a predicate call that was evaluated by the interpreter
          const predicateValue = predArg.value as { predicateName: string; predicateArgs: RuntimeTypedBinder[] };
          nestedPredicate = parsePredicateName(predicateValue.predicateName, predicateValue.predicateArgs);
        } else if (predArg.type.static.kind === 'string') {
          // Simple predicate name string (backward compatibility)
          nestedPredicate = parsePredicateName(predArg.value as string);
        } else {
          throw new Error('all_elements_satisfy predicate expects predicate or string argument');
        }

        return { kind: 'all_elements_satisfy', predicate: nestedPredicate };
      }

      case 'monotonic': {
        if (args.length !== 2) {
          throw new Error('monotonic predicate expects 2 arguments: direction, strict');
        }
        const dirArg = args[0];
        const strictArg = args[1];
        if (dirArg.type.static.kind !== 'string') {
          throw new Error('monotonic: direction must be string');
        }
        if (strictArg.type.static.kind !== 'boolean') {
          throw new Error('monotonic: strict must be boolean');
        }
        const direction = dirArg.value as string;
        if (direction !== 'increasing' && direction !== 'decreasing') {
          throw new Error('monotonic: direction must be "increasing" or "decreasing"');
        }
        return {
          kind: 'monotonic',
          direction: direction as 'increasing' | 'decreasing',
          strict: strictArg.value as boolean
        };
      }

      case 'size_monotonic': {
        if (args.length !== 2) {
          throw new Error('size_monotonic predicate expects 2 arguments: direction, strict');
        }
        const dirArg = args[0];
        const strictArg = args[1];
        if (dirArg.type.static.kind !== 'string') {
          throw new Error('size_monotonic: direction must be string');
        }
        if (strictArg.type.static.kind !== 'boolean') {
          throw new Error('size_monotonic: strict must be boolean');
        }
        const direction = dirArg.value as string;
        if (direction !== 'increasing' && direction !== 'decreasing') {
          throw new Error('size_monotonic: direction must be "increasing" or "decreasing"');
        }
        return {
          kind: 'size_monotonic',
          direction: direction as 'increasing' | 'decreasing',
          strict: strictArg.value as boolean
        };
      }

      case 'int_range': {
        if (args.length !== 2) {
          throw new Error('int_range predicate expects 2 arguments: min, max');
        }
        const minArg = args[0];
        const maxArg = args[1];
        if (minArg.type.static.kind !== 'int' || maxArg.type.static.kind !== 'int') {
          throw new Error('int_range predicate expects integer arguments');
        }
        return { kind: 'int_range', min: minArg.value as number, max: maxArg.value as number };
      }

      case 'parity': {
        const valueArg = args[0];
        if (valueArg.type.static.kind !== 'string') {
          throw new Error('parity predicate expects string argument (even or odd)');
        }
        const value = valueArg.value as string;
        if (value !== 'even' && value !== 'odd') {
          throw new Error(`parity predicate expects 'even' or 'odd', got '${value}'`);
        }
        return { kind: 'parity', value: value as 'even' | 'odd' };
      }

      case 'size_range': {
        if (args.length !== 2) {
          throw new Error('size_range predicate expects 2 arguments: min, max');
        }
        const minArg = args[0];
        const maxArg = args[1];
        if (minArg.type.static.kind !== 'int' || maxArg.type.static.kind !== 'int') {
          throw new Error('size_range predicate expects integer arguments');
        }
        return { kind: 'size_range', min: minArg.value as number, max: maxArg.value as number };
      }

      case 'size_equals': {
        const sizeArg = args[0];
        if (sizeArg.type.static.kind !== 'int') {
          throw new Error('size_equals predicate expects integer argument');
        }
        return { kind: 'size_equals', size: sizeArg.value as number };
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

    // Graph predicates
    case 'acyclic':
      return { kind: 'acyclic' };

    case 'connected':
      return { kind: 'connected' };

    case 'bipartite':
      return { kind: 'bipartite' };

    case 'no_negative_cycles':
      return { kind: 'no_negative_cycles' };

    case 'all_weights_non_negative':
      return { kind: 'all_weights_non_negative' };

    // Tree predicates
    case 'bst_property':
      return { kind: 'bst_property' };

    case 'complete_tree':
      return { kind: 'complete_tree' };

    // Distance/triangle predicates
    case 'distance_to_self_zero':
      return { kind: 'distance_to_self_zero' };

    case 'triangle_inequality':
      return { kind: 'triangle_inequality' };

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

    case 'greater_than':
      return `> ${predicate.threshold}`;

    case 'greater_equal_than':
      return `≥ ${predicate.threshold}`;

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

    case 'all_elements_satisfy':
      return `all values satisfy: ${predicateToString(predicate.predicate)}`;

    case 'range_satisfies':
      return `range [${predicate.from}, ${predicate.to}) satisfies: ${predicateToString(predicate.predicate)}`;

    case 'not':
      return `¬(${predicateToString(predicate.predicate)})`;

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
