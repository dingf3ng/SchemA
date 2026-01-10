import { Type } from '../type-checker/type-checker-utils';
import { BlockStatement, Parameter, TypeAnnotation } from '../transpiler/ast-types';
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
} from '../builtins/data-structures';
import { Environment } from './environment';
import { Predicate } from '../analyzer/analyzer-utils';

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
      predicateName: string;
      predicateArgs: RuntimeTypedBinder[];
    };
    type: RuntimeType;
  } // predicate type for nested predicates like @greater_than(5)
  | {
    value: {
      parameters: Parameter[];
      body: BlockStatement;
      closure: Environment;
    };
    type: RuntimeType;
  } // function type
  | {
    value: {
      fn: (...args: RuntimeTypedBinder[]) => RuntimeTypedBinder;
    };
    type: RuntimeType;
  }; // builtin function type

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
      return value !== null && value !== undefined ? value.toString() : 'undefined'
    case 'predicate': {
      const predicateValue = value as { predicateName: string; predicateArgs: RuntimeTypedBinder[] };
      const argsStr = predicateValue.predicateArgs
        .map((arg) => RuntimeTypedBinderToString(arg))
        .join(', ');
      return `${predicateValue.predicateName}(${argsStr})`;
    }
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

/**
     * Helper to resolve TypeAnnotation to Type, note that we should have fully annotated types at this point
     * @param annotation The TypeAnnotation to resolve
     * @returns the resolved Type
     */
export function resolveTypeAnnotation(annotation: TypeAnnotation | undefined): Type {
  if (!annotation) {
    throw new Error('Internal Error: Missing type annotation, it should have been inferred earlier');
  }

  if (annotation.kind === 'simple') {
    switch (annotation.name) {
      case 'int': return { kind: 'int' };
      case 'float': return { kind: 'float' };
      case 'string': return { kind: 'string' };
      case 'boolean': return { kind: 'boolean' };
      case 'void': return { kind: 'void' };
      case 'weak': return { kind: 'weak' };
      case 'poly': return { kind: 'poly' };
      case 'range': return { kind: 'range' };
      default: throw new Error(`Unknown simple type annotation: ${annotation.name}`);
    }
  } else if (annotation.kind === 'generic') {
    switch (annotation.name) {
      case 'Array':
        return { kind: 'array', elementType: resolveTypeAnnotation(annotation.typeParameters[0]) };
      case 'Map':
        return { kind: 'map', keyType: resolveTypeAnnotation(annotation.typeParameters[0]), valueType: resolveTypeAnnotation(annotation.typeParameters[1]) };
      case 'Set':
        return { kind: 'set', elementType: resolveTypeAnnotation(annotation.typeParameters[0]) };
      case 'MinHeap': case 'MaxHeap':
        return { kind: 'heap', elementType: resolveTypeAnnotation(annotation.typeParameters[0]) };
      case 'MinHeapMap': case 'MaxHeapMap':
        return { kind: 'heapmap', keyType: resolveTypeAnnotation(annotation.typeParameters[0]), valueType: resolveTypeAnnotation(annotation.typeParameters[1]) };
      case 'Graph':
        return { kind: 'graph', nodeType: resolveTypeAnnotation(annotation.typeParameters[0]) };
      case 'BinaryTree':
        return { kind: 'binarytree', elementType: resolveTypeAnnotation(annotation.typeParameters[0]) };
      case 'AVLTree':
        return { kind: 'avltree', elementType: resolveTypeAnnotation(annotation.typeParameters[0]) };
      default: throw new Error(`Unknown generic type annotation: ${annotation.name}`);
    }
  } else if (annotation.kind === 'function') {
    return {
      kind: 'function',
      parameters: annotation.parameterTypes ? annotation.parameterTypes.map((p: TypeAnnotation) => resolveTypeAnnotation(p)) : [],
      returnType: resolveTypeAnnotation(annotation.returnType)
    };
  } else if (annotation.kind === 'union') {
    return { kind: 'union', types: annotation.types.map((t: TypeAnnotation) => resolveTypeAnnotation(t)) };
  } else if (annotation.kind === 'intersection') {
    return { kind: 'intersection', types: annotation.types.map((t: TypeAnnotation) => resolveTypeAnnotation(t)) };
  } else if (annotation.kind === 'tuple') {
    return { kind: 'tuple', elementTypes: annotation.elementTypes.map((t: TypeAnnotation) => resolveTypeAnnotation(t)) };
  } else if (annotation.kind === 'record') {
    const fieldTypes: [Type, Type][] = annotation.fieldTypes.map(([keyType, valueType]) => {
      return [resolveTypeAnnotation(keyType), resolveTypeAnnotation(valueType)];
    });
    return { kind: 'record', fieldTypes };
  }
  throw new Error('Internal Error: Unknown type annotation kind');
}

export function isTruthy(value: RuntimeTypedBinder): boolean {
  const actualType = getActualRuntimeType(value);
  if (actualType === 'boolean') {
    return value.value as boolean;
  }
  // In many languages, non-boolean values can be truthy/falsy
  // For now, only booleans are considered for truthiness
  throw new Error(`Cannot evaluate truthiness of type ${value.type.static.kind} (actual: ${actualType})`);
}

/**
   * Get the actual runtime type from a RuntimeTypedBinder, resolving unions based on the actual value
   */
export function getActualRuntimeType(binder: RuntimeTypedBinder): string {
  const type = binder.type.static;

  // If it's not a union, return the type kind directly
  if (type.kind !== 'union' && type.kind !== 'intersection') {
    return type.kind;
  }

  // For unions, determine the actual type from the runtime value
  const value = binder.value;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (value === undefined || value === null) {
    return 'void';
  }

  // For complex types, return the type kind as-is
  return type.kind;
}

export function generateStringRange(start: string, end: string, inclusive: boolean): RuntimeTypedBinder {
  const result: RuntimeTypedBinder[] = [];

  // Simple implementation for same-length strings
  if (start.length !== end.length) {
    throw new Error('String range start and end must have the same length');
  }

  if (start.length === 1) {
    // Single character range like 'a'..'z'
    const startCode = start.charCodeAt(0);
    const endCode = end.charCodeAt(0);
    const finalCode = inclusive ? endCode : endCode - 1;

    for (let code = startCode; code <= finalCode; code++) {
      result.push({ type: { static: { kind: 'string' }, refinements: [] }, value: String.fromCharCode(code) });
    }
  } else {
    // Multi-character range like "aa".."bb"
    const current = start.split('');
    const endChars = end.split('');
    const maxIterations = 10000; // Safety limit
    let iterations = 0;

    while (iterations < maxIterations) {
      result.push({ type: { static: { kind: 'string' }, refinements: [] }, value: current.join('') });

      if (current.join('') === end) {
        if (!inclusive) {
          result.pop(); // Remove the end if not inclusive
        }
        break;
      }

      // Increment the string (rightmost character first)
      let carry = true;
      for (let i = current.length - 1; i >= 0 && carry; i--) {
        const charCode = current[i].charCodeAt(0);
        if (charCode < endChars[i].charCodeAt(0) || (i > 0 && charCode < 122)) {
          current[i] = String.fromCharCode(charCode + 1);
          carry = false;
        } else if (i > 0) {
          current[i] = 'a';
        } else {
          carry = false;
          break;
        }
      }

      iterations++;
    }
  }

  return { type: { static: { kind: 'array', elementType: { kind: 'string' } }, refinements: [] }, value: new SchemaArray(result) };
}


export function hasWeakTypes(type: Type): boolean {
  if (type.kind === 'weak') return true;

  if (type.kind === 'array' || type.kind === 'set' || type.kind === 'heap') {
    return hasWeakTypes(type.elementType);
  }

  if (type.kind === 'map' || type.kind === 'heapmap') {
    return hasWeakTypes(type.keyType) || hasWeakTypes(type.valueType);
  }

  if (type.kind === 'union' || type.kind === 'intersection') {
    return type.types.some(t => hasWeakTypes(t));
  }

  if (type.kind === 'tuple') {
    return type.elementTypes.some(t => hasWeakTypes(t));
  }

  if (type.kind === 'record') {
    return type.fieldTypes.some(([k, v]) => hasWeakTypes(k) || hasWeakTypes(v));
  }

  if (type.kind === 'graph') {
    return hasWeakTypes(type.nodeType);
  }

  if (type.kind === 'binarytree' || type.kind === 'avltree') {
    return hasWeakTypes(type.elementType);
  }

  if (type.kind === 'function') {
    return type.parameters.some(p => hasWeakTypes(p)) || hasWeakTypes(type.returnType);
  }

  return false;
}

export function valuesEqual(left: RuntimeTypedBinder, right: RuntimeTypedBinder): boolean {
  const leftType = left.type.static.kind;
  const rightType = right.type.static.kind;

  if (leftType !== rightType) return false;

  if (leftType === 'int' || leftType === 'float' || leftType === 'string' || leftType === 'boolean') {
    return left.value === right.value;
  }

  if (leftType === 'void') return true;

  throw new Error(`Equality not supported for type: "${leftType}" and "${rightType}"`);
}

export function RuntimeTypeBinderToKey(value: RuntimeTypedBinder): any {
  if (value.type.static.kind === 'int' || value.type.static.kind === 'float') return value.value;
  if (value.type.static.kind === 'string') return value.value;
  if (value.type.static.kind === 'boolean') return value.value;
  return value;
}

export function keyToRuntimeTypeBinder(key: any): RuntimeTypedBinder {
  if (typeof key === 'number') {
    return Number.isInteger(key)
      ? { type: { static: { kind: 'int' }, refinements: [] }, value: key }
      : { type: { static: { kind: 'float' }, refinements: [] }, value: key };
  }
  if (typeof key === 'string') {
    return { type: { static: { kind: 'string' }, refinements: [] }, value: key };
  }
  if (typeof key === 'boolean') {
    return { type: { static: { kind: 'boolean' }, refinements: [] }, value: key };
  }
  // If it's already a RuntimeTypedBinder, return it as-is
  return key;
}
