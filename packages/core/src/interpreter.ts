import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  VariableDeclaration,
  AssignmentStatement,
  IfStatement,
  WhileStatement,
  UntilStatement,
  ForStatement,
  ReturnStatement,
  BlockStatement,
  ExpressionStatement,
  TypeAnnotation,
  Parameter,
} from './types';
import { RuntimeTypedBinder, RuntimeTypedBinderToString } from './runtime/values';
import { Environment } from './runtime/environment';
import { Type } from './typechecker';
import {
  SchemaArray,
  SchemaMap,
  SchemaSet,
  MinHeap,
  MaxHeap,
  MinHeapMap,
  MaxHeapMap,
  Graph,
  LazyRange,
  BinaryTree,
  AVLTree,
} from './runtime/data-structures';

class ReturnException {
  constructor(public value: RuntimeTypedBinder) { }
}

export class Interpreter {
  private globalEnv: Environment = new Environment();
  private currentEnv: Environment;
  private output: string[] = [];

  constructor() {
    this.currentEnv = this.globalEnv;
    this.initializeBuiltins();
  }



  private initializeBuiltins(): void {
    this.globalEnv.define('print', {
      value: {
        fn: (...args: RuntimeTypedBinder[]) => {
          const output = args.map(RuntimeTypedBinderToString).join(' ');
          this.output.push(output);
          return { value: undefined, type: { static: { kind: 'void' }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [{ kind: 'poly' }], returnType: { kind: 'void' }, variadic: true }, refinements: [] },
    });

    this.globalEnv.define('MinHeap', {
      value: {
        fn: () => {
          return { value: new MinHeap<RuntimeTypedBinder>(), type: { static: { kind: 'heap', elementType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'heap', elementType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('MaxHeap', {
      value: {
        fn: () => {
          return { value: new MaxHeap<RuntimeTypedBinder>(), type: { static: { kind: 'heap', elementType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'heap', elementType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('MinHeapMap', {
      value: {
        fn: () => {
          return { value: new MinHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>(), type: { static: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('MaxHeapMap', {
      value: {
        fn: () => {
          return { value: new MaxHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>(), type: { static: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('Graph', {
      value: {
        fn: (directed?: RuntimeTypedBinder) => {
          const isDirected =
            directed && directed.type.static.kind === 'boolean' ? directed.value as boolean : false;
          
          const keyFn = (node: RuntimeTypedBinder) => {
             if (node.type.static.kind === 'int' || node.type.static.kind === 'float' || node.type.static.kind === 'string' || node.type.static.kind === 'boolean') {
               return node.value;
             }
             return node;
          };

          return { value: new Graph<RuntimeTypedBinder>(isDirected, keyFn), type: { static: { kind: 'graph', nodeType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [{ kind: 'boolean' }], returnType: { kind: 'graph', nodeType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('Map', {
      value: {
        fn: () => {
          return { value: new SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>(), type: { static: { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('Set', {
      value: {
        fn: () => {
          return { value: new SchemaSet<RuntimeTypedBinder>(), type: { static: { kind: 'set', elementType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'set', elementType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('BinaryTree', {
      value: {
        fn: () => {
          return { value: new BinaryTree<RuntimeTypedBinder>(), type: { static: { kind: 'binarytree', elementType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'binarytree', elementType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('AVLTree', {
      value: {
        fn: () => {
          return { value: new AVLTree<RuntimeTypedBinder>(), type: { static: { kind: 'avltree', elementType: { kind: 'weak' } }, refinements: [] } };
        },
      },
      type: { static: { kind: 'function', parameters: [], returnType: { kind: 'avltree', elementType: { kind: 'weak' } } }, refinements: [] },
    });

    this.globalEnv.define('inf', {
      value: Infinity,
      type: { static: { kind: 'intersection', types: [{ kind: 'int' }, { kind: 'float' }] }, refinements: [] },
    });
  }

  public evaluate(program: Program): string[] {
    this.output = [];

    for (const statement of program.body) {
      this.evaluateStatement(statement);
    }

    return this.output;
  }

  public getOutput(): string[] {
    return this.output;
  }

  private evaluateStatement(stmt: Statement): void {
    try {
      switch (stmt.type) {
        case 'FunctionDeclaration':
          this.evaluateFunctionDeclaration(stmt);
          break;
        case 'VariableDeclaration':
          this.evaluateVariableDeclaration(stmt);
          break;
        case 'AssignmentStatement':
          this.evaluateAssignmentStatement(stmt);
          break;
        case 'IfStatement':
          this.evaluateIfStatement(stmt);
          break;
        case 'WhileStatement':
          this.evaluateWhileStatement(stmt);
          break;
        case 'UntilStatement':
          this.evaluateUntilStatement(stmt);
          break;
        case 'ForStatement':
          this.evaluateForStatement(stmt);
          break;
        case 'ReturnStatement':
          this.evaluateReturnStatement(stmt);
          break;
        case 'BlockStatement':
          this.evaluateBlockStatement(stmt);
          break;
        case 'ExpressionStatement':
          this.evaluateExpression(stmt.expression);
          break;
      }
    } catch (e) {
      if (e instanceof ReturnException) {
        throw e;
      }
      throw e;
    }
  }

  private evaluateFunctionDeclaration(stmt: FunctionDeclaration): void {
    const paramTypes = stmt.parameters.map(p => this.resolveTypeAnnotation(p.typeAnnotation));
    const returnType = this.resolveTypeAnnotation(stmt.returnType);

    const funcValue: RuntimeTypedBinder = {
      value: {
        parameters: stmt.parameters,
        body: stmt.body,
        closure: this.captureEnvironment(),
      },
      type: {
        static: {
          kind: 'function',
          parameters: paramTypes,
          returnType: returnType
        },
        refinements: []
      },
    };

    this.currentEnv.define(stmt.name, funcValue);
  }

  private evaluateVariableDeclaration(stmt: VariableDeclaration): void {
    for (const declarator of stmt.declarations) {
      let value: RuntimeTypedBinder;

      if (declarator.initializer) {
        value = this.evaluateExpression(declarator.initializer);
      } else {
        // No initializer - create undefined value with type annotation
        const declaredType = this.resolveTypeAnnotation(declarator.typeAnnotation);
        value = {
          value: undefined,
          type: { static: declaredType, refinements: [] }
        };
      }

      // Skip binding if the variable name is '_' (unnamed variable)
      if (declarator.name !== '_') {
        this.currentEnv.define(declarator.name, value);
      }
    }
  }

  private captureEnvironment(): Environment {
    return this.currentEnv;
  }

  /**
   * Helper to resolve TypeAnnotation to Type, note that we should have fully annotated types at this point
   * @param annotation The TypeAnnotation to resolve
   * @returns the resolved Type
   */
  private resolveTypeAnnotation(annotation: TypeAnnotation | undefined): Type {
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
          return { kind: 'array', elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]) };
        case 'Map':
          return { kind: 'map', keyType: this.resolveTypeAnnotation(annotation.typeParameters[0]), valueType: this.resolveTypeAnnotation(annotation.typeParameters[1]) };
        case 'Set':
          return { kind: 'set', elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]) };
        case 'MinHeap': case 'MaxHeap':
          return { kind: 'heap', elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]) };
        case 'MinHeapMap': case 'MaxHeapMap':
          return { kind: 'heapmap', keyType: this.resolveTypeAnnotation(annotation.typeParameters[0]), valueType: this.resolveTypeAnnotation(annotation.typeParameters[1]) };
        case 'Graph':
          return { kind: 'graph', nodeType: this.resolveTypeAnnotation(annotation.typeParameters[0]) };
        case 'BinaryTree':
          return { kind: 'binarytree', elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]) };
        case 'AVLTree':
          return { kind: 'avltree', elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]) };
        default: throw new Error(`Unknown generic type annotation: ${annotation.name}`);
      }
    } else if (annotation.kind === 'function') {
      return {
        kind: 'function',
        parameters: annotation.parameterTypes ? annotation.parameterTypes.map((p: TypeAnnotation) => this.resolveTypeAnnotation(p)) : [],
        returnType: this.resolveTypeAnnotation(annotation.returnType)
      };
    } else if (annotation.kind === 'union') {
      return { kind: 'union', types: annotation.types.map((t: TypeAnnotation) => this.resolveTypeAnnotation(t)) };
    } else if (annotation.kind === 'intersection') {
      return { kind: 'intersection', types: annotation.types.map((t: TypeAnnotation) => this.resolveTypeAnnotation(t)) };
    } else if (annotation.kind === 'tuple') {
      return { kind: 'tuple', elementTypes: annotation.elementTypes.map((t: TypeAnnotation) => this.resolveTypeAnnotation(t)) };
    } else if (annotation.kind === 'record') {
      const fieldTypes: [Type, Type][] = annotation.fieldTypes.map(([keyType, valueType]) => {
        return [this.resolveTypeAnnotation(keyType), this.resolveTypeAnnotation(valueType)];
      });
      return { kind: 'record', fieldTypes };
    }
    throw new Error('Internal Error: Unknown type annotation kind');
  }

  private evaluateAssignmentStatement(stmt: AssignmentStatement): void {
    const value = this.evaluateExpression(stmt.value);

    // Handle simple identifier assignment
    if (stmt.target.type === 'Identifier') {
      // Cannot assign to underscore
      if (stmt.target.name === '_') {
        throw new Error('Cannot assign to underscore (_)');
      }
      // Check if variable exists (will throw if undefined during lookup)
      try {
        this.evaluateExpression(stmt.target); // This will throw if variable doesn't exist
      } catch (e) {
        throw new Error(`Cannot assign to undeclared variable: ${stmt.target.name}`);
      }
      // Update the variable in the current environment
      this.currentEnv.set(stmt.target.name, value);
      return;
    }

    // Handle member expression assignment (e.g., obj.prop = value)
    if (stmt.target.type === 'MemberExpression') {
      const object = this.evaluateExpression(stmt.target.object);
      const propertyName = stmt.target.property.name;

      if (object.type.static.kind === 'map') {
        (object.value as SchemaMap<any, RuntimeTypedBinder>).set(propertyName, value);
        return;
      }

      throw new Error(`Cannot assign to property ${propertyName}`);
    }

    // Handle index expression assignment (e.g., arr[0] = value)
    if (stmt.target.type === 'IndexExpression') {
      const object = this.evaluateExpression(stmt.target.object);
      const index = this.evaluateExpression(stmt.target.index);

      if (object.type.static.kind === 'array' && index.type.static.kind === 'int') {
        (object.value as SchemaArray<RuntimeTypedBinder>).set(index.value as number, value);
        return;
      }

      if (object.type.static.kind === 'map') {
        const key = this.RuntimeTypeBinderToKey(index);
        (object.value as SchemaMap<any, RuntimeTypedBinder>).set(key, value);
        return;
      }

      throw new Error('Invalid assignment target');
    }

    throw new Error('Invalid assignment target');
  }

  private evaluateIfStatement(stmt: IfStatement): void {
    const condition = this.evaluateExpression(stmt.condition);

    if (condition.type.static.kind !== 'boolean') {
      throw new Error('If condition must be boolean');
    }
    if (condition.value as boolean) {
      this.evaluateStatement(stmt.thenBranch);
    } else if (stmt.elseBranch) {
      this.evaluateStatement(stmt.elseBranch);
    }
  }

  private evaluateWhileStatement(stmt: WhileStatement): void {
    while (true) {
      const condition = this.evaluateExpression(stmt.condition);
      if (condition.type.static.kind !== 'boolean') {
        throw new Error('While condition must be boolean');
      }
      if (!(condition.value as boolean)) break;
      this.evaluateStatement(stmt.body);
    }
  }

  private evaluateUntilStatement(stmt: UntilStatement): void {
    while (true) {
      const condition = this.evaluateExpression(stmt.condition);
      if (condition.type.static.kind !== 'boolean') {
        throw new Error('Until condition must be boolean');
      }
      if (condition.value as boolean) break;
      this.evaluateStatement(stmt.body);
    }
  }

  private evaluateForStatement(stmt: ForStatement): void {
    const iterable = this.evaluateExpression(stmt.iterable);

    const savedEnv = this.currentEnv;
    this.currentEnv = new Environment(savedEnv);

    if (iterable.type.static.kind === 'array') {
      (iterable.value as SchemaArray<RuntimeTypedBinder>).forEach((item) => {
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, item);
        }
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type.static.kind === 'set') {
      (iterable.value as SchemaSet<RuntimeTypedBinder>).forEach((item) => {
        // Items in sets are already RuntimeTypedBinders
        const runtimeItem = item as RuntimeTypedBinder;
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, runtimeItem);
        }
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type.static.kind === 'map') {
      (iterable.value as SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>).forEach((value, key) => {
        // Keys in maps are already RuntimeTypedBinders
        const runtimeKey = key as RuntimeTypedBinder;
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, runtimeKey);
        }
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type.static.kind === 'range') {
      (iterable.value as LazyRange).generate();
      // Support for infinite ranges - use the generator
      for (const value of (iterable.value as LazyRange).generate()) {
        const runtimeValue: RuntimeTypedBinder = { value, type: { static: { kind: 'int' }, refinements: [] } };
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, runtimeValue);
        }
        this.evaluateStatement(stmt.body);
      }
    }

    this.currentEnv = savedEnv;
  }

  private evaluateReturnStatement(stmt: ReturnStatement): void {
    const value = stmt.value
      ? this.evaluateExpression(stmt.value)
      : { type: { static: { kind: 'void' as const }, refinements: [] }, value: undefined };
    throw new ReturnException(value);
  }

  private evaluateBlockStatement(stmt: BlockStatement): void {
    const savedEnv = this.currentEnv;
    this.currentEnv = new Environment(savedEnv);

    for (const statement of stmt.statements) {
      this.evaluateStatement(statement);
    }

    this.currentEnv = savedEnv;
  }

  private evaluateExpression(expr: Expression): RuntimeTypedBinder {
    switch (expr.type) {
      case 'IntegerLiteral':
        return { value: expr.value, type: { static: { kind: 'int' }, refinements: [] } };

      case 'FloatLiteral':
        return { value: expr.value, type: { static: { kind: 'float' }, refinements: [] } };

      case 'StringLiteral':
        return { value: expr.value, type: { static: { kind: 'string' }, refinements: [] } };

      case 'BooleanLiteral':
        return { value: expr.value, type: { static: { kind: 'boolean' }, refinements: [] } };

      case 'ArrayLiteral': {
        const elements = expr.elements.map((e) => this.evaluateExpression(e));
        const elementType = elements.length > 0 ? elements[0].type.static : { kind: 'poly' as const };
        return {
          value: new SchemaArray(elements),
          type: { static: { kind: 'array', elementType }, refinements: [] }
        };
      }

      case 'Identifier': {
        // Underscore cannot be used as a value
        if (expr.name === '_') {
          throw new Error('Underscore (_) cannot be used as a value');
        }
        const value = this.currentEnv.get(expr.name);
        if (value === undefined) {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        return value;
      }

      case 'BinaryExpression':
        return this.evaluateBinaryExpression(expr);

      case 'UnaryExpression': {
        const operand = this.evaluateExpression(expr.operand);

        if (expr.operator === '-') {
          if (operand.type.static.kind === 'int') {
            return { value: -(operand.value as number), type: { static: { kind: 'int' }, refinements: [] } };
          } else if (operand.type.static.kind === 'float') {
            return { value: -(operand.value as number), type: { static: { kind: 'float' }, refinements: [] } };
          } else {
            throw new Error('Unary minus requires int or float operand');
          }
        }

        if (expr.operator === '!') {
          if (operand.type.static.kind !== 'boolean') {
            throw new Error('Logical NOT requires boolean operand');
          }
          return { value: !(operand.value as boolean), type: { static: { kind: 'boolean' }, refinements: [] } };
        }

        throw new Error(`Unknown unary operator: ${expr.operator}`);
      }

      case 'CallExpression':
        return this.evaluateCallExpression(expr);

      case 'MemberExpression': {
        const object = this.evaluateExpression(expr.object);
        const propertyName = expr.property.name;

        if (object.type.static.kind === 'array') {
          if (propertyName === 'length') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: object.type.static.elementType }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaArray)) {
                    throw new Error('Array value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.length }
                }
              }
            };
          }
          if (propertyName === 'push') {
            return {
              type: { static: { kind: 'function', parameters: [object.type.static.elementType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (item: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaArray)) {
                    throw new Error('Internal: Array value is undefined or invalid');
                  }
                  object.value.push(item);
                  return { value: undefined, type: { static: { kind: 'void' }, refinements: [] } }
                }
              }
            }
          }
          if (propertyName === 'pop') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: object.type.static.elementType }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaArray)) {
                    throw new Error('Internal: Array value is undefined or invalid');
                  }
                  let poped = object.value.pop();
                  if (!poped) { 
                    throw new Error(`Error: cannot pop from an empty array at ${expr.object.line}:${expr.object.column}`);
                  }
                  return poped;
                }
              }
            };
          }
        }

        if (object.type.static.kind === 'map') {
          const mapType = object.type.static as { kind: 'map'; keyType: Type; valueType: Type };
          if (propertyName === 'size') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value:  object.value.size };
                }
              }
            };
          }
          if (propertyName === 'get') {
            return {
              type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: mapType.valueType }, refinements: [] },
              value: {
                fn: (key: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(key);
                  return object.value.get(k) || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'set') {
            return {
              type: { static: { kind: 'function', parameters: [mapType.keyType, mapType.valueType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (key: RuntimeTypedBinder, value: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(key);
                  object.value.set(k, value);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'has') {
            return {
              type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: { kind: 'boolean' } }, refinements: [] },
              value: {
                fn: (key: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(key);
                  return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.has(k) };
                }
              }
            };
          }
          if (propertyName === 'deleteWithKey') {
            return {
              type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (key: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(key);
                  object.value.delete(k);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'keys') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: mapType.keyType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  object.value.forEach((_, key) => {
                    arr.push(this.keyToRuntimeTypeBinder(key));
                  });
                  return { type: { static: { kind: 'array', elementType: mapType.keyType }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'values') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: mapType.valueType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  object.value.forEach((value) => {
                    arr.push(value);
                  });
                  return { type: { static: { kind: 'array', elementType: mapType.valueType }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'entries') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] } } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaMap)) {
                    throw new Error('Internal: Map value is undefined or invalid');
                  }
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  object.value.forEach((value, key) => {
                    // Create a tuple (key, value)
                    const tuple: RuntimeTypedBinder = {
                      type: { static: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] }, refinements: [] },
                      value: [this.keyToRuntimeTypeBinder(key), value]
                    };
                    arr.push(tuple);
                  });
                  return { type: { static: { kind: 'array', elementType: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] } }, refinements: [] }, value: arr };
                }
              }
            };
          }

        }

        if (object.type.static.kind === 'set') {
          const setType = object.type.static as { kind: 'set'; elementType: Type };
          if (propertyName === 'size') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaSet)) {
                    throw new Error('Internal: Set value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.size };
                }
              }
            };
          }
          if (propertyName === 'add') {
            return {
              type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (item: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaSet)) {
                    throw new Error('Internal: Set value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(item);
                  object.value.add(k);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'has') {
            return {
              type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'boolean' } }, refinements: [] },
              value: {
                fn: (item: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaSet)) {
                    throw new Error('Internal: Set value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(item);
                  return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.has(k) };
                }
              }
            };
          }
          if (propertyName === 'delete') {
            return {
              type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (item: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof SchemaSet)) {
                    throw new Error('Internal: Set value is undefined or invalid');
                  }
                  const k = this.RuntimeTypeBinderToKey(item);
                  object.value.delete(k);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'values') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: setType.elementType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof SchemaSet)) {
                    throw new Error('Internal: Set value is undefined or invalid');
                  }
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  object.value.forEach((item) => {
                    arr.push(this.keyToRuntimeTypeBinder(item));
                  });
                  return { type: { static: { kind: 'array', elementType: setType.elementType }, refinements: [] }, value: arr };
                }
              }
            };
          }
        }

        if (object.type.static.kind === 'heap') {
          const heapType = object.type.static as { kind: 'heap'; elementType: Type };
          if (propertyName === 'size') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof MinHeap || object.value instanceof MaxHeap)) {
                    throw new Error('Internal: Heap value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.size };
                }
              }
            };
          }
          if (propertyName === 'push') {
            return {
              type: { static: { kind: 'function', parameters: [heapType.elementType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (item: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof MinHeap || object.value instanceof MaxHeap)) {
                    throw new Error('Internal: Heap value is undefined or invalid');
                  }
                  object.value.push(item);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'pop') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: heapType.elementType }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof MinHeap || object.value instanceof MaxHeap)) {
                    throw new Error('Internal: Heap value is undefined or invalid');
                  }
                  const val = object.value.pop();
                  if (!val) {
                    throw new Error(`Error: cannot pop from an empty heap`);
                  }
                  return val;
                }
              }
            };
          }
          if (propertyName === 'peek') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: heapType.elementType }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof MinHeap || object.value instanceof MaxHeap)) {
                    throw new Error('Internal: Heap value is undefined or invalid');
                  }
                  const val = object.value.peek();
                  if (!val) {
                    throw new Error(`Error: cannot peek from an empty heap`);
                  }
                  return val;
                }
              }
            };
          }
        }

        if (object.type.static.kind === 'heapmap') {
          const heapmapType = object.type.static as { kind: 'heapmap'; keyType: Type; valueType: Type };
          if (propertyName === 'size') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof MinHeapMap || object.value instanceof MaxHeapMap)) {
                    throw new Error('Internal: HeapMap value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.size };
                }
              }
            };
          }
          if (propertyName === 'push') {
            return {
              type: { static: { kind: 'function', parameters: [heapmapType.keyType, heapmapType.valueType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (key: RuntimeTypedBinder, value: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof MinHeapMap || object.value instanceof MaxHeapMap)) {
                    throw new Error('Internal: HeapMap value is undefined or invalid');
                  }
                  object.value.push(key, value);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'pop') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: heapmapType.keyType }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof MinHeapMap || object.value instanceof MaxHeapMap)) {
                    throw new Error('Internal: HeapMap value is undefined or invalid');
                  }
                  const val = object.value.pop();
                  if (!val) {
                    throw new Error(`Error: cannot pop from an empty heapmap`);
                  }
                  return val;
                }
              }
            };
          }
          if (propertyName === 'peek') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: heapmapType.keyType }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof MinHeapMap || object.value instanceof MaxHeapMap)) {
                    throw new Error('Internal: HeapMap value is undefined or invalid');
                  }
                  const val = object.value.peek();
                  if (!val) {
                    throw new Error(`Error: cannot peek from an empty heapmap`);
                  }
                  return val;
                }
              }
            };
          }
        }

        if (object.type.static.kind === 'binarytree' || object.type.static.kind === 'avltree') {
          const treeType = object.type.static as { kind: 'binarytree' | 'avltree'; elementType: Type };
          if (propertyName === 'insert') {
            return {
              type: { static: { kind: 'function', parameters: [treeType.elementType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (value: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof BinaryTree || object.value instanceof AVLTree)) {
                    throw new Error('Internal: Tree value is undefined or invalid');
                  }
                  object.value.insert(value);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'search') {
            return {
              type: { static: { kind: 'function', parameters: [treeType.elementType], returnType: { kind: 'boolean' } }, refinements: [] },
              value: {
                fn: (value: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof BinaryTree || object.value instanceof AVLTree)) {
                    throw new Error('Internal: Tree value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.search(value) };
                }
              }
            };
          }
          if (propertyName === 'inOrderTraversal') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: treeType.elementType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof BinaryTree || object.value instanceof AVLTree)) {
                    throw new Error('Internal: Tree value is undefined or invalid');
                  }
                  const elements = object.value.inOrderTraversal();
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  elements.forEach((el) => arr.push(el as RuntimeTypedBinder));
                  return { type: { static: { kind: 'array', elementType: treeType.elementType }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'preOrderTraversal') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: treeType.elementType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof BinaryTree || object.value instanceof AVLTree)) {
                    throw new Error('Internal: Tree value is undefined or invalid');
                  }
                  const elements = object.value.preOrderTraversal();
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  elements.forEach((el) => arr.push(el as RuntimeTypedBinder));
                  return { type: { static: { kind: 'array', elementType: treeType.elementType }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'postOrderTraversal') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: treeType.elementType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof BinaryTree || object.value instanceof AVLTree)) {
                    throw new Error('Internal: Tree value is undefined or invalid');
                  }
                  const elements = object.value.postOrderTraversal();
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  elements.forEach((el) => arr.push(el as RuntimeTypedBinder));
                  return { type: { static: { kind: 'array', elementType: treeType.elementType }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'getHeight') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof BinaryTree || object.value instanceof AVLTree)) {
                    throw new Error('Internal: Tree value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.getHeight() };
                }
              }
            };
          }
        }

        if (object.type.static.kind === 'graph') {
          const graphType = object.type.static as { kind: 'graph'; nodeType: Type };
          if (propertyName === 'addVertex') {
            return {
              type: { static: { kind: 'function', parameters: [graphType.nodeType], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (vertex: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  object.value.addVertex(vertex);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'addEdge') {
            return {
              type: { static: { kind: 'function', parameters: [graphType.nodeType, graphType.nodeType, { kind: 'int' }], returnType: { kind: 'void' } }, refinements: [] },
              value: {
                fn: (
                  from: RuntimeTypedBinder,
                  to: RuntimeTypedBinder,
                  weight?: RuntimeTypedBinder
                ) => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  const w = weight && (weight.type.static.kind === 'int' || weight.type.static.kind === 'float') ? weight.value as number : 1;
                  object.value.addEdge(from, to, w);
                  return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
                }
              }
            };
          }
          if (propertyName === 'getNeighbors') {
            return {
              type: { static: { kind: 'function', parameters: [graphType.nodeType], returnType: { kind: 'array', elementType: { kind: 'record', fieldTypes: [[{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, { kind: 'int' }]] } } }, refinements: [] },
              value: {
                fn: (vertex: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  const neighbors = object.value.getNeighbors(vertex);
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  neighbors.forEach((edge) => {
                    // Create a record { to: nodeType, weight: int }
                    const record: RuntimeTypedBinder = {
                      type: { static: { kind: 'record', fieldTypes: [[{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, { kind: 'int' }]] }, refinements: [] },
                      value: new Map<RuntimeTypedBinder, RuntimeTypedBinder>([
                        [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'to' }, edge.to as RuntimeTypedBinder],
                        [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'weight' }, { type: { static: { kind: 'int' }, refinements: [] }, value: edge.weight }],
                      ])
                    };
                    arr.push(record);
                  });
                  return { type: { static: { kind: 'array', elementType: { kind: 'record', fieldTypes: [[{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, { kind: 'int' }]] } }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'hasVertex') {
            return {
              type: { static: { kind: 'function', parameters: [graphType.nodeType], returnType: { kind: 'boolean' } }, refinements: [] },
              value: {
                fn: (vertex: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.hasVertex(vertex) };
                }
              }
            };
          }
          if (propertyName === 'getVertices') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: graphType.nodeType } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  const vertices = object.value.getVertices();
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  vertices.forEach((v) => {
                    arr.push(v as RuntimeTypedBinder);
                  });
                  return { type: { static: { kind: 'array', elementType: graphType.nodeType }, refinements: [] }, value: arr };
                }
              }
            };
          }
          if (propertyName === 'isDirected') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'boolean' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.isDirected() };
                }
              }
            };
          }
          if (propertyName === 'size') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.getVertices().length };
                }
              }
            };
          }
          if (propertyName === 'haveEdge') {
            return {
              type: { static: { kind: 'function', parameters: [graphType.nodeType, graphType.nodeType], returnType: { kind: 'boolean' } }, refinements: [] },
              value: {
                fn: (from: RuntimeTypedBinder, to: RuntimeTypedBinder) => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.hasEdge(from, to) };
                }
              }
            };
          }
          if (propertyName === 'getEdges') {
            return {
              type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: { kind: 'record', fieldTypes: [[{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, { kind: 'int' }]] } } }, refinements: [] },
              value: {
                fn: () => {
                  if (!object.value || !(object.value instanceof Graph)) {
                    throw new Error('Internal: Graph value is undefined or invalid');
                  }
                  const edges = object.value.getEdges();
                  const arr = new SchemaArray<RuntimeTypedBinder>();
                  edges.forEach((edge) => {
                    // Create a record { from: nodeType, to: nodeType, weight: int }
                    const record: RuntimeTypedBinder = {
                      type: { static: { kind: 'record', fieldTypes: [[{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, { kind: 'int' }]] }, refinements: [] },
                      value: new Map<RuntimeTypedBinder, RuntimeTypedBinder>([
                        [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'from' }, edge.from as RuntimeTypedBinder],
                        [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'to' }, edge.to as RuntimeTypedBinder],
                        [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'weight' }, { type: { static: { kind: 'int' }, refinements: [] }, value: edge.weight }],
                      ])
                    };
                    arr.push(record);
                  });
                  return { type: { static: { kind: 'array', elementType: { kind: 'record', fieldTypes: [[{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, graphType.nodeType], [{ kind: 'string' }, { kind: 'int' }]] } }, refinements: [] }, value: arr };
                }
              }
            };
          }
        }
        throw new Error(`Property ${propertyName} does not exist`);
      }

      case 'IndexExpression': {
        const object = this.evaluateExpression(expr.object);
        const index = this.evaluateExpression(expr.index);

        if (object.type.static.kind === 'array') {
          if (index.type.static.kind === 'int') {
            const val = (object.value as SchemaArray<RuntimeTypedBinder>).get(index.value as number);
            return val || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
          }
          // Handle array slicing
          if (index.type.static.kind === 'array' && index.type.static.elementType.kind === 'int') {
             // Range evaluates to an array of integers [start, start+1, ..., end-1]
             // But for slicing we want the start and end indices.
             // However, the RangeExpression evaluation in interpreter returns an array of numbers.
             // This is inefficient for slicing if we just want start/end.
             // But given the current implementation of RangeExpression, it returns an array.
             
             // Wait, RangeExpression in interpreter returns a SchemaArray of integers.
             // If it's a range like ..3, it returns [0, 1, 2].
             // If it's 1..4, it returns [1, 2, 3].
             // If it's 2.., it's an infinite range, which might be handled differently or throw error if not supported.
             
             // Let's check how RangeExpression is evaluated.
             // If it returns an array of indices, we can map over them to get elements.
             
             const indices = (index.value as SchemaArray<RuntimeTypedBinder>);
             const sourceArray = (object.value as SchemaArray<RuntimeTypedBinder>);
             const result = new SchemaArray<RuntimeTypedBinder>();
             
             // Optimization: if indices are contiguous, we could slice, but SchemaArray might not support it directly.
             // For now, just iterate.
             for (let i = 0; i < indices.length; i++) {
                const idxVal = indices.get(i);
                if (idxVal && idxVal.value !== undefined) {
                   const idx = idxVal.value as number;
                   if (idx >= 0 && idx < sourceArray.length) {
                      const val = sourceArray.get(idx);
                      if (val) result.push(val);
                   }
                }
             }
             
             return {
                type: object.type,
                value: result
             };
          }

          // Handle array slicing with Range object (infinite ranges)
          if (index.type.static.kind === 'range') {
             const range = index.value as LazyRange;
             const sourceArray = (object.value as SchemaArray<RuntimeTypedBinder>);
             const result = new SchemaArray<RuntimeTypedBinder>();
             
             const start = range.getStart;
             let end = range.getEnd;
             const inclusive = range.isInclusive;
             
             // If end is undefined (infinite), slice until the end of the array
             if (end === undefined) {
                end = sourceArray.length;
             } else {
                if (inclusive) {
                   end = end + 1;
                }
             }
             
             const actualStart = Math.max(0, Math.min(start, sourceArray.length));
             const actualEnd = Math.max(0, Math.min(end, sourceArray.length));
             
             for (let i = actualStart; i < actualEnd; i++) {
                const val = sourceArray.get(i);
                if (val) result.push(val);
             }
             
             return {
                type: object.type,
                value: result
             };
          }
        }

        if (object.type.static.kind === 'map') {
          const key = this.RuntimeTypeBinderToKey(index);
          const val = (object.value as SchemaMap<any, RuntimeTypedBinder>).get(key);
          return val || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
        }

        if (object.type.static.kind === 'tuple') {
          if (index.type.static.kind === 'int') {
            const idx = index.value as number;
            const tupleValue = object.value as RuntimeTypedBinder[];
            if (idx >= 0 && idx < tupleValue.length) {
              return tupleValue[idx];
            }
            throw new Error(`Tuple index ${idx} out of bounds (length: ${tupleValue.length})`);
          }
          throw new Error('Tuple indices must be integers');
        }

        if (object.type.static.kind === 'record') {
          if (index.type.static.kind === 'string') {
            const recordValue = object.value as Map<RuntimeTypedBinder, RuntimeTypedBinder>;
            // Find the field by matching string value in keys
            for (const [key, value] of recordValue.entries()) {
              if (key.type.static.kind === 'string' && key.value === index.value) {
                return value;
              }
            }
            throw new Error(`Record does not have field '${index.value}'`);
          }
          throw new Error('Record indices must be strings');
        }

        throw new Error('Invalid index expression');
      }

      case 'RangeExpression': {
        const inclusive = expr.inclusive;

        // Handle string range expressions like "aa".."bb", "a".."z"
        if (expr.start) {
          const startVal = this.evaluateExpression(expr.start);
          if (startVal.type.static.kind === 'string') {
            return this.evaluateStringRange(startVal.value as string, expr.end, inclusive);
          }
        }

        // Handle integer range expressions like 1..3, 1...3, ..3, 0..
        let start: number // There must be a start (possibly default)
        let end: number | undefined;

        if (expr.start) {
          const startVal = this.evaluateExpression(expr.start);
          if (startVal.type.static.kind === 'int') {
            start = startVal.value as number;
          } else {
            throw new Error('Range start must be an integer or string');
          }
        } else {
          start = 0; // Default start for integer ranges
        }
        // Evaluate start (default to 0 if not provided)

        // Evaluate end (undefined for infinite ranges)
        if (expr.end) {
          const endVal = this.evaluateExpression(expr.end);
          if (endVal.type.static.kind === 'int') {
            end = endVal.value as number;
          } else {
            throw new Error('Range end must be an integer');
          }
        } else {
          end = undefined; // Infinite range
        }

        // Create and return the range
        const range = new LazyRange(start, end, inclusive);

        // If it's a finite range, convert to array for immediate use
        // Otherwise, return the range object for lazy evaluation
        if (!range.isInfinite) {
          const elements = range.toArray().map(val => ({ type: { static: { kind: 'int' as const }, refinements: [] }, value: val }));
          return { type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }, value: new SchemaArray(elements) };
        } else {
          return { type: { static: { kind: 'range' }, refinements: [] }, value: range };
        }
      }

      case 'TypeOfExpression': {
        const operand = this.evaluateExpression(expr.operand);
        return { type: { static: { kind: 'string' }, refinements: [] }, value: operand.type.static.kind };
      }

      case 'AssertExpression': {
        const condition = this.evaluateExpression(expr.condition);
        if (condition.type.static.kind !== 'boolean') {
          throw new Error('Assert condition must be a boolean');
        }
        if (condition.value === false) {
          const message = this.evaluateExpression(expr.message);
          throw new Error(`Assertion failed: ${RuntimeTypedBinderToString(message)}`);
        }
        return { type: { static: { kind: 'boolean' }, refinements: [] }, value: true };
      }

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private evaluateStringRange(start: string, endExpr: Expression | undefined, inclusive: boolean): RuntimeTypedBinder {
    if (!endExpr) {
      throw new Error('String ranges must have both start and end');
    }

    const endVal = this.evaluateExpression(endExpr);
    if (endVal.type.static.kind !== 'string') {
      throw new Error('String range end must be a string');
    }

    const end = endVal.value as string;

    // Generate string range
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

        if (inclusive && current.join('') === end) {
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

  private isNumeric(type: Type): boolean {
    if (type.kind === 'int' || type.kind === 'float') return true;
    if (type.kind === 'intersection') {
      return type.types.some(t => this.isNumeric(t));
    }
    if (type.kind === 'union') {
      return type.types.every(t => this.isNumeric(t));
    }
    return false;
  }

  private evaluateBinaryExpression(expr: any): RuntimeTypedBinder {
    let left: RuntimeTypedBinder;
    if (expr.left.type === 'IntegerLiteral') {
      left = { value: expr.left.value, type: { static: { kind: 'int' }, refinements: [] } };
    } else if (expr.left.type === 'Identifier') {
      left = this.currentEnv.get(expr.left.name);
    } else {
      left = this.evaluateExpression(expr.left);
    }

    let right: RuntimeTypedBinder;
    if (expr.right.type === 'IntegerLiteral') {
      right = { value: expr.right.value, type: { static: { kind: 'int' }, refinements: [] } };
    } else if (expr.right.type === 'Identifier') {
      right = this.currentEnv.get(expr.right.name);
    } else {
      right = this.evaluateExpression(expr.right);
    }

    // Arithmetic: +, -, *, % (work on int and float)
    if (expr.operator === '+') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: (left.value as number) + (right.value as number) };
      }
      if (left.type.static.kind === 'float' && right.type.static.kind === 'float') {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) + (right.value as number) };
      }
      if ((left.type.static.kind === 'int' || left.type.static.kind === 'float') &&
        (right.type.static.kind === 'int' || right.type.static.kind === 'float')) {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) + (right.value as number) };
      }
      if (left.type.static.kind === 'string' && right.type.static.kind === 'string') {
        return { type: { static: { kind: 'string' }, refinements: [] }, value: (left.value as string) + (right.value as string) };
      }
      throw new Error(`Cannot add ${left.type.static.kind} and ${right.type.static.kind}`);
    }

    if (expr.operator === '-') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: (left.value as number) - (right.value as number) };
      }
      if (left.type.static.kind === 'float' && right.type.static.kind === 'float') {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) - (right.value as number) };
      }
      if ((left.type.static.kind === 'int' || left.type.static.kind === 'float') &&
        (right.type.static.kind === 'int' || right.type.static.kind === 'float')) {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) - (right.value as number) };
      }
      throw new Error(`Cannot subtract ${right.type.static.kind} from ${left.type.static.kind}`);
    }

    if (expr.operator === '*') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: (left.value as number) * (right.value as number) };
      }
      if (left.type.static.kind === 'float' && right.type.static.kind === 'float') {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) * (right.value as number) };
      }
      if ((left.type.static.kind === 'int' || left.type.static.kind === 'float') &&
        (right.type.static.kind === 'int' || right.type.static.kind === 'float')) {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) * (right.value as number) };
      }
      throw new Error(`Cannot multiply ${left.type.static.kind} and ${right.type.static.kind}`);
    }

    // Integer division: / (requires both operands to be int, returns int)
    if (expr.operator === '/') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: Math.floor((left.value as number) / (right.value as number)) };
      }
      throw new Error(`Integer division requires both operands to be int`);
    }

    // Float division: /. (works on int or float, returns float)
    if (expr.operator === '/.') {
      if ((left.type.static.kind === 'int' || left.type.static.kind === 'float') &&
        (right.type.static.kind === 'int' || right.type.static.kind === 'float')) {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) / (right.value as number) };
      }
      throw new Error(`Float division requires numeric operands`);
    }

    if (expr.operator === '%') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: (left.value as number) % (right.value as number) };
      }
      if (left.type.static.kind === 'float' && right.type.static.kind === 'float') {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) % (right.value as number) };
      }
      if ((left.type.static.kind === 'int' || left.type.static.kind === 'float') &&
        (right.type.static.kind === 'int' || right.type.static.kind === 'float')) {
        return { type: { static: { kind: 'float' }, refinements: [] }, value: (left.value as number) % (right.value as number) };
      }
      throw new Error(`Modulo requires numeric operands`);
    }

    // Bitwise shift operators: << and >> (require both operands to be int)
    if (expr.operator === '<<') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: (left.value as number) << (right.value as number) };
      }
      throw new Error(`Left shift requires both operands to be int`);
    }

    if (expr.operator === '>>') {
      if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
        return { type: { static: { kind: 'int' }, refinements: [] }, value: (left.value as number) >> (right.value as number) };
      }
      throw new Error(`Right shift requires both operands to be int`);
    }

    // Comparison operators: work on int or float
    if (expr.operator === '<') {
      if (this.isNumeric(left.type.static) && this.isNumeric(right.type.static)) {
        return { type: { static: { kind: 'boolean' }, refinements: [] }, value: (left.value as number) < (right.value as number) };
      }
      throw new Error(`Cannot compare ${left.type.static.kind} < ${right.type.static.kind}. At line ${expr.line}, column ${expr.column}`);
    }

    if (expr.operator === '<=') {
      if (this.isNumeric(left.type.static) && this.isNumeric(right.type.static)) {
        return { type: { static: { kind: 'boolean' }, refinements: [] }, value: (left.value as number) <= (right.value as number) };
      }
      throw new Error(`Cannot compare ${left.type.static.kind} <= ${right.type.static.kind}. At line ${expr.line}, column ${expr.column}`);
    }

    if (expr.operator === '>') {
      if (this.isNumeric(left.type.static) && this.isNumeric(right.type.static)) {
        return { type: { static: { kind: 'boolean' }, refinements: [] }, value: (left.value as number) > (right.value as number) };
      }
      throw new Error(`Cannot compare ${left.type.static.kind} > ${right.type.static.kind}. At line ${expr.line}, column ${expr.column}`);
    }

    if (expr.operator === '>=') {
      if (this.isNumeric(left.type.static) && this.isNumeric(right.type.static)) {
        return { type: { static: { kind: 'boolean' }, refinements: [] }, value: (left.value as number) >= (right.value as number) };
      }
      throw new Error(`Cannot compare ${left.type.static.kind} >= ${right.type.static.kind}. At line ${expr.line}, column ${expr.column}`);
    }

    // Equality operators
    if (expr.operator === '==') {
      return { type: { static: { kind: 'boolean' }, refinements: [] }, value: this.valuesEqual(left, right) };
    }

    if (expr.operator === '!=') {
      return { type: { static: { kind: 'boolean' }, refinements: [] }, value: !this.valuesEqual(left, right) };
    }

    // Logical operators
    if (expr.operator === '&&') {
      return { type: { static: { kind: 'boolean' }, refinements: [] }, value: this.isTruthy(left) && this.isTruthy(right) };
    }

    if (expr.operator === '||') {
      return { type: { static: { kind: 'boolean' }, refinements: [] }, value: this.isTruthy(left) || this.isTruthy(right) };
    }

    throw new Error(`Unknown binary operator: ${expr.operator}`);
  }

  private evaluateCallExpression(expr: any): RuntimeTypedBinder {
    const callee = this.evaluateExpression(expr.callee);

    // Check if it's a function with the new runtime type system
    if (callee.type.static.kind === 'function') {
      const calleeValue = callee.value as { fn: (...args: RuntimeTypedBinder[]) => RuntimeTypedBinder } | { parameters: Parameter[]; body: BlockStatement; closure: any };

      // Native function (has 'fn' property directly)
      if ('fn' in calleeValue) {
        const args = expr.arguments.map((arg: Expression) =>
          this.evaluateExpression(arg)
        );
        return calleeValue.fn(...args);
      }

      // User-defined function (has 'parameters', 'body', 'closure')
      if ('parameters' in calleeValue && 'body' in calleeValue && 'closure' in calleeValue) {
        const args = expr.arguments.map((arg: Expression) =>
          this.evaluateExpression(arg)
        );

        const savedEnv = this.currentEnv;
        // Create a new environment from the closure (which is an Environment object)
        const closureEnv = new Environment(calleeValue.closure as Environment);
        this.currentEnv = closureEnv;

        for (let i = 0; i < calleeValue.parameters.length; i++) {
          this.currentEnv.define(calleeValue.parameters[i].name, args[i]);
        }

        try {
          // Inline evaluateBlockStatement to save stack frames
          for (const stmt of calleeValue.body.statements) {
            this.evaluateStatement(stmt);
          }
          this.currentEnv = savedEnv;
          return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
        } catch (e) {
          if (e instanceof ReturnException) {
            this.currentEnv = savedEnv;
            return e.value;
          }
          throw e;
        }
      }
    }

    throw new Error('Not a function');
  }

  private valuesEqual(left: RuntimeTypedBinder, right: RuntimeTypedBinder): boolean {
    if (left.type.static.kind !== right.type.static.kind) return false;

    if (left.type.static.kind === 'int' && right.type.static.kind === 'int') {
      return left.value === right.value;
    }

    if (left.type.static.kind === 'float' && right.type.static.kind === 'float') {
      return left.value === right.value;
    }

    if (left.type.static.kind === 'string' && right.type.static.kind === 'string') {
      return left.value === right.value;
    }

    if (left.type.static.kind === 'boolean' && right.type.static.kind === 'boolean') {
      return left.value === right.value;
    }

    if (left.type.static.kind === 'void' && right.type.static.kind === 'void') {
      return true;
    }

    return false;
  }

  private isTruthy(value: RuntimeTypedBinder): boolean {
    if (value.type.static.kind === 'boolean') {
      return value.value as boolean;
    }
    // In many languages, non-boolean values can be truthy/falsy
    // For now, only booleans are considered for truthiness
    return false;
  }

  private RuntimeTypeBinderToKey(value: RuntimeTypedBinder): any {
    if (value.type.static.kind === 'int' || value.type.static.kind === 'float') return value.value;
    if (value.type.static.kind === 'string') return value.value;
    if (value.type.static.kind === 'boolean') return value.value;
    return value;
  }

  private keyToRuntimeTypeBinder(key: any): RuntimeTypedBinder {
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
}
