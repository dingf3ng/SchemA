import { Type } from '../typechecker';
import { BlockStatement, Parameter } from '../types';
import {
  SchemaArray,
  SchemaMap,
  SchemaSet,
  MinHeap,
  MaxHeap,
  Graph,
  LazyRange,
  BinaryTree,
  AVLTree,
  MinHeapMap,
  MaxHeapMap,
} from './data-structures';
import { Environment } from './environment';

export type Predicate =
  // Numeric constraints
  | { kind: 'int_range'; min: number; max: number }
  | { kind: 'positive'; strict: boolean }  // > 0 or >= 0
  | { kind: 'negative'; strict: boolean }  // < 0 or <= 0
  | { kind: 'divisible_by'; divisor: number }
  | { kind: 'parity'; value: 'even' | 'odd' }

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

  // Tree-specific invariants
  | { kind: 'bst_property' }
  | { kind: 'balanced'; balanceType: 'avl' | 'redblack' }
  | { kind: 'complete_tree' }

  // Relational constraints (for maps/arrays)
  | { kind: 'monotonic'; direction: 'increasing' | 'decreasing'; strict: boolean }
  | { kind: 'all_values_satisfy'; predicate: Predicate }  // Recursive for nested

export type RuntimeType =
  { static: Type, refinements: Predicate[] }

export type RuntimeTypedBinder =
  | { value: undefined; type: RuntimeType } // void type
  | { value: number; type: RuntimeType }
  | { value: string; type: RuntimeType }
  | { value: boolean; type: RuntimeType }
  | { value: SchemaArray<RuntimeTypedBinder>; type: RuntimeType }
  | { value: SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>; type: RuntimeType }
  | { value: SchemaSet<RuntimeTypedBinder>; type: RuntimeType }
  | { value: MinHeap<RuntimeTypedBinder>; type: RuntimeType }
  | { value: MaxHeap<RuntimeTypedBinder>; type: RuntimeType }
  | { value: MinHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>; type: RuntimeType }
  | { value: MaxHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>; type: RuntimeType }
  | { value: BinaryTree<RuntimeTypedBinder>; type: RuntimeType }
  | { value: AVLTree<RuntimeTypedBinder>; type: RuntimeType }
  | { value: Graph<RuntimeTypedBinder>; type: RuntimeType }
  | { value: LazyRange; type: RuntimeType }
  | { value: RuntimeTypedBinder[]; type: RuntimeType } // tuples
  | { value: Map<RuntimeTypedBinder, RuntimeTypedBinder>; type: RuntimeType } // records
  | {
      value: {
        parameters: Parameter[];
        body: BlockStatement;
        closure: Environment;
      };
      type: RuntimeType;
    }
  | {
      value: {
        fn: (...args: RuntimeTypedBinder[]) => RuntimeTypedBinder;
      };
      type: RuntimeType;
    };

export function RuntimeTypedBinderToString(binder: RuntimeTypedBinder): string {
  const { value, type } = binder;
  switch (type.static.kind) {
    case 'void':
      return 'undefined';
    case 'int':
    case 'float':
    case 'string':
    case 'poly':
    case 'boolean':
    case 'array':
    case 'map':
    case 'set':
    case 'heap':
    case 'heapmap':
    case 'binarytree':
    case 'avltree':
    case 'graph':
    case 'range':
      return value!.toString()
    case 'tuple': {
      const values = value as RuntimeTypedBinder[]; 
      return `(${values.map((v) => RuntimeTypedBinderToString(v)).join(', ')})`;
    }
    case 'record': {
      const values = value as Map<RuntimeTypedBinder, RuntimeTypedBinder>;
      const fields = Array.from(values.entries())
        .map(([k, v]) => {
          return `${RuntimeTypedBinderToString(k)}: ${RuntimeTypedBinderToString(v)}`;
        })
        .join(', ');
      return `{ ${fields} }`;
    }
    case 'function':
      return '<function>';
    case 'union':
      return value!.toString();
    case 'intersection':
      return value!.toString();
    case 'weak':
      return value!.toString();
    default:
      const _exhaustiveCheck: never = type.static;
      throw new Error('Internal Error: Unknown type in RuntimeTypedBinderToString');
  }
}
