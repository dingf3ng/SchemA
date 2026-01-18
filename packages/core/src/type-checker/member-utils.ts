import { MemberExpression } from "../transpiler/ast-types";
import { Type, typeToString } from "./type-checker-utils";

export function synthMemberExpression(expr: MemberExpression, objectType: Type): Type {
  // Handle weak types - they are polymorphic placeholders that haven't been refined yet
  // During inference, we may encounter weak types before refinement occurs.
  // Return weak to allow inference to continue - the type will be refined later.
  if (objectType.kind === 'weak') {
    return { kind: 'weak' };
  }

  // Handle dynamic types - member access on dynamic returns dynamic
  if (objectType.kind === 'dynamic') {
    return { kind: 'dynamic' };
  }

  // Handle built-in data structure methods
  // Arrays, Maps, Sets, Heaps, HeapMaps, BinaryTrees, AVLTrees, Graphs
  if (objectType.kind === 'array') {
    return synthArrayMember(expr, objectType);
  } else if (objectType.kind === 'map') {
    return synthMapMember(expr, objectType);
  } else if (objectType.kind === 'set') {
    return synthSetMember(expr, objectType);
  } else if (objectType.kind === 'heap') {
    return synthHeapMember(expr, objectType);
  } else if (objectType.kind === 'heapmap') {
    return synthHeapMapMember(expr, objectType);
  } else if (objectType.kind === 'binarytree') {
    return synthTreeMember(expr, objectType);
  } else if (objectType.kind === 'graph') {
    return synthGraphMember(expr, objectType);
  } else {
    throw new Error(
      `Type checking: property "${expr.property.name}" does not exist on type ${typeToString(objectType)}, at ${expr.line}, ${expr.column}`
    );
  }
}

export function synthArrayMember(expr: MemberExpression, objectType: { kind: 'array'; elementType: Type }): Type {
  if (expr.property.name === 'length') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'push') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'pop') {
    return {
      kind: 'function',
      parameters: [],
      returnType: objectType.elementType,
    };
  } else if (expr.property.name === 'isEmpty') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'append') {
    return {
      kind: 'function',
      parameters: [{ kind: 'array', elementType: objectType.elementType }],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'reverse') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'clear') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else {
    throw new Error(
      `Type checking: unknown array member "${expr.property.name}", at ${expr.line}, ${expr.column}`
    );
  }
}

export function synthMapMember(expr: MemberExpression, objectType: { kind: 'map'; keyType: Type; valueType: Type }): Type {
  if (expr.property.name === 'size') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'get') {
    return {
      kind: 'function',
      parameters: [objectType.keyType],
      returnType: objectType.valueType,
    };
  } else if (expr.property.name === 'set') {
    return {
      kind: 'function',
      parameters: [objectType.keyType, objectType.valueType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'has') {
    return {
      kind: 'function',
      parameters: [objectType.keyType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'keys') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.keyType },
    };
  } else if (expr.property.name === 'values') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.valueType },
    };
  } else if (expr.property.name === 'entries') {
    // Returns Array<(keyType, valueType)>
    return {
      kind: 'function',
      parameters: [],
      returnType: {
        kind: 'array',
        elementType: {
          kind: 'tuple',
          elementTypes: [objectType.keyType, objectType.valueType],
        },
      },
    };
  } else if (expr.property.name === 'delete') {
    return {
      kind: 'function',
      parameters: [objectType.keyType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'clear') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'isEmpty') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'getOrDefault') {
    return {
      kind: 'function',
      parameters: [objectType.keyType, objectType.valueType],
      returnType: objectType.valueType,
    };
  } else {
    throw new Error(
      `Type checking: property "${expr.property.name}" does not exist on map type, at ${expr.line}, ${expr.column}`
    );
  }
}

export function synthSetMember(expr: MemberExpression, objectType: { kind: 'set'; elementType: Type }): Type {
  if (expr.property.name === 'size') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'add') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'has') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'delete') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'clear') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'isEmpty') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'toArray') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'union') {
    return {
      kind: 'function',
      parameters: [{ kind: 'set', elementType: objectType.elementType }],
      returnType: { kind: 'set', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'intersection') {
    return {
      kind: 'function',
      parameters: [{ kind: 'set', elementType: objectType.elementType }],
      returnType: { kind: 'set', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'difference') {
    return {
      kind: 'function',
      parameters: [{ kind: 'set', elementType: objectType.elementType }],
      returnType: { kind: 'set', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'values') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else {
    throw new Error(
      `Type checking: property "${expr.property.name}" does not exist on set type, at ${expr.line}, ${expr.column}`
    );
  }
}

function synthHeapMember(expr: MemberExpression, objectType: { kind: 'heap', elementType: Type }): Type {
  if (expr.property.name === 'push') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'pop') {
    return {
      kind: 'function',
      parameters: [],
      returnType: objectType.elementType,
    };
  } else if (expr.property.name === 'peek') {
    return {
      kind: 'function',
      parameters: [],
      returnType: objectType.elementType,
    };
  } else if (expr.property.name === 'size') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' }
    };
  } else if (expr.property.name === 'isEmpty') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'clear') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'toArray') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else {
    throw new Error(
      `Type checking: unknown heap member "${expr.property.name}", at ${expr.line}, ${expr.column}`
    );
  }
}

function synthHeapMapMember(expr: MemberExpression, objectType: { kind: 'heapmap', keyType: Type, valueType: Type }): Type {
  if (objectType.kind === 'heapmap') {
    if (expr.property.name === 'push') {
      return {
        kind: 'function',
        parameters: [objectType.keyType, objectType.valueType],
        returnType: { kind: 'void' },
      };
    } else if (expr.property.name === 'pop') {
      return {
        kind: 'function',
        parameters: [],
        returnType: objectType.keyType,
      };
    } else if (expr.property.name === 'peek') {
      return {
        kind: 'function',
        parameters: [],
        returnType: objectType.keyType,
      };
    } else if (expr.property.name === 'size') {
      return {
        kind: 'function',
        parameters: [],
        returnType: { kind: 'int' }
      };
    } else if (expr.property.name === 'isEmpty') {
      return {
        kind: 'function',
        parameters: [],
        returnType: { kind: 'boolean' },
      };
    } else if (expr.property.name === 'has') {
      return {
        kind: 'function',
        parameters: [objectType.keyType],
        returnType: { kind: 'boolean' },
      };
    } else if (expr.property.name === 'getPriority') {
      return {
        kind: 'function',
        parameters: [objectType.keyType],
        returnType: objectType.valueType,
      };
    } else if (expr.property.name === 'updatePriority') {
      return {
        kind: 'function',
        parameters: [objectType.keyType, objectType.valueType],
        returnType: { kind: 'void' },
      };
    } else if (expr.property.name === 'delete') {
      return {
        kind: 'function',
        parameters: [objectType.keyType],
        returnType: { kind: 'void' },
      };
    } else if (expr.property.name === 'clear') {
      return {
        kind: 'function',
        parameters: [],
        returnType: { kind: 'void' },
      };
    } else if (expr.property.name === 'entries') {
      return {
        kind: 'function',
        parameters: [],
        returnType: {
          kind: 'array',
          elementType: {
            kind: 'tuple',
            elementTypes: [objectType.keyType, objectType.valueType],
          },
        },
      };
    } else {
      throw new Error(
        `Type checking: unknown heapmap member "${expr.property.name}", at ${expr.line}, ${expr.column}`
      );
    }
  } else {
    throw new Error(`Internal: Should be called with heapmap member access only`);
  }
}

export function synthTreeMember(expr: MemberExpression, objectType: { kind: 'binarytree' | 'avltree', elementType: Type }): Type {
  if (expr.property.name === 'insert') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'search') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'getHeight') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'delete') {
    return {
      kind: 'function',
      parameters: [objectType.elementType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'min') {
    return {
      kind: 'function',
      parameters: [],
      returnType: objectType.elementType,
    };
  } else if (expr.property.name === 'max') {
    return {
      kind: 'function',
      parameters: [],
      returnType: objectType.elementType,
    };
  } else if (expr.property.name === 'size') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'isEmpty') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'inorder') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'preorder') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'postorder') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'clear') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'left') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'binarytree', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'right') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'binarytree', elementType: objectType.elementType },
    };
  } else if (expr.property.name === 'value') {
    return {
      kind: 'function',
      parameters: [],
      returnType: objectType.elementType,
    };
  } else {
    throw new Error(
      `Type checking: unknown tree member "${expr.property.name}", at ${expr.line}, ${expr.column}`
    );
  }
}

export function synthGraphMember(expr: MemberExpression, objectType: { kind: 'graph', nodeType: Type }): Type {
  if (expr.property.name === 'addVertex') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'addEdge') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType, objectType.nodeType, { kind: 'int' }],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'getNeighbors') {
    // Returns Array<{ to: nodeType, weight: int }>
    const edgeRecordType: Type = {
      kind: 'record',
      fieldTypes: [
        ['to', objectType.nodeType],
        ['weight', { kind: 'int' }],
      ],
    };
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: {
        kind: 'array',
        elementType: edgeRecordType,
      },
    };
  } else if (expr.property.name === 'hasVertex') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'hasEdge') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType, objectType.nodeType],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'size') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'isDirected') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'getEdges') {
    // Returns Array<{ from: nodeType, to: nodeType, weight: int }>
    const edgeWithFromRecordType: Type = {
      kind: 'record',
      fieldTypes: [
        ['from', objectType.nodeType],
        ['to', objectType.nodeType],
        ['weight', { kind: 'int' }],
      ],
    };
    return {
      kind: 'function',
      parameters: [],
      returnType: {
        kind: 'array',
        elementType: edgeWithFromRecordType,
      },
    };
  } else if (expr.property.name === 'getVertices') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'array', elementType: objectType.nodeType },
    };
  } else if (expr.property.name === 'removeVertex') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'removeEdge') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType, objectType.nodeType],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'getEdgeWeight') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType, objectType.nodeType],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'setEdgeWeight') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType, objectType.nodeType, { kind: 'int' }],
      returnType: { kind: 'void' },
    };
  } else if (expr.property.name === 'degree') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'inDegree') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'outDegree') {
    return {
      kind: 'function',
      parameters: [objectType.nodeType],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'edgeCount') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'int' },
    };
  } else if (expr.property.name === 'isEmpty') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'boolean' },
    };
  } else if (expr.property.name === 'clear') {
    return {
      kind: 'function',
      parameters: [],
      returnType: { kind: 'void' },
    };
  } else {
    throw new Error(
      `Type checking: unknown graph member "${expr.property.name}", at ${expr.line}, ${expr.column}`
    );
  }
}
