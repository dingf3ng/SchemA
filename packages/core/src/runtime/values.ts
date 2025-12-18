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

export type Predicate = 
  | { kind: 'int_range' ; min: number; max: number }
  // TODO: add more predicates

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
        closure: Map<string, RuntimeTypedBinder>;
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
      const types = type.static.elementTypes;
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
      const unionTypes = type.static.types;
      return `union<${unionTypes.map(t => t.kind).join(' | ')}>`;
    case 'intersection':
      const intersectionTypes = type.static.types;
      return `intersection<${intersectionTypes.map(t => t.kind).join(' & ')}>`;
    case 'weak':
      throw new Error('Internal Error: Weak polymorphic type should not appear at runtime');
    default:
      const _exhaustiveCheck: never = type.static;
      throw new Error('Internal Error: Unknown type in RuntimeTypedBinderToString');
  }
}
