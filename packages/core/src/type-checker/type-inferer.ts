import { Program, Statement, Expression } from '../transpiler/ast-types';
import { FunEnv, initializeBuiltins, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToAnnotation, typeToString } from './type-checker-utils';

/**
 * TypeInferer is responsible for plugging in all type annotations where they're missing.
 * It performs type inference for unannotated variables, parameters, and return types.
 */
export class TypeInferer {
  // Maps variable names to their types
  private typeEnv: TypeEnv = new Map();

  // Maps function names to their parameter types and return type
  private functionEnv: FunEnv = new Map();

  // Collected return types during inference
  private inferredReturnTypes: Type[] = [];

  // Maps function names to their declarations (for updating annotations)
  private functionDeclEnv: Map<string, any> = new Map();

  // Optimization: Type equality cache to avoid redundant comparisons
  private typeEqualityCache: Map<string, boolean> = new Map();

  constructor() {
    [this.functionEnv, this.typeEnv] = initializeBuiltins();
  }

  /**
   * Infer all missing type annotations in the program.
   * @param program The program to infer types for
   */
  public infer(program: Program): { typeEnv: TypeEnv; functionEnv: FunEnv; functionDeclEnv: Map<string, any> } {
    // Pre-pass: register all functions to handle mutual recursion
    this.registerFunctions(program);

    // First pass: infer basic types
    for (const statement of program.body) {
      this.inferStatement(statement);
    }
    return {
      typeEnv: this.typeEnv,
      functionEnv: this.functionEnv,
      functionDeclEnv: this.functionDeclEnv
    };
  }

  private registerFunctions(program: Program): void {
    for (const statement of program.body) {
      if (statement.type === 'FunctionDeclaration') {
        // Store the function declaration for later refinement
        this.functionDeclEnv.set(statement.name, statement);

        // Infer parameter types if not annotated
        for (const param of statement.parameters) {
          if (!param.typeAnnotation) {
            // Default to weak polymorphic type - will be refined during usage
            param.typeAnnotation = {
              type: 'TypeAnnotation',
              kind: 'simple',
              name: 'weak',
              line: statement.line,
              column: statement.column
            };
          }
        }

        this.functionEnv.set(statement.name, {
          parameters: statement.parameters.map((param) => resolve(param.typeAnnotation!)),
          returnType: statement.returnType ? resolve(statement.returnType) : { kind: 'weak' },
        });
      }
    }
  }

  /**
   * A function to infer unannotated types in the program.
   * The function should also resolve all weak polymorphic types to concrete types.
   * @param stmt
   */
  private inferStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration': {
        // Infer parameter types if not annotated
        for (const param of stmt.parameters) {
          if (!param.typeAnnotation) {
            // Default to weak polymorphic type - will be refined during usage
            param.typeAnnotation = {
              type: 'TypeAnnotation',
              kind: 'simple',
              name: 'weak',
              line: stmt.line,
              column: stmt.column
            };
          }
        }

        // Pre-register function to allow recursive calls
        this.functionEnv.set(stmt.name, {
          parameters: stmt.parameters.map((param) => resolve(param.typeAnnotation!)),
          returnType: stmt.returnType ? resolve(stmt.returnType) : { kind: 'weak' },
        });

        // Save previous inferred return types (for nested functions)
        const savedInferredReturnTypes = this.inferredReturnTypes;
        this.inferredReturnTypes = [];

        // Create a temporary scope for inference
        const savedEnv = new Map(this.typeEnv);
        for (const param of stmt.parameters) {
          this.typeEnv.set(param.name, resolve(param.typeAnnotation!));
        }

        // Process function body to infer types within (including return statements)
        this.inferStatement(stmt.body);

        // Restore environment
        this.typeEnv = savedEnv;

        // Infer return type if not annotated
        if (!stmt.returnType) {
          // Determine return type from collected types
          let returnTypeInferred: Type | undefined = undefined;

          for (const typeInferred of this.inferredReturnTypes) {
            if (!returnTypeInferred) {
              returnTypeInferred = typeInferred;
            } else {
              if (!typesEqual(returnTypeInferred, typeInferred, this.typeEqualityCache)) {
                // Multiple return types - create a union
                if (returnTypeInferred.kind === 'union') {
                  returnTypeInferred.types.push(typeInferred);
                } else {
                  returnTypeInferred = {
                    kind: 'union',
                    types: [returnTypeInferred, typeInferred],
                  };
                }
              }
            }
          }

          // Set the inferred or default return type
          if (returnTypeInferred) {
            stmt.returnType = typeToAnnotation(returnTypeInferred, stmt.line, stmt.column);
          } else {
            // Default to void if no return statements
            stmt.returnType = {
              type: 'TypeAnnotation',
              kind: 'simple',
              name: 'void',
              line: stmt.line,
              column: stmt.column
            };
          }

          // Update function environment with inferred return type
          this.functionEnv.set(stmt.name, {
            parameters: stmt.parameters.map((param) => resolve(param.typeAnnotation!)),
            returnType: resolve(stmt.returnType),
          });
        }

        // Restore previous inferred return types
        this.inferredReturnTypes = savedInferredReturnTypes;
        break;
      }

      case 'VariableDeclaration': {
        for (const declarator of stmt.declarations) {
          if (!declarator.typeAnnotation) {
            // Infer type from initializer
            const inferredType = this.inferExpressionType(declarator.initializer);
            declarator.typeAnnotation = typeToAnnotation(inferredType, declarator.line, declarator.column);
            declarator.typeAnnotation.isInferred = true;
          }
          // Add variable to type environment
          this.typeEnv.set(declarator.name, resolve(declarator.typeAnnotation));
        }
        break;
      }

      case 'IfStatement':
        this.inferStatement(stmt.thenBranch);
        if (stmt.elseBranch) {
          this.inferStatement(stmt.elseBranch);
        }
        break;

      case 'WhileStatement':
        this.inferStatement(stmt.body);
        break;

      case 'UntilStatement':
        this.inferStatement(stmt.body);
        break;

      case 'ForStatement': {
        // Infer type of iterable
        const iterableType = this.inferExpressionType(stmt.iterable);

        // Save current type environment
        const savedEnv = new Map(this.typeEnv);

        // Add loop variable to type environment
        // Skip binding if variable name is '_'
        if (stmt.variable !== '_') {
          if (iterableType.kind === 'array' || iterableType.kind === 'set') {
            this.typeEnv.set(stmt.variable, iterableType.elementType);
          } else if (iterableType.kind === 'map' || iterableType.kind === 'heap' || iterableType.kind === 'heapmap') {
            // For maps and heaps, we need to infer the key type
            if (iterableType.kind === 'map' || iterableType.kind === 'heapmap') {
              this.typeEnv.set(stmt.variable, iterableType.keyType);
            } else {
              this.typeEnv.set(stmt.variable, iterableType.elementType);
            }
          } else if (iterableType.kind === 'range') {
            this.typeEnv.set(stmt.variable, { kind: 'int' });
          } else {
            // Unknown iterable type, use weak
            this.typeEnv.set(stmt.variable, { kind: 'weak' });
          }
        }

        this.inferStatement(stmt.body);

        // Restore type environment
        this.typeEnv = savedEnv;
        break;
      }

      case 'BlockStatement':
        for (const s of stmt.statements) {
          this.inferStatement(s);
        }
        break;

      case 'ExpressionStatement':
      case 'AssignmentStatement':
      case 'InvariantStatement':
      case 'AssertStatement':
        // No type annotations to infer for these statements
        break;

      case 'ReturnStatement':
        if (stmt.value) {
          this.inferredReturnTypes.push(this.inferExpressionType(stmt.value));
        } else {
          this.inferredReturnTypes.push({ kind: 'void' });
        }
        break;
    }
  }

  /**
   * Infer the type of an expression without checking against environment
   * This is used during the inference phase before type checking
   */
  private inferExpressionType(expr: Expression): Type {
    switch (expr.type) {
      case 'IntegerLiteral':
        return { kind: 'int' };

      case 'FloatLiteral':
        return { kind: 'float' };

      case 'StringLiteral':
        return { kind: 'string' };

      case 'BooleanLiteral':
        return { kind: 'boolean' };

      case 'ArrayLiteral':
        if (expr.elements.length === 0) {
          return { kind: 'array', elementType: { kind: 'weak' } };
        }
        const elementTypes = expr.elements.map((e) => this.inferExpressionType(e));
        const firstType = elementTypes[0];
        const allSame = elementTypes.every((t) => typesEqual(t, firstType, this.typeEqualityCache));

        if (allSame) {
          return { kind: 'array', elementType: firstType };
        }

        return {
          kind: 'array',
          elementType: { kind: 'union', types: elementTypes },
        };

      case 'BinaryExpression': {
        const leftType = this.inferExpressionType(expr.left);
        const rightType = this.inferExpressionType(expr.right);

        // Arithmetic operators
        if (['+', '-', '*', '%'].includes(expr.operator)) {
          if (leftType.kind === 'weak' || rightType.kind === 'weak' || leftType.kind === 'union' || rightType.kind === 'union') {
            return { kind: 'weak' };
          }
          if (leftType.kind === 'int' && rightType.kind === 'int') {
            return { kind: 'int' };
          }
          if (leftType.kind === 'float' || rightType.kind === 'float') {
            return { kind: 'float' };
          }
          if (['+'].includes(expr.operator) && leftType.kind === 'string' && rightType.kind === 'string') {
            return { kind: 'string' };
          }
        }

        if (expr.operator === '/') {
          return { kind: 'int' };
        }

        if (expr.operator === '/.') {
          return { kind: 'float' };
        }

        // Comparison and logical operators return boolean
        if (['<', '<=', '>', '>=', '==', '!=', '&&', '||'].includes(expr.operator)) {
          return { kind: 'boolean' };
        }

        throw new Error(`Type checking: cannot infer type for binary expression ${JSON.stringify(expr)}`);
      }

      case 'UnaryExpression': {
        const operandType = this.inferExpressionType(expr.operand);
        if (expr.operator === '-' && operandType.kind === 'int') {
          return { kind: 'int' };
        }
        if (expr.operator === '-' && operandType.kind === 'float') {
          return { kind: 'float' };
        }
        if (expr.operator === '!' && operandType.kind === 'boolean') {
          return { kind: 'boolean' };
        }

        throw new Error(`Type checking: cannot infer type for unary expression ${expr.toString()}`);
      }

      case 'CallExpression': {
        // For built-in constructors, return their types
        // Noted that all type parameters are marked as weak-polymorphic
        // which is going to be further refined during the second pass
        if (expr.callee.type === 'Identifier') {
          const calleeName = expr.callee.name;

          if (calleeName === 'MinHeap' || calleeName === 'MaxHeap') {
            return { kind: 'heap', elementType: { kind: 'weak' } };
          }
          if (calleeName === 'MinHeapMap' || calleeName === 'MaxHeapMap') {
            return { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
          }
          if (calleeName === 'Map') {
            return { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
          }
          if (calleeName === 'Set') {
            return { kind: 'set', elementType: { kind: 'weak' } };
          }
          if (calleeName === 'Graph') {
            return { kind: 'graph', nodeType: { kind: 'weak' } };
          }
          if (calleeName === 'BinaryTree') {
            return { kind: 'binarytree', elementType: { kind: 'weak' } };
          }
          if (calleeName === 'AVLTree') {
            return { kind: 'avltree', elementType: { kind: 'weak' } };
          }
          // For other function calls, We want to look up their return types from the function environment
          const funcInfo = this.functionEnv.get(calleeName);
          if (funcInfo) {
            return funcInfo.returnType;
          } else {
            throw new Error(`Type checking: cannot infer type for call expression to unknown function ${calleeName}`);
          }
        }

        // Handle method calls (e.g., m.entries(), g.getNeighbors())
        if (expr.callee.type === 'MemberExpression') {
          const objectType = this.inferExpressionType(expr.callee.object);
          const methodName = expr.callee.property.name;

          // Map methods
          if (objectType.kind === 'map') {
            if (methodName === 'entries') {
              // entries() returns Array<Tuple<K, V>>
              return {
                kind: 'array',
                elementType: {
                  kind: 'tuple',
                  elementTypes: [objectType.keyType, objectType.valueType]
                }
              };
            }
            if (methodName === 'keys') {
              // keys() returns Array<K>
              return { kind: 'array', elementType: objectType.keyType };
            }
            if (methodName === 'values') {
              // values() returns Array<V>
              return { kind: 'array', elementType: objectType.valueType };
            }
          }

          // Graph methods
          if (objectType.kind === 'graph') {
            if (methodName === 'getNeighbors') {
              // getNeighbors() returns Array<Record<{to: T, weight: int}>>
              return {
                kind: 'array',
                elementType: {
                  kind: 'record',
                  fieldTypes: [
                    [{ kind: 'string' }, objectType.nodeType], // "to": T
                    [{ kind: 'string' }, { kind: 'int' }]      // "weight": int
                  ]
                }
              };
            }
            if (methodName === 'getEdges') {
              // getEdges() returns Array<Record<{from: T, to: T, weight: int}>>
              return {
                kind: 'array',
                elementType: {
                  kind: 'record',
                  fieldTypes: [
                    [{ kind: 'string' }, objectType.nodeType], // "from": T
                    [{ kind: 'string' }, objectType.nodeType], // "to": T
                    [{ kind: 'string' }, { kind: 'int' }]      // "weight": int
                  ]
                }
              };
            }
            if (methodName === 'getVertices') {
              // getVertices() returns Array<T>
              return { kind: 'array', elementType: objectType.nodeType };
            }
          }

          // For other methods, return weak type (will be refined later)
          return { kind: 'weak' };
        }

        // We don't have higher-order functions so that's all
        throw new Error(`Type checking: cannot infer type for call expression ${expr.toString()}`);
      }

      case 'RangeExpression': {
        if (expr.start) {
          const startType = this.inferExpressionType(expr.start);
          if (expr.end) {
            const endType = this.inferExpressionType(expr.end);
            // Accept int, intersection with int, or weak types
            const isIntType = (t: Type) =>
              t.kind === 'int' ||
              (t.kind === 'intersection' && t.types.some(tt => tt.kind === 'int')) ||
              t.kind === 'weak';
            const isStringType = (t: Type) =>
              t.kind === 'string' || t.kind === 'weak';

            if (isIntType(startType) && isIntType(endType)) {
              return { kind: 'array', elementType: { kind: 'int' } };
            }
            if (isStringType(startType) && isStringType(endType)) {
              return { kind: 'array', elementType: { kind: 'string' } };
            }
          } else {
            if (startType.kind === 'int' || startType.kind === 'weak') {
              return { kind: 'range' };
            }
          }
        } else if (expr.end) {
          return { kind: 'array', elementType: { kind: 'int' } };
        }
        throw Error(`Type checking: cannot infer type for range expression ${expr.toString()}`);
      }

      case 'MemberExpression': {
        const objectType = this.inferExpressionType(expr.object);
        // Handle built-in data structure methods
        // Arrays, Maps, Sets, Heaps, HeapMaps, BinaryTrees, AVLTrees, Graphs

        // Array methods
        if (objectType.kind === 'array') {
          if (expr.property.name === 'length') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'push') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'pop') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.elementType,
            };
          }
        }

        // Map methods
        if (objectType.kind === 'map') {
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'get') {
            return {
              kind: 'function',
              parameters: [objectType.keyType],
              returnType: objectType.valueType,
            };
          }
          if (expr.property.name === 'set') {
            return {
              kind: 'function',
              parameters: [objectType.keyType, objectType.valueType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'keys') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'array', elementType: objectType.keyType },
            };
          }
          if (expr.property.name === 'values') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'array', elementType: objectType.valueType },
            };
          }
          if (expr.property.name === 'entries') {
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
          }
        }

        if (objectType.kind === 'set') {
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'add') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'has') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'delete') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
        }

        if (objectType.kind === 'heap') {
          if (expr.property.name === 'push') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'pop') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.elementType,
            };
          }
          if (expr.property.name === 'peek') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.elementType,
            };
          }
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' }
            };
          }
        }

        if (objectType.kind === 'heapmap') {
          if (expr.property.name === 'push') {
            return {
              kind: 'function',
              parameters: [objectType.keyType, objectType.valueType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'pop') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.keyType,
            };
          }
          if (expr.property.name === 'peek') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.keyType,
            };
          }
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' }
            };
          }
        }

        if (objectType.kind === 'binarytree' || objectType.kind === 'avltree') {
          if (expr.property.name === 'insert') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'search') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'getHeight') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
        }

        if (objectType.kind === 'graph') {
          if (expr.property.name === 'addVertex') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'addEdge') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType, objectType.nodeType, { kind: 'int' }],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'getNeighbors') {
            // Returns Array<{ to: nodeType, weight: int }>
            const edgeRecordType: Type = {
              kind: 'record',
              fieldTypes: [
                [{ kind: 'string' }, objectType.nodeType],
                [{ kind: 'string' }, { kind: 'int' }],
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
          }
          if (expr.property.name === 'hasVertex') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'hasEdge') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType, objectType.nodeType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'isDirected') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'getEdges') {
            // Returns Array<{ from: nodeType, to: nodeType, weight: int }>
            const edgeWithFromRecordType: Type = {
              kind: 'record',
              fieldTypes: [
                [{ kind: 'string' }, objectType.nodeType],
                [{ kind: 'string' }, objectType.nodeType],
                [{ kind: 'string' }, { kind: 'int' }],
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
          }
          if (expr.property.name === 'getVertices') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'array', elementType: objectType.nodeType },
            };
          }
        }

        throw new Error(
          `Type checking: property ${expr.property.name} does not exist on type ${typeToString(objectType)}, at ${expr.line}, ${expr.column}`
        );
      }

      case 'IndexExpression': {
        const objectType = this.inferExpressionType(expr.object);
        const indexType = this.inferExpressionType(expr.index);

        if (objectType.kind === 'array') {
          if (indexType.kind === 'int') {
            return objectType.elementType;
          }
          // Support slicing with array<int> (finite range)
          if (indexType.kind === 'array' && indexType.elementType.kind === 'int') {
            return objectType;
          }
          // Support slicing with range (infinite range)
          if (indexType.kind === 'range') {
            return objectType;
          }
        }

        if (objectType.kind === 'map') {
          // For inference, we accept any index type and return the value type
          // More strict checking will happen in the checking phase
          return objectType.valueType;
        }

        if (objectType.kind === 'tuple') {
          // Tuples are indexed by integers
          if (indexType.kind === 'int') {
            // For literal integer indices, return the specific element type
            if (expr.index.type === 'IntegerLiteral') {
              const idx = expr.index.value;
              if (idx >= 0 && idx < objectType.elementTypes.length) {
                return objectType.elementTypes[idx];
              }
              throw new Error(
                `Type checking: tuple index ${idx} out of bounds (length: ${objectType.elementTypes.length}), at ${expr.line}, ${expr.column}`,
              );
            }
            // For non-literal indices, return a union of all element types
            return { kind: 'union', types: objectType.elementTypes };
          }
          throw new Error(
            `Type checking: cannot index tuple with non-integer type ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
          );
        }

        if (objectType.kind === 'record') {
          // For records during inference, return weak type as value type
          // More precise checking will happen during the checking phase
          if (objectType.fieldTypes.length > 0) {
            const valueTypes = objectType.fieldTypes.map(([_, valueType]) => valueType);
            if (valueTypes.length === 1) {
              return valueTypes[0];
            }
            return { kind: 'union', types: valueTypes };
          }
          return { kind: 'weak' };
        }

        if (objectType.kind === 'weak') {
          return { kind: 'weak' };
        }

        throw new Error(
          `Type checking: cannot index type ${typeToString(objectType)} with ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
        );
      }

      case 'TypeOfExpression':
        return { kind: 'string' };

      case 'PredicateCheckExpression':
        // Turnstile operator always returns boolean
        return { kind: 'boolean' };

      case 'Identifier': {
        // Look up identifier type from type environment
        const type = this.typeEnv.get(expr.name);
        if (type) {
          return type;
        }
        // If not found in environment
        throw new Error(`Type checking: cannot infer type for identifier ${expr.name}`);
      }
      default:
        throw new Error(`Type checking: cannot infer type for expression of type ${expr.type}`);
    }
  }
}

export function infer(program: Program): { typeEnv: TypeEnv; functionEnv: FunEnv; functionDeclEnv: Map<string, any> } {
  const inferer = new TypeInferer();
  return inferer.infer(program);
}
