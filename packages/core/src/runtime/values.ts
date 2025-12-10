import { BlockStatement, Parameter } from '../types';
import {
  SchemaArray,
  SchemaMap,
  SchemaSet,
  MinHeap,
  MaxHeap,
  Graph,
} from './data-structures';

export type RuntimeValue =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null'; value: null }
  | { type: 'array'; value: SchemaArray<RuntimeValue> }
  | { type: 'map'; value: SchemaMap<any, RuntimeValue> }
  | { type: 'set'; value: SchemaSet<any> }
  | { type: 'minheap'; value: MinHeap<any> }
  | { type: 'maxheap'; value: MaxHeap<any> }
  | { type: 'graph'; value: Graph<any> }
  | {
      type: 'function';
      parameters: Parameter[];
      body: BlockStatement;
      closure: Map<string, RuntimeValue>;
    }
  | {
      type: 'native-function';
      fn: (...args: RuntimeValue[]) => RuntimeValue;
    };

export function runtimeValueToString(value: RuntimeValue): string {
  switch (value.type) {
    case 'number':
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
    case 'graph':
      return value.value.toString();
    case 'function':
      return '<function>';
    case 'native-function':
      return '<native function>';
  }
}

export function isTruthy(value: RuntimeValue): boolean {
  if (value.type === 'boolean') return value.value;
  if (value.type === 'null') return false;
  if (value.type === 'number') return value.value !== 0;
  if (value.type === 'string') return value.value.length > 0;
  return true;
}
