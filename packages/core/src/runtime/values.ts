import { BlockStatement, Parameter } from '../types';
import {
  SchemaArray,
  SchemaMap,
  SchemaSet,
  MinHeap,
  MaxHeap,
  Graph,
  LazyRange,
  HeapMap,
  BinaryTree,
  AVLTree,
} from './data-structures';

export type RuntimeTypeBinder =
  | { type: 'int'; value: number }
  | { type: 'float'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null'; value: null }
  | { type: 'array'; value: SchemaArray<RuntimeTypeBinder> }
  | { type: 'map'; value: SchemaMap<any, RuntimeTypeBinder> }
  | { type: 'set'; value: SchemaSet<any> }
  | { type: 'minheap'; value: MinHeap<any> }
  | { type: 'maxheap'; value: MaxHeap<any> }
  | { type: 'heapMap'; value: HeapMap<any, any> }
  | { type: 'binarytree'; value: BinaryTree<any> }
  | { type: 'avltree'; value: AVLTree<any> }
  | { type: 'graph'; value: Graph<any> }
  | { type: 'range'; value: LazyRange }
  | { type: 'tuple'; elements: RuntimeTypeBinder[] }
  | { type: 'record'; fields: Map<string, RuntimeTypeBinder> }
  | {
      type: 'function';
      parameters: Parameter[];
      body: BlockStatement;
      closure: Map<string, RuntimeTypeBinder>;
    }
  | {
      type: 'native-function';
      fn: (...args: RuntimeTypeBinder[]) => RuntimeTypeBinder;
    };

export function RuntimeTypeBinderToString(value: RuntimeTypeBinder): string {
  switch (value.type) {
    case 'int':
      return value.value.toString();
    case 'float':
      return value.value.toString();
    case 'string':
      return value.value;
    case 'boolean':
      return value.value.toString();
    case 'null':
      return 'null';
    case 'array':
      return value.value.toString();
    case 'map':
      return value.value.toString();
    case 'set':
      return value.value.toString();
    case 'minheap':
      return value.value.toString();
    case 'maxheap':
      return value.value.toString();
    case 'heapMap':
      return value.value.toString();
    case 'binarytree':
      return value.value.toString();
    case 'avltree':
      return value.value.toString();
    case 'graph':
      return value.value.toString();
    case 'range':
      return value.value.toString();
    case 'tuple':
      return `(${value.elements.map(RuntimeTypeBinderToString).join(', ')})`;
    case 'record': {
      const fields = Array.from(value.fields.entries())
        .map(([k, v]) => `${k}: ${RuntimeTypeBinderToString(v)}`)
        .join(', ');
      return `{ ${fields} }`;
    }
    case 'function':
      return '<function>';
    case 'native-function':
      return '<native function>';
  }
}

export function isTruthy(value: RuntimeTypeBinder): boolean {
  if (value.type === 'boolean') return value.value;
  if (value.type === 'null') return false;
  if (value.type === 'int' || value.type === 'float') return value.value !== 0;
  if (value.type === 'string') return value.value.length > 0;
  return true;
}
