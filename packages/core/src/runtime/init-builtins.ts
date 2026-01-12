import {
  AVLTree,
  BinaryTree,
  Graph,
  MaxHeap,
  MaxHeapMap,
  MinHeap,
  MinHeapMap,
  SchemaMap,
  SchemaSet
} from "../builtins/data-structures";
import { Environment } from "./environment";
import { RuntimeTypedBinder, runtimeTypedBinderToString } from "./runtime-utils";

export function initializeBuiltins(glbEnv: Environment, outRef: string[]): Environment {
  glbEnv.define('print', {
    value: {
      fn: (...args: RuntimeTypedBinder[]) => {
        const output = args.map(runtimeTypedBinderToString).join(' ');
        outRef.push(output);
        return {
          value: undefined,
          type: { static: { kind: 'void' }, refinements: [] }
        };
      },
    },
    type: {
      static: {
        kind: 'function',
        parameters: [{ kind: 'dynamic' }],
        returnType: { kind: 'void' },
        variadic: true
      },
      refinements: []
    },
  });

  glbEnv.define('MinHeap', {
    value: {
      fn: () => {
        return {
          value: new MinHeap<RuntimeTypedBinder>(),
          type: {
            static: { kind: 'heap', elementType: { kind: 'weak' } },
            refinements: []
          }
        };
      },
    },
    type: {
      static: {
        kind: 'function',
        parameters: [],
        returnType: {
          kind: 'heap',
          elementType: { kind: 'weak' }
        }
      },
      refinements: []
    },
  });

  glbEnv.define('MaxHeap', {
    value: {
      fn: () => {
        return {
          value: new MaxHeap<RuntimeTypedBinder>(),
          type: {
            static: { kind: 'heap', elementType: { kind: 'weak' } },
            refinements: []
          }
        };
      }
    },
    type: {
      static: {
        kind: 'function',
        parameters: [],
        returnType: {
          kind: 'heap',
          elementType: { kind: 'weak' }
        }
      },
      refinements: []
    },
  });

  glbEnv.define('MinHeapMap', {
    value: {
      fn: () => ({
        value: new MinHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>(),
        type: {
          static: {
            kind: 'heapmap',
            keyType: { kind: 'weak' },
            valueType: { kind: 'weak' }
          },
          refinements: []
        }
      }),
    },
    type: {
      static: {
        kind: 'function',
        parameters: [],
        returnType: {
          kind: 'heapmap',
          keyType: { kind: 'weak' },
          valueType: { kind: 'weak' }
        }
      },
      refinements: []
    },
  });

  glbEnv.define('MaxHeapMap', {
    value: {
      fn: () => ({
        value: new MaxHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>(),
        type: {
          static: {
            kind: 'heapmap',
            keyType: { kind: 'weak' },
            valueType: { kind: 'weak' }
          },
          refinements: []
        }
      }),
    },
    type: {
      static: {
        kind: 'function',
        parameters: [],
        returnType: {
          kind: 'heapmap',
          keyType: { kind: 'weak' },
          valueType: { kind: 'weak' }
        }
      }, refinements: []
    },
  });

  glbEnv.define('Map', {
    value: {
      fn: () => ({ value: new SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>(), type: { static: { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } }, refinements: [] } }),
    },
    type: { static: { kind: 'function', parameters: [], returnType: { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } } }, refinements: [] },
  });

  glbEnv.define('Set', {
    value: {
      fn: () => ({ value: new SchemaSet<RuntimeTypedBinder>(), type: { static: { kind: 'set', elementType: { kind: 'weak' } }, refinements: [] } }),
    },
    type: { static: { kind: 'function', parameters: [], returnType: { kind: 'set', elementType: { kind: 'weak' } } }, refinements: [] },
  });

  glbEnv.define('Graph', {
    value: {
      fn: (directed?: RuntimeTypedBinder) => {
        const isDirected = directed && directed.type.static.kind === 'boolean' ? directed.value as boolean : false;
        const keyFn = (node: RuntimeTypedBinder) => {
          if (node.type.static.kind === 'int' || node.type.static.kind === 'float' ||
            node.type.static.kind === 'string' || node.type.static.kind === 'boolean') {
            return node.value;
          }
          return node;
        };
        return { value: new Graph<RuntimeTypedBinder>(isDirected, keyFn), type: { static: { kind: 'graph', nodeType: { kind: 'weak' } }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'boolean' }], returnType: { kind: 'graph', nodeType: { kind: 'weak' } } }, refinements: [] },
  });

  glbEnv.define('BinaryTree', {
    value: {
      fn: () => ({
        value: new BinaryTree<RuntimeTypedBinder>((a, b) => {
          const aVal = a.value!;
          const bVal = b.value!;
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        }),
        type: { static: { kind: 'binarytree', elementType: { kind: 'weak' } }, refinements: [] }
      }),
    },
    type: { static: { kind: 'function', parameters: [], returnType: { kind: 'binarytree', elementType: { kind: 'weak' } } }, refinements: [] },
  });

  glbEnv.define('AVLTree', {
    value: {
      fn: () => ({
        value: new AVLTree<RuntimeTypedBinder>((a, b) => {
          const aVal = a.value!;
          const bVal = b.value!;
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        }),
        type: { static: { kind: 'binarytree', elementType: { kind: 'weak' } }, refinements: [] }
      }),
    },
    type: { static: { kind: 'function', parameters: [], returnType: { kind: 'binarytree', elementType: { kind: 'weak' } } }, refinements: [] },
  });

  glbEnv.define('int_inf', {
    value: Infinity,
    type: { static: { kind: 'int' }, refinements: [] },
  });

  glbEnv.define('float_inf', {
    value: Infinity,
    type: { static: { kind: 'float' }, refinements: [] },
  });

  glbEnv.define('len', {
    value: {
      fn: (str: RuntimeTypedBinder) => {
        const stringValue = str.value as string;
        return { value: stringValue.length, type: { static: { kind: 'int' }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'string' }], returnType: { kind: 'int' } }, refinements: [] },
  });

  glbEnv.define('int_min', {
    value: {
      fn: (...args: RuntimeTypedBinder[]) => {
        if (args.length === 0) throw new Error('min() requires at least one argument');
        const numbers = args.map(arg => arg.value as number);
        const minValue = Math.min(...numbers);
        const hasFloat = args.some(arg => arg.type.static.kind === 'float');
        return { value: minValue, type: { static: { kind: hasFloat ? 'float' : 'int' }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'int' }], returnType: { kind: 'int' }, variadic: true }, refinements: [] },
  });

  glbEnv.define('int_max', {
    value: {
      fn: (...args: RuntimeTypedBinder[]) => {
        if (args.length === 0) throw new Error('max() requires at least one argument');
        const numbers = args.map(arg => arg.value as number);
        const maxValue = Math.max(...numbers);
        const hasFloat = args.some(arg => arg.type.static.kind === 'float');
        return { value: maxValue, type: { static: { kind: hasFloat ? 'float' : 'int' }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'int' }], returnType: { kind: 'int' }, variadic: true }, refinements: [] },
  });

  glbEnv.define('int_abs', {
    value: {
      fn: (arg: RuntimeTypedBinder) => {
        const num = arg.value as number;
        const absValue = Math.abs(num);
        return { value: absValue, type: { static: { kind: arg.type.static.kind }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'int' }], returnType: { kind: 'int' } }, refinements: [] },
  });

  glbEnv.define('float_min', {
    value: {
      fn: (...args: RuntimeTypedBinder[]) => {
        if (args.length === 0) throw new Error('min() requires at least one argument');
        const numbers = args.map(arg => arg.value as number);
        const minValue = Math.min(...numbers);
        return { value: minValue, type: { static: { kind: 'float' }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'float' }], returnType: { kind: 'float' }, variadic: true }, refinements: [] },
  });
  
  glbEnv.define('float_max', {
    value: {
      fn: (...args: RuntimeTypedBinder[]) => {
        if (args.length === 0) throw new Error('max() requires at least one argument');
        const numbers = args.map(arg => arg.value as number);
        const maxValue = Math.max(...numbers);
        return { value: maxValue, type: { static: { kind: 'float' }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'float' }], returnType: { kind: 'float' }, variadic: true }, refinements: [] },
  });

  glbEnv.define('float_abs', {
    value: {
      fn: (arg: RuntimeTypedBinder) => {
        const num = arg.value as number;
        const absValue = Math.abs(num);
        return { value: absValue, type: { static: { kind: arg.type.static.kind }, refinements: [] } };
      },
    },
    type: { static: { kind: 'function', parameters: [{ kind: 'float' }], returnType: { kind: 'float' } }, refinements: [] },
  });
  return glbEnv;
}
