import { TypeAnnotation } from "../transpiler/ast-types";

export type Type =
  | { kind: 'weak' } // weak polymorphic type, like in ocaml
  | { kind: 'poly' } // real polymorphic type, only for empty arrays, maps, sets, heaps, etc.
  | { kind: 'int' }
  | { kind: 'float' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'void' }
  | { kind: 'predicate' } // predicate type for nested predicates like @greater_than(5)
  | { kind: 'array'; elementType: Type }
  | { kind: 'map'; keyType: Type; valueType: Type }
  | { kind: 'set'; elementType: Type }
  | { kind: 'heap'; elementType: Type }
  | { kind: 'heapmap'; keyType: Type; valueType: Type }
  | { kind: 'binarytree'; elementType: Type }
  | { kind: 'avltree'; elementType: Type }
  | { kind: 'graph'; nodeType: Type }
  | { kind: 'range' }
  | { kind: 'record'; fieldTypes: [Type, Type][] }
  | { kind: 'tuple'; elementTypes: Type[] }
  | { kind: 'union'; types: Type[] }
  | { kind: 'intersection'; types: Type[] }
  | {
    kind: 'function';
    parameters: Type[];
    returnType: Type;
    variadic?: boolean;
  };

export function typeToString(type: Type): string {
  switch (type.kind) {
    case 'poly':
      return 'poly';
    case 'weak':
      return 'weak';
    case 'int':
      return 'int';
    case 'float':
      return 'float';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'void':
      return 'void';
    case 'predicate':
      return 'Predicate';
    case 'range':
      return 'Range';
    case 'array':
      return `Array<${typeToString(type.elementType)}>`;
    case 'map':
      return `Map<${typeToString(type.keyType)}, ${typeToString(type.valueType)}>`;
    case 'set':
      return `Set<${typeToString(type.elementType)}>`;
    case 'binarytree':
      return `BinaryTree<${typeToString(type.elementType)}>`;
    case 'avltree':
      return `AVLTree<${typeToString(type.elementType)}>`;
    case 'heap':
      return `Heap<${typeToString(type.elementType)}>`;
    case 'heapmap':
      return `HeapMap<${typeToString(type.keyType)}, ${typeToString(type.valueType)}>`;
    case 'graph':
      return `Graph<${typeToString(type.nodeType)}>`;
    case 'record': {
      const fields = type.fieldTypes
        .map(([name, fieldType]) => `${name}: ${typeToString(fieldType)}`)
        .join(', ');
      return `{ ${fields} }`;
    }
    case 'tuple':
      return `(${type.elementTypes.map((t) => typeToString(t)).join(', ')})`;
    case 'union':
      return type.types.map((t) => typeToString(t)).join(' | ');
    case 'intersection':
      return type.types.map((t) => typeToString(t)).join(' & ');
    case 'function':
      return `(${type.parameters.map((p) => typeToString(p)).join(', ')}) -> ${typeToString(type.returnType)}`;
  }
}

function typeToStringForCache(type: Type): string {
  // Lightweight version of typeToString for cache keys
  // Uses JSON.stringify for simplicity but could be optimized further
  return JSON.stringify(type);
}

export function typesEqual(t1: Type, t2: Type, typeEqualityCache: Map<string, boolean>): boolean {
  // Use cache to avoid redundant comparisons
  const cacheKey = typeToStringForCache(t1) + '<=>' + typeToStringForCache(t2);
  const cached = typeEqualityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = typesEqualUncached(t1, t2, typeEqualityCache);
  typeEqualityCache.set(cacheKey, result);
  return result;
}

function typesEqualUncached(t1: Type, t2: Type, typeEqualityCache: Map<string, boolean>): boolean {
  // Handle weak and poly types (wildcards) - they match anything
  if (t1.kind === 'weak' || t1.kind === 'poly' || t2.kind === 'weak' || t2.kind === 'poly') {
    return true;
  }

  // Handle Union Types (LHS split)
  // t1 <= t2 if t1 is a union and ALL members of t1 are assignable to t2
  if (t1.kind === 'union') {
    return t1.types.every(t => typesEqual(t, t2, typeEqualityCache));
  }

  // Handle Intersection Types (RHS split)
  // t1 <= t2 if t2 is an intersection and t1 is assignable to ALL members of t2
  if (t2.kind === 'intersection') {
    return t2.types.every(t => typesEqual(t1, t, typeEqualityCache));
  }

  // Handle Union Types (RHS match)
  // t1 <= t2 if t2 is a union and t1 is assignable to SOME member of t2
  if (t2.kind === 'union') {
    return t2.types.some(t => typesEqual(t1, t, typeEqualityCache));
  }

  // Handle Intersection Types (LHS match)
  // t1 <= t2 if t1 is an intersection and SOME member of t1 is assignable to t2
  if (t1.kind === 'intersection') {
    return t1.types.some(t => typesEqual(t, t2, typeEqualityCache));
  }

  if (t1.kind !== t2.kind) {
    return false;
  }

  switch (t1.kind) {
    case 'int':
    case 'float':
    case 'string':
    case 'boolean':
    case 'void':
    case 'range':
      return true;

    case 'array':
      return typesEqual((t1 as any).elementType, (t2 as any).elementType, typeEqualityCache);

    case 'map':
    case 'heapmap':
      return (
        typesEqual((t1 as any).keyType, (t2 as any).keyType, typeEqualityCache) &&
        typesEqual((t1 as any).valueType, (t2 as any).valueType, typeEqualityCache)
      );

    case 'set':
    case 'heap':
    case 'binarytree':
    case 'avltree':
      return typesEqual((t1 as any).elementType, (t2 as any).elementType, typeEqualityCache);

    case 'graph':
      return typesEqual((t1 as any).nodeType, (t2 as any).nodeType, typeEqualityCache);

    case 'function': {
      const params1 = (t1 as any).parameters;
      const params2 = (t2 as any).parameters;
      if (params1.length !== params2.length) {
        return false;
      }
      return (
        params1.every((p: Type, i: number) => typesEqual(p, params2[i], typeEqualityCache)) &&
        typesEqual((t1 as any).returnType, (t2 as any).returnType, typeEqualityCache)
      );
    }

    case 'tuple': {
      const elems1 = (t1 as any).elementTypes;
      const elems2 = (t2 as any).elementTypes;
      if (elems1.length !== elems2.length) {
        return false;
      }
      return elems1.every((e: Type, i: number) => typesEqual(e, elems2[i], typeEqualityCache));
    }

    case 'record': {
      const fields1 = (t1 as any).fieldTypes;
      const fields2 = (t2 as any).fieldTypes;
      if (fields1.length !== fields2.length) {
        return false;
      }
      return fields1.every(([k1, v1]: [Type, Type], i: number) => {
        const [k2, v2] = fields2[i];
        return typesEqual(k1, k2, typeEqualityCache) && typesEqual(v1, v2, typeEqualityCache);
      });
    }

    default:
      return false;
  }
}

export function typeToAnnotation(type: Type, line: number, column: number): TypeAnnotation {
  switch (type.kind) {
    case 'int':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'int', line, column };
    case 'float':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'float', line, column };
    case 'string':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'string', line, column };
    case 'boolean':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'boolean', line, column };
    case 'void':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'void', line, column };
    case 'weak':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'weak', line, column };
    case 'poly':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'poly', line, column };
    case 'range':
      return { type: 'TypeAnnotation', kind: 'simple', name: 'Range', line, column };
    case 'array':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'Array',
        typeParameters: [typeToAnnotation(type.elementType, line, column)],
        line,
        column
      };
    case 'map':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'Map',
        typeParameters: [
          typeToAnnotation(type.keyType, line, column),
          typeToAnnotation(type.valueType, line, column)
        ],
        line,
        column
      };
    case 'set':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'Set',
        typeParameters: [typeToAnnotation(type.elementType, line, column)],
        line,
        column
      };
    case 'heap':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'MinHeap',
        typeParameters: [typeToAnnotation(type.elementType, line, column)],
        line,
        column
      };
    case 'heapmap':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'MinHeapMap',
        typeParameters: [
          typeToAnnotation(type.keyType, line, column),
          typeToAnnotation(type.valueType, line, column)
        ],
        line,
        column
      };
    case 'graph':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'Graph',
        typeParameters: [typeToAnnotation(type.nodeType, line, column)],
        line,
        column
      };
    case 'binarytree':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'BinaryTree',
        typeParameters: [typeToAnnotation(type.elementType, line, column)],
        line,
        column
      };
    case 'avltree':
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name: 'AVLTree',
        typeParameters: [typeToAnnotation(type.elementType, line, column)],
        line,
        column
      };
    case 'union':
      return {
        type: 'TypeAnnotation',
        kind: 'union',
        types: type.types.map(t => typeToAnnotation(t, line, column)),
        line,
        column
      };
    case 'intersection':
      return {
        type: 'TypeAnnotation',
        kind: 'intersection',
        types: type.types.map(t => typeToAnnotation(t, line, column)),
        line,
        column
      };
    case 'function':
      return {
        type: 'TypeAnnotation',
        kind: 'function',
        name: 'Function',
        parameterTypes: type.parameters.map(p => typeToAnnotation(p, line, column)),
        returnType: typeToAnnotation(type.returnType, line, column),
        line,
        column
      };
    case 'tuple':
      return {
        type: 'TypeAnnotation',
        kind: 'tuple',
        elementTypes: type.elementTypes.map(t => typeToAnnotation(t, line, column)),
        line,
        column
      };
    case 'record':
      return {
        type: 'TypeAnnotation',
        kind: 'record',
        fieldTypes: type.fieldTypes.map(([keyType, valueType]) => [
          typeToAnnotation(keyType, line, column),
          typeToAnnotation(valueType, line, column)
        ]),
        line,
        column
      };
    default:
      return { type: 'TypeAnnotation', kind: 'simple', name: 'weak', line, column };
  }
}

export function resolve(annotation: TypeAnnotation): Type {
  switch (annotation.kind) {
    case 'simple':
      switch (annotation.name) {
        case 'int':
          return { kind: 'int' };
        case 'float':
          return { kind: 'float' };
        case 'string':
          return { kind: 'string' };
        case 'boolean':
          return { kind: 'boolean' };
        case 'void':
          return { kind: 'void' };
        case 'weak':
          return { kind: 'weak' };
        case 'poly':
          return { kind: 'poly' };
        case 'Range':
          return { kind: 'range' };
        default:
          throw new Error(`Type checking: unknown simple type ${annotation.name}`);
      }

    case 'generic':
      if (!annotation.typeParameters) {
        throw new Error(`Type checking: generic type ${annotation.name} requires type parameters`);
      }
      if (annotation.name === 'Array') {
        if (annotation.typeParameters.length !== 1) throw new Error(`Array type requires exactly one type parameter`);
        return {
          kind: 'array',
          elementType: resolve(annotation.typeParameters[0]),
        };
      }
      if (annotation.name === 'Map') {
        if (annotation.typeParameters.length !== 2) throw new Error(`Map type requires exactly two type parameters`);
        return {
          kind: 'map',
          keyType: resolve(annotation.typeParameters[0]),
          valueType: resolve(annotation.typeParameters[1]),
        };
      }
      if (annotation.name === 'Set') {
        if (annotation.typeParameters.length !== 1) throw new Error(`Set type requires exactly one type parameter`);
        return {
          kind: 'set',
          elementType: resolve(annotation.typeParameters[0]),
        };
      }
      if (annotation.name === 'MinHeap' || annotation.name === 'MaxHeap') {
        if (annotation.typeParameters.length !== 1) throw new Error(`${annotation.name} type requires exactly one type parameter`);
        return {
          kind: 'heap',
          elementType: resolve(annotation.typeParameters[0]),
        };
      }
      if (annotation.name === 'MinHeapMap' || annotation.name === 'MaxHeapMap') {
        if (annotation.typeParameters.length !== 2) throw new Error(`${annotation.name} type requires exactly two type parameters`);
        return {
          kind: 'heapmap',
          keyType: resolve(annotation.typeParameters[0]),
          valueType: resolve(annotation.typeParameters[1]),
        };
      }
      if (annotation.name === 'Graph') {
        if (annotation.typeParameters.length !== 1) throw new Error(`Graph type requires exactly one type parameter`);
        return {
          kind: 'graph',
          nodeType: resolve(annotation.typeParameters[0]),
        };
      }
      if (annotation.name === 'BinaryTree') {
        if (annotation.typeParameters.length !== 1) throw new Error(`BinaryTree type requires exactly one type parameter`);
        return {
          kind: 'binarytree',
          elementType: resolve(annotation.typeParameters[0]),
        };
      }
      if (annotation.name === 'AVLTree') {
        if (annotation.typeParameters.length !== 1) throw new Error(`AVLTree type requires exactly one type parameter`);
        return {
          kind: 'avltree',
          elementType: resolve(annotation.typeParameters[0]),
        };
      }
      throw new Error(`Type checking: unknown generic type ${annotation.name}`);

    case 'union':
      return {
        kind: 'union',
        types: annotation.types.map((t) => resolve(t)),
      };

    case 'intersection':
      return {
        kind: 'intersection',
        types: annotation.types.map((t) => resolve(t)),
      };

    case 'function':
      return {
        kind: 'function',
        parameters: annotation.parameterTypes!.map((t) => resolve(t)),
        returnType: resolve(annotation.returnType!),
      };

    case 'tuple':
      return {
        kind: 'tuple',
        elementTypes: annotation.elementTypes!.map((t) => resolve(t)),
      };

    case 'record':
      return {
        kind: 'record',
        fieldTypes: annotation.fieldTypes!.map(([keyType, valueType]) => [
          resolve(keyType),
          resolve(valueType),
        ]),
      };
  }
}
