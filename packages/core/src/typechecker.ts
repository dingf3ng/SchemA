import { Program, Statement, Expression, TypeAnnotation, MemberExpression } from './types';

export type Type =
  | { kind: 'weak' } // weak polymorphic type, like in ocaml
  | { kind: 'poly' } // real polymorphic type, only for empty arrays, maps, sets, heaps, etc.
  | { kind: 'int' }
  | { kind: 'float' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'void' }
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

export class TypeChecker {
  // Environments

  // Maps variable names to their types
  private typeEnv: Map<string, Type> = new Map();

  // Maps function names to their parameter types and return type
  private functionEnv: Map<
    string,
    { parameters: Type[]; returnType: Type; variadic?: boolean }
  > = new Map();

  // Current function being checked (for return type validation)
  private currentFunction: string | null = null;

  // Collected return types during inference
  private inferredReturnTypes: Type[] = [];

  // Maps variable names to their declarations (for updating annotations)
  private variableDeclEnv: Map<string, any> = new Map();

  // Maps function names to their declarations (for updating annotations during refinement)
  private functionDeclEnv: Map<string, any> = new Map();

  // Optimization: Type equality cache to avoid redundant comparisons
  private typeEqualityCache: Map<string, boolean> = new Map();

  // Optimization: Track if any changes were made during refinement
  private refinementChanged: boolean = false;

  constructor() {
    this.initializeBuiltins();
  }

  private initializeBuiltins(): void {
    // Built-in functions
    this.functionEnv.set('print', {
      parameters: [{ kind: 'poly' }],
      returnType: { kind: 'void' },
      variadic: true,
    });

    // Polymorphic built-in data structures
    this.functionEnv.set('MinHeap', {
      parameters: [],
      returnType: { kind: 'heap', elementType: { kind: 'weak' } },
    });

    this.functionEnv.set('MaxHeap', {
      parameters: [],
      returnType: { kind: 'heap', elementType: { kind: 'weak' } },
    });

    this.functionEnv.set('MinHeapMap', {
      parameters: [],
      returnType: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } },
    });

    this.functionEnv.set('MaxHeapMap', {
      parameters: [],
      returnType: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } },
    });

    this.functionEnv.set('Graph', {
      parameters: [{ kind: 'boolean' }], // directed: boolean
      returnType: { kind: 'graph', nodeType: { kind: 'weak' } },
    });

    this.functionEnv.set('Map', {
      parameters: [],
      returnType: {
        kind: 'map',
        keyType: { kind: 'weak' },
        valueType: { kind: 'weak' },
      },
    });

    this.functionEnv.set('Set', {
      parameters: [],
      returnType: { kind: 'set', elementType: { kind: 'weak' } },
    });

    this.functionEnv.set('BinaryTree', {
      parameters: [],
      returnType: { kind: 'binarytree', elementType: { kind: 'weak' } },
    });

    this.functionEnv.set('AVLTree', {
      parameters: [],
      returnType: { kind: 'avltree', elementType: { kind: 'weak' } },
    });

    this.typeEnv.set('inf', { kind: 'intersection', types: [{ kind: 'int' }, { kind: 'float' }] });
  }

  public check(program: Program): void {
    for (const statement of program.body) {
      this.checkStatement(statement);
    }
  }

  public infer(program: Program): void {
    // Pre-pass: register all functions to handle mutual recursion
    this.registerFunctions(program);

    // First pass: infer basic types
    for (const statement of program.body) {
      this.inferStatement(statement);
    }

    // Second pass: refine weak polymorphic types based on usage
    // Use fixed-point iteration with convergence detection
    // Stop early if no changes are made in a pass
    const MAX_PASSES = 10;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      this.refinementChanged = false;
      this.typeEqualityCache.clear(); // Clear cache for each refinement pass

      for (const statement of program.body) {
        this.refineStatement(statement);
      }

      // Early exit if no changes were made
      if (!this.refinementChanged) {
        break;
      }
    }
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
          parameters: statement.parameters.map((param) => this.resolve(param.typeAnnotation!)),
          returnType: statement.returnType ? this.resolve(statement.returnType) : { kind: 'weak' },
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
          parameters: stmt.parameters.map((param) => this.resolve(param.typeAnnotation!)),
          returnType: stmt.returnType ? this.resolve(stmt.returnType) : { kind: 'weak' },
        });

        // Save previous inferred return types (for nested functions)
        const savedInferredReturnTypes = this.inferredReturnTypes;
        this.inferredReturnTypes = [];

        // Create a temporary scope for inference
        const savedEnv = new Map(this.typeEnv);
        for (const param of stmt.parameters) {
          this.typeEnv.set(param.name, this.resolve(param.typeAnnotation!));
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
              if (!this.typesEqual(returnTypeInferred, typeInferred)) {
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
            stmt.returnType = this.typeToAnnotation(returnTypeInferred, stmt.line, stmt.column);
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
            parameters: stmt.parameters.map((param) => this.resolve(param.typeAnnotation!)),
            returnType: this.resolve(stmt.returnType),
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
            declarator.typeAnnotation = this.typeToAnnotation(inferredType, declarator.line, declarator.column);
            declarator.typeAnnotation.isInferred = true;
          }
          // Add variable to type environment
          this.typeEnv.set(declarator.name, this.resolve(declarator.typeAnnotation));
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
        const allSame = elementTypes.every((t) => this.typesEqual(t, firstType));

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
          if (leftType.kind === 'weak' || rightType.kind === 'weak') {
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

        throw new Error(`Type checking: cannot infer type for binary expression ${expr.toString()}`);
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
          `Type checking: property ${expr.property.name} does not exist on type ${this.typeToString(objectType)}, at ${expr.line}, ${expr.column}`
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
            `Type checking: cannot index tuple with non-integer type ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
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
          `Type checking: cannot index type ${this.typeToString(objectType)} with ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
        );
      }

      case 'TypeOfExpression':
        return { kind: 'string'};
      case 'Identifier': {
        // Look up identifier type from type environment
        const type = this.typeEnv.get(expr.name);
        if (type) {
          return type;
        }
        // If not found in environment
        throw new Error(`Type checking: cannot infer type for identifier ${expr.name}`);
      }
      case 'AssertExpression':
        return { kind: 'void' };
      default:
        throw new Error(`Type checking: cannot infer type for expression of type ${expr.type}`);
    }
  }

  /**
   * Convert a Type to a TypeAnnotation
   */
  private typeToAnnotation(type: Type, line: number, column: number): TypeAnnotation {
    switch (type.kind) {
      case 'int':
        return { type: 'TypeAnnotation', kind: 'simple', name: 'int', line, column };
      case 'float':
        return { type: 'TypeAnnotation', kind: 'simple', name: 'float', line, column };
      case 'string':
        return { type: 'TypeAnnotation', kind: 'simple', name: 'string', line, column };
      case 'boolean':
        return { type: 'TypeAnnotation', kind: 'simple', name: 'bool', line, column };
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
          typeParameters: [this.typeToAnnotation(type.elementType, line, column)],
          line,
          column
        };
      case 'map':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'Map',
          typeParameters: [
            this.typeToAnnotation(type.keyType, line, column),
            this.typeToAnnotation(type.valueType, line, column)
          ],
          line,
          column
        };
      case 'set':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'Set',
          typeParameters: [this.typeToAnnotation(type.elementType, line, column)],
          line,
          column
        };
      case 'heap':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'MinHeap',
          typeParameters: [this.typeToAnnotation(type.elementType, line, column)],
          line,
          column
        };
      case 'heapmap':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'MinHeapMap',
          typeParameters: [
            this.typeToAnnotation(type.keyType, line, column),
            this.typeToAnnotation(type.valueType, line, column)
          ],
          line,
          column
        };
      case 'graph':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'Graph',
          typeParameters: [this.typeToAnnotation(type.nodeType, line, column)],
          line,
          column
        };
      case 'binarytree':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'BinaryTree',
          typeParameters: [this.typeToAnnotation(type.elementType, line, column)],
          line,
          column
        };
      case 'avltree':
        return {
          type: 'TypeAnnotation',
          kind: 'generic',
          name: 'AVLTree',
          typeParameters: [this.typeToAnnotation(type.elementType, line, column)],
          line,
          column
        };
      case 'union':
        return {
          type: 'TypeAnnotation',
          kind: 'union',
          types: type.types.map(t => this.typeToAnnotation(t, line, column)),
          line,
          column
        };
      case 'intersection':
        return {
          type: 'TypeAnnotation',
          kind: 'intersection',
          types: type.types.map(t => this.typeToAnnotation(t, line, column)),
          line,
          column
        };
      case 'function':
        return {
          type: 'TypeAnnotation',
          kind: 'function',
          name: 'Function',
          parameterTypes: type.parameters.map(p => this.typeToAnnotation(p, line, column)),
          returnType: this.typeToAnnotation(type.returnType, line, column),
          line,
          column
        };
      case 'tuple':
        return {
          type: 'TypeAnnotation',
          kind: 'tuple',
          elementTypes: type.elementTypes.map(t => this.typeToAnnotation(t, line, column)),
          line,
          column
        };
      case 'record':
        return {
          type: 'TypeAnnotation',
          kind: 'record',
          fieldTypes: type.fieldTypes.map(([keyType, valueType]) => [
            this.typeToAnnotation(keyType, line, column),
            this.typeToAnnotation(valueType, line, column)
          ]),
          line,
          column
        };
      default:
        return { type: 'TypeAnnotation', kind: 'simple', name: 'weak', line, column };
    }
  }

  /**
   * Refine weak polymorphic types based on actual usage in the program.
   * This includes refining parameter types based on how they're used and
   * refining return types based on return statements.
   */
  private refineStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration': {
        // Build a temporary environment for parameter types
        const paramTypeMap = new Map<string, Type>();
        const savedEnv = new Map(this.typeEnv);
        const savedDeclEnv = new Map(this.variableDeclEnv);
        const savedCurrentFunction = this.currentFunction;
        this.currentFunction = stmt.name;

        for (const param of stmt.parameters) {
          if (param.typeAnnotation) {
            const type = this.resolve(param.typeAnnotation);
            paramTypeMap.set(param.name, type);
            this.typeEnv.set(param.name, type);
            // Parameters don't have VariableDeclarator, but we can update param.typeAnnotation directly
            // We can store the param node itself as the "declaration"
            this.variableDeclEnv.set(param.name, param);
          }
        }

        // Collect constraints on parameter types and return type from function body
        const constraints = this.collectConstraints(stmt.body, paramTypeMap);

        // Refine parameter types based on constraints
        let paramChanged = false;
        for (const param of stmt.parameters) {
          if (param.typeAnnotation &&
              param.typeAnnotation.kind === 'simple' &&
              param.typeAnnotation.name === 'weak') {
            const constrainedType = constraints.parameters.get(param.name);
            if (constrainedType && constrainedType.kind !== 'weak' && constrainedType.kind !== 'poly') {
              param.typeAnnotation = this.typeToAnnotation(constrainedType, param.typeAnnotation.line, param.typeAnnotation.column);
              paramChanged = true;
              this.refinementChanged = true;
              // Update env
              this.typeEnv.set(param.name, constrainedType);
            }
          }
        }

        // If parameters changed, re-evaluate return type
        if (paramChanged) {
          // Update paramTypeMap with new types
          for (const param of stmt.parameters) {
            if (param.typeAnnotation) {
              paramTypeMap.set(param.name, this.resolve(param.typeAnnotation));
            }
          }

          // Re-collect constraints to get updated return type
          const newConstraints = this.collectConstraints(stmt.body, paramTypeMap);
          if (newConstraints.returnType && newConstraints.returnType.kind !== 'weak') {
            stmt.returnType = this.typeToAnnotation(newConstraints.returnType, stmt.line, stmt.column);
            this.refinementChanged = true;

            // Update function environment
            this.functionEnv.set(stmt.name, {
              parameters: stmt.parameters.map((param) => this.resolve(param.typeAnnotation!)),
              returnType: newConstraints.returnType,
            });
          }
        }

        // Recursively refine nested statements
        this.refineStatement(stmt.body);

        // After refining the body, check if we need to update return type based on refined variables
        const funcInfo = this.functionEnv.get(stmt.name);
        if (funcInfo) {
          // Re-analyze return type with current typeEnv (which has refined types)
          const returnType = this.analyzeReturnType(stmt.body);
          if (returnType) {
            // Refine if completely weak/poly
            if (funcInfo.returnType.kind === 'weak' || funcInfo.returnType.kind === 'poly') {
              if (returnType.kind !== 'weak' && returnType.kind !== 'poly') {
                Object.assign(funcInfo.returnType, returnType);
                stmt.returnType = this.typeToAnnotation(returnType, stmt.line, stmt.column);
                this.refinementChanged = true;
              }
            }
            // Or refine nested weak types
            else if (this.hasWeakTypes(funcInfo.returnType) && !this.hasWeakTypes(returnType)) {
              this.refineNestedTypes(funcInfo.returnType, returnType);
              stmt.returnType = this.typeToAnnotation(funcInfo.returnType, stmt.line, stmt.column);
              this.refinementChanged = true;
            }
          }
        }

        this.currentFunction = savedCurrentFunction;
        // Don't restore typeEnv and variableDeclEnv yet - we'll do it after analyzing return type
        // Actually, we need to restore them, but the issue is that typeEnv has the refined types
        // which we need to preserve for the return type analysis
        this.typeEnv = savedEnv;
        this.variableDeclEnv = savedDeclEnv;
        break;
      }

      case 'VariableDeclaration': {
        for (const declarator of stmt.declarations) {
           if (declarator.typeAnnotation) {
             const type = this.resolve(declarator.typeAnnotation);
             this.typeEnv.set(declarator.name, type);
             this.variableDeclEnv.set(declarator.name, declarator);
           }
           // Also refine initializer
           this.refineExpression(declarator.initializer);
           
           // Update variable type from initializer
           const initializerType = this.analyzeExpressionType(declarator.initializer, this.typeEnv);
           const varType = this.typeEnv.get(declarator.name);

           if (varType && initializerType.kind !== 'weak' && initializerType.kind !== 'poly') {
              // Refine if completely weak/poly
              if (varType.kind === 'weak' || varType.kind === 'poly') {
                  Object.assign(varType, initializerType);
                  this.updateVariableAnnotation(declarator.name, varType);
                  this.refinementChanged = true;
              }
              // Or refine nested weak types in complex types
              else if (this.hasWeakTypes(varType) && !this.hasWeakTypes(initializerType)) {
                  this.refineNestedTypes(varType, initializerType);
                  this.updateVariableAnnotation(declarator.name, varType);
                  this.refinementChanged = true;
              }
           }
        }
        break;
      }

      case 'IfStatement':
        this.refineExpression(stmt.condition);
        this.refineStatement(stmt.thenBranch);
        if (stmt.elseBranch) {
          this.refineStatement(stmt.elseBranch);
        }
        break;

      case 'WhileStatement':
        this.refineExpression(stmt.condition);
        this.refineStatement(stmt.body);
        break;

      case 'UntilStatement':
        this.refineExpression(stmt.condition);
        this.refineStatement(stmt.body);
        break;

      case 'ForStatement':
        this.refineExpression(stmt.iterable);
        // Add loop variable to env
        const savedEnv = new Map(this.typeEnv);
        const savedDeclEnv = new Map(this.variableDeclEnv);
        
        // We need to infer loop variable type from iterable
        const iterableType = this.analyzeExpressionType(stmt.iterable, this.typeEnv);
        let loopVarType: Type = { kind: 'weak' };
        
        if (iterableType.kind === 'array' || iterableType.kind === 'set') {
            loopVarType = iterableType.elementType;
        } else if (iterableType.kind === 'map' || iterableType.kind === 'heapmap') {
            loopVarType = iterableType.keyType;
        } else if (iterableType.kind === 'range') {
            loopVarType = { kind: 'int' };
        }
        
        this.typeEnv.set(stmt.variable, loopVarType);
        // Loop variable doesn't have a declaration node in the same way, 
        // but we might not need to update its annotation since it's implicit in ForStatement?
        // But ForStatement doesn't have type annotation for variable usually.
        
        this.refineStatement(stmt.body);
        
        this.typeEnv = savedEnv;
        this.variableDeclEnv = savedDeclEnv;
        break;

      case 'BlockStatement':
        // Don't save/restore environment for function bodies - parent will handle it
        // This allows refined types to be visible when analyzing return types
        for (const s of stmt.statements) {
          this.refineStatement(s);
        }
        break;

      case 'ReturnStatement':
        if (stmt.value) {
          this.refineExpression(stmt.value);
        }
        break;
        
      case 'ExpressionStatement':
        this.refineExpression(stmt.expression);
        break;
        
      case 'AssignmentStatement':
        this.refineExpression(stmt.target);
        this.refineExpression(stmt.value);
        // Refine target from value
        const valueType = this.analyzeExpressionType(stmt.value, this.typeEnv);
        this.refineExpressionFromType(stmt.target, valueType);
        break;
    }
  }

  private refineExpression(expr: Expression): void {
    switch (expr.type) {
      case 'CallExpression':
        for (const arg of expr.arguments) {
          this.refineExpression(arg);
        }
        if (expr.callee.type === 'MemberExpression') {
          this.refineMethodCall(expr.callee, expr.arguments);
        } else if (expr.callee.type === 'Identifier') {
          this.refineFunctionCall(expr.callee.name, expr.arguments);
        }
        break;

      case 'BinaryExpression':
        this.refineExpression(expr.left);
        this.refineExpression(expr.right);
        break;
        
      case 'UnaryExpression':
        this.refineExpression(expr.operand);
        break;
        
      case 'ArrayLiteral':
        for (const elem of expr.elements) {
          this.refineExpression(elem);
        }
        break;
        
      case 'MemberExpression':
        this.refineExpression(expr.object);
        break;
        
      case 'IndexExpression':
        this.refineExpression(expr.object);
        this.refineExpression(expr.index);
        break;
    }
  }

  private refineMethodCall(callee: MemberExpression, args: Expression[]): void {
    if (callee.object.type === 'Identifier') {
      const varName = callee.object.name;
      const varType = this.typeEnv.get(varName);
      
      if (!varType) return;

      const methodName = callee.property.name;

      // Check if variable type was inferred
      const decl = this.variableDeclEnv.get(varName);
      const isInferred = decl && decl.typeAnnotation && decl.typeAnnotation.isInferred;

      if (varType.kind === 'map') {
        if (methodName === 'set' && args.length === 2) {
           this.refineTypeFromExpression(varType.keyType, args[0], isInferred);
           this.refineTypeFromExpression(varType.valueType, args[1], isInferred);
           
           this.refineExpressionFromType(args[0], varType.keyType);
           this.refineExpressionFromType(args[1], varType.valueType);
        }
        if (methodName === 'get' && args.length === 1) {
           this.refineTypeFromExpression(varType.keyType, args[0], isInferred);
           this.refineExpressionFromType(args[0], varType.keyType);
        }
      }
      else if (varType.kind === 'set') {
        if ((methodName === 'add' || methodName === 'has') && args.length === 1) {
           this.refineTypeFromExpression(varType.elementType, args[0], isInferred);
           this.refineExpressionFromType(args[0], varType.elementType);
        }
      }
      else if (varType.kind === 'heap') {
        if (methodName === 'push' && args.length === 1) {
           this.refineTypeFromExpression(varType.elementType, args[0], isInferred);
           this.refineExpressionFromType(args[0], varType.elementType);
        }
      }
      else if (varType.kind === 'heapmap') {
         if (methodName === 'push' && args.length === 2) {
            this.refineTypeFromExpression(varType.keyType, args[0], isInferred);
            this.refineTypeFromExpression(varType.valueType, args[1], isInferred);

            this.refineExpressionFromType(args[0], varType.keyType);
            this.refineExpressionFromType(args[1], varType.valueType);
         }
      }

      // Update AST if variable type changed (it might have been refined in place)
      this.updateVariableAnnotation(varName, varType);
    }
  }

  private refineFunctionCall(functionName: string, args: Expression[]): void {
    const funcInfo = this.functionEnv.get(functionName);
    const funcDecl = this.functionDeclEnv.get(functionName);
    if (!funcInfo || !funcDecl) return;

    // Refine function parameter types based on argument types
    const argTypes = args.map(arg => this.analyzeExpressionType(arg, this.typeEnv));

    let paramsChanged = false;
    for (let i = 0; i < Math.min(funcInfo.parameters.length, argTypes.length); i++) {
      const paramType = funcInfo.parameters[i];
      const argType = argTypes[i];

      if ((paramType.kind === 'weak' || paramType.kind === 'poly') &&
          argType.kind !== 'weak' && argType.kind !== 'poly') {
        Object.assign(paramType, argType);
        paramsChanged = true;

        // Update the function declaration's parameter annotation
        if (i < funcDecl.parameters.length) {
          funcDecl.parameters[i].typeAnnotation = this.typeToAnnotation(
            argType,
            funcDecl.parameters[i].typeAnnotation?.line || 0,
            funcDecl.parameters[i].typeAnnotation?.column || 0
          );
        }
      }
    }

    // If parameters changed, re-infer return type if it's still weak
    if (paramsChanged && (funcInfo.returnType.kind === 'weak' || funcInfo.returnType.kind === 'poly')) {
      // Build parameter type map with updated types
      const paramTypeMap = new Map<string, Type>();
      for (let i = 0; i < funcDecl.parameters.length; i++) {
        paramTypeMap.set(funcDecl.parameters[i].name, funcInfo.parameters[i]);
      }

      // Re-collect constraints to get updated return type
      const constraints = this.collectConstraints(funcDecl.body, paramTypeMap);
      if (constraints.returnType && constraints.returnType.kind !== 'weak') {
        Object.assign(funcInfo.returnType, constraints.returnType);
        funcDecl.returnType = this.typeToAnnotation(
          constraints.returnType,
          funcDecl.line,
          funcDecl.column
        );
      }
    }
  }

  private hasWeakTypes(type: Type): boolean {
    if (type.kind === 'weak' || type.kind === 'poly') {
      return true;
    }
    if (type.kind === 'array') {
      return this.hasWeakTypes(type.elementType);
    }
    if (type.kind === 'map') {
      return this.hasWeakTypes(type.keyType) || this.hasWeakTypes(type.valueType);
    }
    if (type.kind === 'set' || type.kind === 'heap') {
      return this.hasWeakTypes(type.elementType);
    }
    if (type.kind === 'heapmap') {
      return this.hasWeakTypes(type.keyType) || this.hasWeakTypes(type.valueType);
    }
    if (type.kind === 'union' || type.kind === 'intersection') {
      return type.types.some(t => this.hasWeakTypes(t));
    }
    if (type.kind === 'tuple') {
      return type.elementTypes.some(t => this.hasWeakTypes(t));
    }
    if (type.kind === 'function') {
      return this.hasWeakTypes(type.returnType) || type.parameters.some(p => this.hasWeakTypes(p));
    }
    return false;
  }

  private refineNestedTypes(targetType: Type, sourceType: Type): void {
    // Recursively refine weak types in targetType with concrete types from sourceType
    if (targetType.kind === 'array' && sourceType.kind === 'array') {
      if (this.hasWeakTypes(targetType.elementType) && !this.hasWeakTypes(sourceType.elementType)) {
        if (targetType.elementType.kind === 'weak' || targetType.elementType.kind === 'poly') {
          Object.assign(targetType.elementType, sourceType.elementType);
          this.refinementChanged = true;
        } else {
          this.refineNestedTypes(targetType.elementType, sourceType.elementType);
        }
      }
    } else if (targetType.kind === 'map' && sourceType.kind === 'map') {
      if (this.hasWeakTypes(targetType.keyType) && !this.hasWeakTypes(sourceType.keyType)) {
        if (targetType.keyType.kind === 'weak' || targetType.keyType.kind === 'poly') {
          Object.assign(targetType.keyType, sourceType.keyType);
          this.refinementChanged = true;
        } else {
          this.refineNestedTypes(targetType.keyType, sourceType.keyType);
        }
      }
      if (this.hasWeakTypes(targetType.valueType) && !this.hasWeakTypes(sourceType.valueType)) {
        if (targetType.valueType.kind === 'weak' || targetType.valueType.kind === 'poly') {
          Object.assign(targetType.valueType, sourceType.valueType);
          this.refinementChanged = true;
        } else {
          this.refineNestedTypes(targetType.valueType, sourceType.valueType);
        }
      }
    } else if ((targetType.kind === 'set' || targetType.kind === 'heap') &&
               (sourceType.kind === 'set' || sourceType.kind === 'heap')) {
      if (this.hasWeakTypes(targetType.elementType) && !this.hasWeakTypes(sourceType.elementType)) {
        if (targetType.elementType.kind === 'weak' || targetType.elementType.kind === 'poly') {
          Object.assign(targetType.elementType, sourceType.elementType);
          this.refinementChanged = true;
        } else {
          this.refineNestedTypes(targetType.elementType, sourceType.elementType);
        }
      }
    } else if (targetType.kind === 'heapmap' && sourceType.kind === 'heapmap') {
      if (this.hasWeakTypes(targetType.keyType) && !this.hasWeakTypes(sourceType.keyType)) {
        if (targetType.keyType.kind === 'weak' || targetType.keyType.kind === 'poly') {
          Object.assign(targetType.keyType, sourceType.keyType);
          this.refinementChanged = true;
        } else {
          this.refineNestedTypes(targetType.keyType, sourceType.keyType);
        }
      }
      if (this.hasWeakTypes(targetType.valueType) && !this.hasWeakTypes(sourceType.valueType)) {
        if (targetType.valueType.kind === 'weak' || targetType.valueType.kind === 'poly') {
          Object.assign(targetType.valueType, sourceType.valueType);
          this.refinementChanged = true;
        } else {
          this.refineNestedTypes(targetType.valueType, sourceType.valueType);
        }
      }
    }
  }

  private refineTypeFromExpression(targetType: Type, expr: Expression, allowBroadening: boolean = false): void {
     const exprType = this.analyzeExpressionType(expr, this.typeEnv);

     if (targetType.kind === 'weak' || targetType.kind === 'poly') {
        if (exprType.kind !== 'weak' && exprType.kind !== 'poly') {
           Object.assign(targetType, exprType);
           this.refinementChanged = true;
        }
     } else if (allowBroadening) {
        if (!this.typesEqual(exprType, targetType) && exprType.kind !== 'weak' && exprType.kind !== 'poly') {
           // Broaden to union
           const oldType = JSON.parse(JSON.stringify(targetType));

           // If already union, add to it
           if (targetType.kind === 'union') {
              // Check if type already exists in union
              const exists = targetType.types.some(t => this.typesEqual(t, exprType));
              if (!exists) {
                 targetType.types.push(exprType);
                 this.refinementChanged = true;
              }
           } else {
              // Convert to union
              const newUnion: Type = {
                 kind: 'union',
                 types: [oldType, exprType]
              };

              // Clear targetType
              for (const key in targetType) {
                 delete (targetType as any)[key];
              }

              Object.assign(targetType, newUnion);
              this.refinementChanged = true;
           }
        }
     }
  }

  private refineExpressionFromType(expr: Expression, type: Type): void {
    if (expr.type === 'Identifier') {
       const varName = expr.name;
       const varType = this.typeEnv.get(varName);
       if (varType && (varType.kind === 'weak' || varType.kind === 'poly')) {
          if (type.kind !== 'weak' && type.kind !== 'poly') {
             Object.assign(varType, type);
             this.updateVariableAnnotation(varName, varType);
             this.refinementChanged = true;
          }
       }
    }
  }

  private updateVariableAnnotation(name: string, type: Type): void {
    const decl = this.variableDeclEnv.get(name);
    if (decl) {
       const wasInferred = decl.typeAnnotation?.isInferred;
       // decl is VariableDeclarator or Parameter (which has typeAnnotation property)
       decl.typeAnnotation = this.typeToAnnotation(type, decl.typeAnnotation?.line || 0, decl.typeAnnotation?.column || 0);
       if (wasInferred) {
          decl.typeAnnotation.isInferred = true;
       }
    }
  }

  /**
   * Analyze return type from a statement block, using current typeEnv
   */
  private analyzeReturnType(stmt: Statement): Type | null {
    switch (stmt.type) {
      case 'ReturnStatement':
        if (stmt.value) {
          return this.analyzeExpressionType(stmt.value, this.typeEnv);
        }
        return { kind: 'void' };

      case 'BlockStatement':
        let returnType: Type | null = null;
        for (const s of stmt.statements) {
          const stmtReturnType = this.analyzeReturnType(s);
          if (stmtReturnType) {
            if (!returnType) {
              returnType = stmtReturnType;
            } else if (!this.typesEqual(returnType, stmtReturnType)) {
              // Multiple return types - create union
              if (returnType.kind === 'union') {
                returnType.types.push(stmtReturnType);
              } else {
                returnType = {
                  kind: 'union',
                  types: [returnType, stmtReturnType]
                };
              }
            }
          }
        }
        return returnType;

      case 'IfStatement':
        const thenType = this.analyzeReturnType(stmt.thenBranch);
        const elseType = stmt.elseBranch ? this.analyzeReturnType(stmt.elseBranch) : null;
        if (thenType && elseType) {
          if (this.typesEqual(thenType, elseType)) {
            return thenType;
          }
          return {
            kind: 'union',
            types: [thenType, elseType]
          };
        }
        return thenType || elseType;

      case 'WhileStatement':
      case 'UntilStatement':
      case 'ForStatement':
        return this.analyzeReturnType(stmt.body);

      default:
        return null;
    }
  }

  /**
   * Collect type constraints from a statement based on usage patterns.
   * Returns constraints on parameters and return type.
   */
  private collectConstraints(
    stmt: Statement,
    paramTypes: Map<string, Type>
  ): { parameters: Map<string, Type>; returnType: Type | null } {
    const constraints = {
      parameters: new Map<string, Type>(),
      returnType: null as Type | null,
    };

    const collectFromStatement = (s: Statement): void => {
      switch (s.type) {
        case 'ReturnStatement':
          if (s.value) {
            this.analyzeExpressionForConstraints(s.value, paramTypes, constraints.parameters);
            const returnType = this.analyzeExpressionType(s.value, paramTypes);
            if (!constraints.returnType) {
              constraints.returnType = returnType;
            } else if (!this.typesEqual(constraints.returnType, returnType)) {
              // Multiple return types - create a union
              if (constraints.returnType.kind === 'union') {
                constraints.returnType.types.push(returnType);
              } else {
                constraints.returnType = {
                  kind: 'union',
                  types: [constraints.returnType, returnType],
                };
              }
            }
          }
          break;

        case 'VariableDeclaration':
          for (const declarator of s.declarations) {
            this.analyzeExpressionForConstraints(declarator.initializer, paramTypes, constraints.parameters);
          }
          break;

        case 'AssignmentStatement':
          this.analyzeExpressionForConstraints(s.value, paramTypes, constraints.parameters);
          break;

        case 'ExpressionStatement':
          this.analyzeExpressionForConstraints(s.expression, paramTypes, constraints.parameters);
          break;

        case 'IfStatement':
          this.analyzeExpressionForConstraints(s.condition, paramTypes, constraints.parameters);
          collectFromStatement(s.thenBranch);
          if (s.elseBranch) {
            collectFromStatement(s.elseBranch);
          }
          break;

        case 'WhileStatement':
          this.analyzeExpressionForConstraints(s.condition, paramTypes, constraints.parameters);
          collectFromStatement(s.body);
          break;

        case 'UntilStatement':
          this.analyzeExpressionForConstraints(s.condition, paramTypes, constraints.parameters);
          collectFromStatement(s.body);
          break;

        case 'ForStatement':
          this.analyzeExpressionForConstraints(s.iterable, paramTypes, constraints.parameters);
          collectFromStatement(s.body);
          break;

        case 'BlockStatement':
          for (const stmt of s.statements) {
            collectFromStatement(stmt);
          }
          break;

        case 'FunctionDeclaration':
          // Don't traverse into nested functions
          break;
      }
    };

    collectFromStatement(stmt);
    return constraints;
  }

  /**
   * Analyze an expression to determine its type, considering parameter types.
   */
  private analyzeExpressionType(expr: Expression, paramTypes: Map<string, Type>): Type {
    switch (expr.type) {
      case 'Identifier':
        return paramTypes.get(expr.name) || { kind: 'weak' };

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
        const elementTypes = expr.elements.map((e) => this.analyzeExpressionType(e, paramTypes));
        const firstType = elementTypes[0];
        const allSame = elementTypes.every((t) => this.typesEqual(t, firstType));
        if (allSame) {
          return { kind: 'array', elementType: firstType };
        }
        return { kind: 'array', elementType: { kind: 'union', types: elementTypes } };

      case 'BinaryExpression': {
        const leftType = this.analyzeExpressionType(expr.left, paramTypes);
        const rightType = this.analyzeExpressionType(expr.right, paramTypes);

        if (['+', '-', '*', '%'].includes(expr.operator)) {
          if (leftType.kind === 'int' && rightType.kind === 'int') {
            return { kind: 'int' };
          }
          if (leftType.kind === 'float' || rightType.kind === 'float') {
            return { kind: 'float' };
          }
          if (leftType.kind === 'string' && rightType.kind === 'string' && expr.operator === '+') {
            return { kind: 'string' };
          }
        }

        if (expr.operator === '/') {
          return { kind: 'int' };
        }

        if (expr.operator === '/.') {
          return { kind: 'float' };
        }

        if (['<', '<=', '>', '>=', '==', '!=', '&&', '||'].includes(expr.operator)) {
          return { kind: 'boolean' };
        }

        return { kind: 'weak' };
      }

      case 'UnaryExpression': {
        const operandType = this.analyzeExpressionType(expr.operand, paramTypes);
        if (expr.operator === '-') {
          return operandType;
        }
        if (expr.operator === '!') {
          return { kind: 'boolean' };
        }
        return { kind: 'weak' };
      }

      case 'CallExpression': {
        if (expr.callee.type === 'MemberExpression') {
          const objectType = this.analyzeExpressionType(expr.callee.object, paramTypes);
          const methodName = expr.callee.property.name;

          if (objectType.kind === 'graph') {
            if (methodName === 'size') return { kind: 'int' };
            if (methodName === 'getNeighbors') {
               return {
                 kind: 'array',
                 elementType: {
                   kind: 'record',
                   fieldTypes: [
                     [{ kind: 'string' }, objectType.nodeType],
                     [{ kind: 'string' }, { kind: 'int' }]
                   ]
                 }
               };
            }
          }

          if (objectType.kind === 'map') {
             if (methodName === 'get') return objectType.valueType;
             if (methodName === 'size') return { kind: 'int' };
          }

          if (objectType.kind === 'heapmap') {
             if (methodName === 'pop') return objectType.keyType;
             if (methodName === 'size') return { kind: 'int' };
          }

          if (objectType.kind === 'heap') {
             if (methodName === 'pop') return objectType.elementType;
             if (methodName === 'size') return { kind: 'int' };
          }

          if (objectType.kind === 'set') {
             if (methodName === 'has') return { kind: 'boolean' };
             if (methodName === 'size') return { kind: 'int' };
          }

          if (objectType.kind === 'array') {
             if (methodName === 'push') return objectType;
             if (methodName === 'size') return { kind: 'int' };
          }

          if (objectType.kind === 'string') {
             if (methodName === 'upper' || methodName === 'lower') return { kind: 'string' };
          }
        }

        // Handle regular function calls
        if (expr.callee.type === 'Identifier') {
          const funcInfo = this.functionEnv.get(expr.callee.name);
          if (funcInfo) {
            return funcInfo.returnType;
          }
        }

        return { kind: 'weak' };
      }

      case 'IndexExpression': {
        const objectType = this.analyzeExpressionType(expr.object, paramTypes);
        const indexType = this.analyzeExpressionType(expr.index, paramTypes);

        if (objectType.kind === 'array') {
           // Check if it's a slice operation
           if (indexType.kind === 'range' ||
               (indexType.kind === 'array' && indexType.elementType.kind === 'int')) {
              // Slicing returns the whole array type
              return objectType;
           }
           // Regular indexing returns element type
           return objectType.elementType;
        }
        if (objectType.kind === 'map') {
           return objectType.valueType;
        }
        if (objectType.kind === 'record') {
           const valueTypes = objectType.fieldTypes.map(pair => pair[1]);
           if (valueTypes.length === 1) return valueTypes[0];
           return { kind: 'union', types: valueTypes };
        }
        return { kind: 'weak' };
      }

      case 'RangeExpression':
        return { kind: 'range' };

      default:
        return { kind: 'weak' };
    }
  }

  /**
   * Analyze an expression to extract constraints on parameter types.
   */
  private analyzeExpressionForConstraints(
    expr: Expression,
    paramTypes: Map<string, Type>,
    constraints: Map<string, Type>
  ): void {
    switch (expr.type) {
      case 'BinaryExpression': {
        // Analyze both operands
        this.analyzeExpressionForConstraints(expr.left, paramTypes, constraints);
        this.analyzeExpressionForConstraints(expr.right, paramTypes, constraints);

        // If both operands are identifiers that are parameters, constrain them
        if (expr.left.type === 'Identifier' && paramTypes.has(expr.left.name)) {
          const rightType = this.analyzeExpressionType(expr.right, paramTypes);
          if (rightType.kind !== 'weak' && rightType.kind !== 'poly') {
            const currentConstraint = constraints.get(expr.left.name);
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'poly') {
              constraints.set(expr.left.name, rightType);
            }
          }
        }

        if (expr.right.type === 'Identifier' && paramTypes.has(expr.right.name)) {
          const leftType = this.analyzeExpressionType(expr.left, paramTypes);
          if (leftType.kind !== 'weak' && leftType.kind !== 'poly') {
            const currentConstraint = constraints.get(expr.right.name);
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'poly') {
              constraints.set(expr.right.name, leftType);
            }
          }
        }
        break;
      }

      case 'UnaryExpression':
        this.analyzeExpressionForConstraints(expr.operand, paramTypes, constraints);
        break;

      case 'CallExpression':
        // Check for method calls on parameters to infer their types
        if (expr.callee.type === 'MemberExpression' && 
            expr.callee.object.type === 'Identifier' && 
            paramTypes.has(expr.callee.object.name)) {
          
          const paramName = expr.callee.object.name;
          const methodName = expr.callee.property.name;
          const argCount = expr.arguments.length;
          
          let inferredType: Type | null = null;

          // Graph methods
          if (['getNeighbors', 'addVertex', 'addEdge', 'hasVertex', 'hasEdge', 'isDirected', 'getEdges', 'getVertices'].includes(methodName)) {
            inferredType = { kind: 'graph', nodeType: { kind: 'weak' } };
          }
          // Map methods
          else if (methodName === 'set' && argCount === 2) {
            inferredType = { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
          }
          else if (methodName === 'get' && argCount === 1) {
            inferredType = { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
          }
          else if (['keys', 'values', 'entries'].includes(methodName)) {
            inferredType = { kind: 'map', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
          }
          // Set methods
          else if (['add', 'has', 'delete'].includes(methodName) && argCount === 1) {
            inferredType = { kind: 'set', elementType: { kind: 'weak' } };
          }
          // HeapMap methods
          else if (methodName === 'push' && argCount === 2) {
            inferredType = { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } };
          }
          // BinaryTree/AVLTree methods
          else if (['insert', 'search'].includes(methodName) && argCount === 1) {
             // Ambiguous between BinaryTree and AVLTree, but maybe we can default to BinaryTree or check if we can handle ambiguity
             // For now, let's not infer if ambiguous, or maybe infer a generic tree if we had one.
             // But wait, 'insert' is also on BinaryTree.
          }

          if (inferredType) {
            const currentConstraint = constraints.get(paramName);
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'poly') {
              constraints.set(paramName, inferredType);
            }
          }
        }

        for (const arg of expr.arguments) {
          this.analyzeExpressionForConstraints(arg, paramTypes, constraints);
        }
        break;

      case 'ArrayLiteral':
        for (const elem of expr.elements) {
          this.analyzeExpressionForConstraints(elem, paramTypes, constraints);
        }
        break;

      case 'MemberExpression':
        // Check for property access on parameters
        if (expr.object.type === 'Identifier' && paramTypes.has(expr.object.name)) {
          const paramName = expr.object.name;
          const propertyName = expr.property.name;
          
          if (propertyName === 'length') {
             const currentConstraint = constraints.get(paramName);
             if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'poly') {
               constraints.set(paramName, { kind: 'array', elementType: { kind: 'weak' } });
             }
          }
        }

        this.analyzeExpressionForConstraints(expr.object, paramTypes, constraints);
        break;

      case 'IndexExpression':
        this.analyzeExpressionForConstraints(expr.object, paramTypes, constraints);
        this.analyzeExpressionForConstraints(expr.index, paramTypes, constraints);

        // If indexing a parameter with a concrete type, constrain it to be an array
        if (expr.object.type === 'Identifier' && paramTypes.has(expr.object.name)) {
          const paramType = paramTypes.get(expr.object.name)!;
          if (paramType.kind === 'weak' || paramType.kind === 'poly') {
            // Constrain to be an array
            constraints.set(expr.object.name, { kind: 'array', elementType: { kind: 'weak' } });
          }
        }
        break;

      default:
        break;
    }
  }

  private checkStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration': {
        // Safe since we fully annotate program using infer beforehand
        const paramTypes: Type[] =
          stmt.parameters.map((p) => this.resolve(p.typeAnnotation!));
        const returnType: Type = this.resolve(stmt.returnType!);

        this.functionEnv.set(stmt.name, {
          parameters: paramTypes,
          returnType,
        });

        const savedEnv = new Map(this.typeEnv);
        const savedFunction = this.currentFunction;
        this.currentFunction = stmt.name;

        for (let i = 0; i < stmt.parameters.length; i++) {
          this.typeEnv.set(stmt.parameters[i].name, paramTypes[i]);
        }

        this.checkStatement(stmt.body);

        this.typeEnv = savedEnv;
        this.currentFunction = savedFunction;
        break;
      }

      case 'VariableDeclaration': {
        for (const declarator of stmt.declarations) {
          const annotatedType = this.resolve(declarator.typeAnnotation!);
          const initializerType = this.synthExpression(declarator.initializer);
          if (!this.typesEqual(initializerType, annotatedType)) {
            throw new Error(
              `Type mismatch: expected ${this.typeToString(annotatedType)}, got ${this.typeToString(initializerType)}. At ${declarator.line}, ${declarator.column}`
            );
          }
          this.typeEnv.set(declarator.name, annotatedType);
        }
        break;
      }

      case 'IfStatement':
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        this.checkStatement(stmt.thenBranch);
        if (stmt.elseBranch) {
          this.checkStatement(stmt.elseBranch);
        }
        break;

      case 'WhileStatement':
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        this.checkStatement(stmt.body);
        break;

      case 'UntilStatement':
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        this.checkStatement(stmt.body);
        break;

      case 'ForStatement':
        const iterated = this.synthExpression(stmt.iterable);
        if (
          iterated.kind !== 'array' &&
          iterated.kind !== 'set' &&
          iterated.kind !== 'map' &&
          iterated.kind !== 'heap' &&
          iterated.kind !== 'heapmap' &&
          iterated.kind !== 'range' &&
          iterated.kind !== 'weak'
        ) {
          throw new Error(
            `Type checking: Cannot iterate over non-iterable type ${iterated.kind}. At ${stmt.iterable.line}, ${stmt.iterable.column}`
          );
        }

        const savedEnv = new Map(this.typeEnv);

        // Skip binding if variable name is '_'
        if (stmt.variable !== '_') {
          if (iterated.kind === 'weak') {
            this.typeEnv.set(stmt.variable, { kind: 'weak' });
          } else if (iterated.kind === 'array' || iterated.kind === 'set') {
            this.typeEnv.set(stmt.variable, iterated.elementType);
          } else if (iterated.kind === 'map') {
            this.typeEnv.set(stmt.variable, iterated.keyType);
          } else if (iterated.kind === 'range') {
            this.typeEnv.set(stmt.variable, { kind: 'int' });
          }
        }

        this.checkStatement(stmt.body);
        this.typeEnv = savedEnv;
        break;

      case 'ReturnStatement':
        if (!this.currentFunction) {
          throw new Error(
            `Type checking: return statement outside of function. At ${stmt.line}, ${stmt.column}`
          );
        }

        const funcInfo = this.functionEnv.get(this.currentFunction);
        if (!funcInfo) {
          throw new Error(
            `CRITICAL! Internal error: function ${this.currentFunction} not found in function environment`
          );
        }

        if (stmt.value) {
          const returnType = this.synthExpression(stmt.value);
          if (!this.typesEqual(returnType, funcInfo.returnType)) {
            throw new Error(
              `Return type mismatch: expected ${this.typeToString(funcInfo.returnType)}, got ${this.typeToString(returnType)}. At ${stmt.line}, ${stmt.column}`
            );
          }
        } else {
          // Return without a value - should be void
          if (!this.typesEqual({ kind: 'void' }, funcInfo.returnType)) {
            throw new Error(
              `Return type mismatch: expected ${this.typeToString(funcInfo.returnType)}, got void. At ${stmt.line}, ${stmt.column}`
            );
          }
        }
        break;

      case 'BlockStatement':
        for (const s of stmt.statements) {
          this.checkStatement(s);
        }
        break;

      case 'ExpressionStatement':
        this.synthExpression(stmt.expression);
        break;
    }
  }

  private isWeak(type: Type): boolean {
    if (type.kind === 'weak') return true;
    if (type.kind === 'union') {
      return type.types.some(t => this.isWeak(t));
    }
    return false;
  }

  private getNumericKind(type: Type): 'int' | 'float' | null {
    if (type.kind === 'int') return 'int';
    if (type.kind === 'float') return 'float';
    if (type.kind === 'intersection') {
       const kinds = type.types.map(t => this.getNumericKind(t)).filter(k => k !== null);
       if (kinds.length === 0) return null;
       if (kinds.includes('int')) return 'int';
       if (kinds.includes('float')) return 'float';
       return null;
    }
    if (type.kind === 'union') {
       const kinds = type.types.map(t => this.getNumericKind(t));
       if (kinds.some(k => k === null)) return null;
       if (kinds.includes('float')) return 'float';
       return 'int';
    }
    return null;
  }

  private checkExpression(expr: Expression, expectedType: Type): void {
    const actualType = this.synthExpression(expr);
    if (!this.typesEqual(actualType, expectedType)) {
      throw new Error(
        `Type mismatch: expected ${this.typeToString(expectedType)}, got ${this.typeToString(actualType)}. At ${expr.line}, ${expr.column}`
      );
    }
  }

  private synthExpression(expr: Expression): Type {
    switch (expr.type) {
      case 'TypeOfExpression': {
        // typeof returns a string representing the type
        this.synthExpression(expr.operand);
        return { kind: 'string' };
      }

      case 'AssertExpression': {
        // Check that condition is boolean
        this.checkExpression(expr.condition, { kind: 'boolean' });
        // Check that message is a string
        this.checkExpression(expr.message, { kind: 'string' });
        // assert returns void
        return { kind: 'void' };
      }

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
          return { kind: 'array', elementType: { kind: 'poly' } };
        }

        const elementTypes = expr.elements.map((e) => this.synthExpression(e));
        const firstType = elementTypes[0];
        const allSame = elementTypes.every((t) => this.typesEqual(t, firstType) && this.typesEqual(firstType, t));

        if (allSame) {
          return { kind: 'array', elementType: firstType };
        }

        return {
          kind: 'array',
          elementType: { kind: 'union', types: elementTypes },
        };

      case 'Identifier': {
        // Underscore cannot be used as a value
        if (expr.name === '_') {
          throw new Error(`Type checking: underscore (_) cannot be used as a value, at ${expr.line}, ${expr.column}`);
        }
        const type = this.typeEnv.get(expr.name);
        if (!type) {
          throw new Error(`Type checking: undefined variable ${expr.name}, at ${expr.line}, ${expr.column}`);
        }
        return type;
      }

      case 'RangeExpression': {
        // Range expressions can be int..int or string..string
        if (expr.start) {
          const startType = this.synthExpression(expr.start);
          if (expr.end) {
            const endType = this.synthExpression(expr.end);
            
            if (startType.kind === 'weak' || endType.kind === 'weak') {
              return { kind: 'array', elementType: { kind: 'int' } };
            }

            // Both must be the same type
            if (startType.kind === 'int' && endType.kind === 'int') {
              // Finite integer range returns an array of integers
              return { kind: 'array', elementType: { kind: 'int' } };
            } else if (startType.kind === 'string' && endType.kind === 'string') {
              // String range returns an array of strings
              return { kind: 'array', elementType: { kind: 'string' } };
            } else {
              throw new Error(`Type checking: range start and end must be the same type (int or string), at ${expr.line}, ${expr.column}`);
            }
          } else {
            // Infinite range (e.g., 0..)
            if (startType.kind === 'int' || startType.kind === 'weak') {
              return { kind: 'range' };
            } else {
              throw new Error(`Type checking: infinite ranges are only supported for integers, at ${expr.line}, ${expr.column}`);
            }
          }
        } else {
          // Start defaults to 0
          if (expr.end) {
            const endType = this.synthExpression(expr.end);
            if (endType.kind === 'int' || endType.kind === 'weak') {
              return { kind: 'array', elementType: { kind: 'int' } };
            } else {
              throw new Error(`Type checking: range with default start (0) requires integer end, at ${expr.line}, ${expr.column}`);
            }
          } else {
            // Both start and end are missing - should not happen
            throw new Error(`Type checking: range must have at least a start or end, at ${expr.line}, ${expr.column}`);
          }
        }
      }

      case 'BinaryExpression': {
        const leftType = this.synthExpression(expr.left);
        const rightType = this.synthExpression(expr.right);

        if (this.isWeak(leftType) || this.isWeak(rightType)) {
          if (['<', '<=', '>', '>=', '==', '!=', '&&', '||'].includes(expr.operator)) {
            return { kind: 'boolean' };
          }
          return { kind: 'weak' };
        }

        const leftNumeric = this.getNumericKind(leftType);
        const rightNumeric = this.getNumericKind(rightType);

        // Arithmetic operators: +, -, *, % (work on int and float)
        if (['+', '-', '*', '%'].includes(expr.operator)) {
          if (leftNumeric && rightNumeric) {
             if (leftNumeric === 'float' || rightNumeric === 'float') {
                return { kind: 'float' };
             }
             return { kind: 'int' };
          }
        }

        // Integer division operator: / (requires both operands to be int, returns int)
        if (expr.operator === '/') {
           if (leftNumeric === 'int' && rightNumeric === 'int') {
              return { kind: 'int' };
           }
        }

        // Float division operator: /. (works on int or float, returns float)
        if (expr.operator === '/.') {
           if (leftNumeric && rightNumeric) {
              return { kind: 'float' };
           }
        }

        // Bitwise shift operators: << and >> (require both operands to be int)
        if (['<<', '>>'].includes(expr.operator)) {
           if (leftNumeric === 'int' && rightNumeric === 'int') {
              return { kind: 'int' };
           }
        }

        // String concatenation
        if (
          expr.operator === '+' &&
          leftType.kind === 'string' &&
          rightType.kind === 'string'
        ) {
          return { kind: 'string' };
        }

        // Comparison operators (work on int or float)
        if (['<', '<=', '>', '>='].includes(expr.operator)) {
           if (leftNumeric && rightNumeric) {
              return { kind: 'boolean' };
           }
        }

        // Equality operators (allow comparison if types are compatible)
        if (['==', '!='].includes(expr.operator)) {
          // Types can be compared if they're equal or one is assignable to the other
          if (this.typesEqual(leftType, rightType) ||
            this.typesEqual(rightType, leftType)) {
            return { kind: 'boolean' };
          }
        }

        // Logical operators
        if (
          ['&&', '||'].includes(expr.operator) &&
          leftType.kind === 'boolean' &&
          rightType.kind === 'boolean'
        ) {
          return { kind: 'boolean' };
        }

        throw new Error(
          `Type checking: invalid binary operation, ${this.typeToString(leftType)} ${expr.operator} ${this.typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      case 'UnaryExpression': {
        const operandType = this.synthExpression(expr.operand);

        if (expr.operator === '-') {
          if (operandType.kind === 'int') {
            return { kind: 'int' };
          } else if (operandType.kind === 'float') {
            return { kind: 'float' };
          }
        }

        if (expr.operator === '!' && operandType.kind === 'boolean') {
          return { kind: 'boolean' };
        }

        throw new Error(
          `Type checking: invalid unary operation, ${expr.operator} ${this.typeToString(operandType)}`
        );
      }

      case 'CallExpression': {
        const callee = expr.callee;
        let funcType: Type;

        if (callee.type === 'Identifier') {
          const envType = this.functionEnv.get(callee.name);
          if (envType) {
            funcType = {
              kind: 'function',
              parameters: envType.parameters,
              returnType: envType.returnType,
              variadic: envType.variadic
            };
          } else {
            try {
              // infer for error reporting
              funcType = this.synthExpression(callee);
            } catch (e) {
              throw new Error(`Type checking: undefined function ${callee.name}, at ${callee.line}, ${callee.column}`);
            }
          }
        } else {
          // infer for error reporting
          funcType = this.synthExpression(callee);
        }

        if (funcType.kind === 'weak') {
          return { kind: 'weak' };
        }

        if (funcType.kind !== 'function') {
          throw new Error(`Type checking: cannot call non-function type: ${this.typeToString(funcType)}, at ${expr.line}, ${expr.column}`);
        }

        if (funcType.variadic) {
          for (let i = 0; i < expr.arguments.length; i++) {
            if (i < funcType.parameters.length) {
              this.checkExpression(expr.arguments[i], funcType.parameters[i]);
            } else if (funcType.parameters.length > 0) {
              this.checkExpression(expr.arguments[i], funcType.parameters[funcType.parameters.length - 1]);
            } else {
              throw new Error(`Type checking: variadic function must have at least one parameter type, at ${expr.line}, ${expr.column}`);
            }
          }
        } else {
          if (expr.arguments.length !== funcType.parameters.length) {
            throw new Error(
              `Type checking: function expects ${funcType.parameters.length} arguments, got ${expr.arguments.length}, at ${expr.line}, ${expr.column}`
            );
          }

          for (let i = 0; i < expr.arguments.length; i++) {
            this.checkExpression(expr.arguments[i], funcType.parameters[i]);
          }
        }

        return funcType.returnType;
      }

      case 'MemberExpression': {
        const objectType = this.synthExpression(expr.object);
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

        if (objectType.kind === 'weak') {
          return { kind: 'weak' };
        }

        throw new Error(
          `Type checking: property ${expr.property.name} does not exist on type ${this.typeToString(objectType)}, at ${expr.line}, ${expr.column}`
        );
      }

      case 'IndexExpression': {
        const objectType = this.synthExpression(expr.object);
        const indexType = this.synthExpression(expr.index);

        if (objectType.kind === 'array') {
          if (indexType.kind === 'int') {
            return objectType.elementType;
          }
          // Support array slicing with ranges
          if (indexType.kind === 'array' && indexType.elementType.kind === 'int') {
             // Range expression returns array<int>, so this covers ranges
             return objectType; // Slicing returns an array of the same type
          }
          // Support array slicing with infinite ranges
          if (indexType.kind === 'range') {
             return objectType;
          }
        }

        if (objectType.kind === 'map') {
          this.checkExpression(expr.index, objectType.keyType);
          return objectType.valueType;
        }

        if (objectType.kind === 'tuple') {
          // Tuples are indexed by integers
          if (indexType.kind !== 'int') {
            throw new Error(
              `Type checking: cannot index tuple with non-integer type ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
            );
          } else {
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
          }
        }

        if (objectType.kind === 'record') {
          // Check that the index type matches the record's key type
          let indexKeyType: Type | undefined = objectType.fieldTypes[0]?.[0];
          if (this.typesEqual(indexType, indexKeyType ? indexKeyType! : { kind: 'poly' })) {
            // Return a union of all possible value types since we don't track actual field names
            if (objectType.fieldTypes.length === 1) {
              return objectType.fieldTypes[0][1];
            }
            // Create a union of all value types
            const valueTypes = objectType.fieldTypes.map(([_, valueType]) => valueType);
            // Deduplicate if all types are the same
            const allSame = valueTypes.every(t => this.typesEqual(t, valueTypes[0]));
            if (allSame) {
              return valueTypes[0];
            }
            return {
              kind: 'union',
              types: valueTypes
            };
          }
          throw new Error(
            `Type checking: cannot index record with key type ${this.typeToString(indexKeyType!)} using index type ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
          );
        }

        if (objectType.kind === 'weak') {
          return { kind: 'weak' };
        }

        throw new Error(
          `Type checking: cannot index type ${this.typeToString(objectType)} with ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
        );
      }

      default:
        throw new Error(`Type checking: unknown expression type ${(expr as any).type}, at ${expr.line}, ${expr.column}`);
    }
  }

  private resolve(annotation: TypeAnnotation): Type {

    if (annotation.kind === 'union') {
      return {
        kind: 'union',
        types: annotation.types.map(t => this.resolve(t))
      };
    } else if (annotation.kind === 'intersection') {
      return {
        kind: 'intersection',
        types: annotation.types.map(t => this.resolve(t))
      };
    } else if (annotation.kind === 'simple') {
      switch (annotation.name) {
        case 'int':
        case 'number':
          return { kind: 'int' };
        case 'float':
          return { kind: 'float' };
        case 'string':
          return { kind: 'string' };
        case 'bool':
        case 'boolean':
          return { kind: 'boolean' };
        case 'void':
          return { kind: 'void' };
        case 'weak':
          // Weak types are placeholders that should be refined
          // They're valid during inference but indicate polymorphic types
          return { kind: 'weak' };
        case 'poly':
          return { kind: 'poly' };
      }
    } else if (annotation.kind === 'generic') {
      switch (annotation.name) {
        case 'Array':
          if (
            !annotation.typeParameters ||
            annotation.typeParameters.length !== 1
          ) {
            throw new Error(`Type checking: Array type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'array',
            elementType: this.resolve(annotation.typeParameters[0]),
          };

        case 'Map':
          if (
            !annotation.typeParameters ||
            annotation.typeParameters.length !== 2
          ) {
            throw new Error(`Type checking: Map type requires exactly two type parameters, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'map',
            keyType: this.resolve(annotation.typeParameters[0]),
            valueType: this.resolve(annotation.typeParameters[1]),
          };

        case 'Set':
          if (
            !annotation.typeParameters ||
            annotation.typeParameters.length !== 1
          ) {
            throw new Error(`Type checking: Set type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'set',
            elementType: this.resolve(annotation.typeParameters[0]),
          };

        case 'MinHeap':
        case 'MaxHeap':
          if (!annotation.typeParameters || annotation.typeParameters.length !== 1) {
            throw new Error(`Type checking: Heap type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'heap',
            elementType: this.resolve(annotation.typeParameters[0]),
          };

        case 'MinHeapMap':
        case 'MaxHeapMap':
          if (!annotation.typeParameters || annotation.typeParameters.length !== 2) {
            throw new Error(`Type checking: HeapMap type requires exactly two type parameters, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'heapmap',
            keyType: this.resolve(annotation.typeParameters[0]),
            valueType: this.resolve(annotation.typeParameters[1]),
          };

        case 'Graph':
          if (!annotation.typeParameters || annotation.typeParameters.length !== 1) {
            throw new Error(`Type checking: Graph type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'graph',
            nodeType: this.resolve(annotation.typeParameters[0]),
          };

        case 'BinaryTree':
          if (!annotation.typeParameters || annotation.typeParameters.length !== 1) {
            throw new Error(`Type checking: BinaryTree type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'binarytree',
            elementType: this.resolve(annotation.typeParameters[0]),
          };

        case 'AVLTree':
          if (!annotation.typeParameters || annotation.typeParameters.length !== 1) {
            throw new Error(`Type checking: AVLTree type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'avltree',
            elementType: this.resolve(annotation.typeParameters[0]),
          };
      }
    } else if (annotation.kind === 'tuple') {
      return {
        kind: 'tuple',
        elementTypes: annotation.elementTypes.map(t => this.resolve(t))
      };
    } else if (annotation.kind === 'record') {
      return {
        kind: 'record',
        fieldTypes: annotation.fieldTypes.map(([keyType, valueType]) => [
          this.resolve(keyType),
          this.resolve(valueType)
        ])
      };
    } else { //(annotation.kind === 'function')
      switch (annotation.name) {
        case 'Function':
          if (!annotation.returnType) {
            throw new Error(`Type checking: Function type requires a return type, at ${annotation.line}, ${annotation.column}`);
          }
          return {
            kind: 'function',
            parameters: annotation.parameterTypes
              ? annotation.parameterTypes.map((param) => this.resolve(param))
              : [],
            returnType: this.resolve(annotation.returnType),
            variadic: false, // User cannot define variadic functions via type annotations
          };
      }
    }

    throw new Error(`Type checking: cannot resolve annotation of type ${annotation.name}`);
  }


  private typesEqual(t1: Type, t2: Type): boolean {
    // Fast path: check if types are the same object reference
    if (t1 === t2) return true;

    // Fast path: simple types
    if (t1.kind === 'poly' || t2.kind === 'poly') return true;
    if (t1.kind === 'weak' || t2.kind === 'weak') return true;

    // Check cache for complex type comparisons
    const cacheKey = `${this.typeToStringForCache(t1)}|${this.typeToStringForCache(t2)}`;
    const cached = this.typeEqualityCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const result = this.typesEqualUncached(t1, t2);
    this.typeEqualityCache.set(cacheKey, result);
    return result;
  }

  private typesEqualUncached(t1: Type, t2: Type): boolean {
    // Handle union types (A | B is assignable to C if A or B is assignable to C)
    if (t1.kind === 'union' && t2.kind === 'union') {
      // Both are unions: check if they have the same types (order independent)
      if (t1.types.length !== t2.types.length) return false;
      return t1.types.every((type1) =>
        t2.types.some((type2) => this.typesEqual(type1, type2))
      );
    }
    if (t1.kind === 'union') {
      // t1 is union, t2 is not: t1 is assignable to t2 if ALL members are assignable to t2
      return t1.types.every(unionMember => this.typesEqual(unionMember, t2));
    }
    if (t2.kind === 'union') {
      // t2 is union, t1 is not: t1 is assignable to t2 if t1 is assignable to ANY member
      return t2.types.some(unionMember => this.typesEqual(t1, unionMember));
    }

    // Handle intersection types (A & B is assignable to C if it's assignable to ALL of A, B)
    if (t1.kind === 'intersection' && t2.kind === 'intersection') {
      // Both are intersections: check if they have the same types (order independent)
      if (t1.types.length !== t2.types.length) return false;
      return t1.types.every((type1) =>
        t2.types.some((type2) => this.typesEqual(type1, type2))
      );
    }
    if (t1.kind === 'intersection') {
      // t1 is intersection, t2 is not: t1 is assignable to t2 if it's assignable to ANY member of t1
      // This is because intersection is a subtype of all its members
      return t1.types.some(intersectionMember => this.typesEqual(intersectionMember, t2));
    }
    if (t2.kind === 'intersection') {
      // t2 is intersection, t1 is not: t1 is assignable to t2 if t1 is assignable to ALL members
      return t2.types.every(intersectionMember => this.typesEqual(t1, intersectionMember));
    }

    if (t1.kind !== t2.kind) return false;

    if (t1.kind === 'array' && t2.kind === 'array') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'map' && t2.kind === 'map') {
      return (
        this.typesEqual(t1.keyType, t2.keyType) &&
        this.typesEqual(t1.valueType, t2.valueType)
      );
    }

    if (t1.kind === 'set' && t2.kind === 'set') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'heap' && t2.kind === 'heap') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'heapmap' && t2.kind === 'heapmap') {
      return (
        this.typesEqual(t1.keyType, t2.keyType) &&
        this.typesEqual(t1.valueType, t2.valueType)
      );
    }

    if (t1.kind === 'graph' && t2.kind === 'graph') {
      return this.typesEqual(t1.nodeType, t2.nodeType);
    }

    if (t1.kind === 'binarytree' && t2.kind === 'binarytree') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'avltree' && t2.kind === 'avltree') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'record' && t2.kind === 'record') {
      if (t1.fieldTypes.length !== t2.fieldTypes.length) return false;
      for (let i = 0; i < t1.fieldTypes.length; i++) {
        const [keyType1, valueType1] = t1.fieldTypes[i];
        const [keyType2, valueType2] = t2.fieldTypes[i];
        if (
          !this.typesEqual(keyType1, keyType2) ||
          !this.typesEqual(valueType1, valueType2)
        ) {
          return false;
        }
      }
      return true;
    }

    if (t1.kind === 'tuple' && t2.kind === 'tuple') {
      if (t1.elementTypes.length !== t2.elementTypes.length) return false;
      return t1.elementTypes.every((type1, i) => this.typesEqual(type1, t2.elementTypes[i]));
    }

    return true;
  }

  private typeToStringForCache(type: Type): string {
    // Lightweight version of typeToString for cache keys
    // Uses JSON.stringify for simplicity but could be optimized further
    return JSON.stringify(type);
  }

  private typeToString(type: Type): string {
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
      case 'range':
        return 'Range';
      case 'array':
        return `Array<${this.typeToString(type.elementType)}>`;
      case 'map':
        return `Map<${this.typeToString(type.keyType)}, ${this.typeToString(type.valueType)}>`;
      case 'set':
        return `Set<${this.typeToString(type.elementType)}>`;
      case 'binarytree':
        return `BinaryTree<${this.typeToString(type.elementType)}>`;
      case 'avltree':
        return `AVLTree<${this.typeToString(type.elementType)}>`;
      case 'heap':
        return `Heap<${this.typeToString(type.elementType)}>`;
      case 'heapmap':
        return `HeapMap<${this.typeToString(type.keyType)}, ${this.typeToString(type.valueType)}>`;
      case 'graph':
        return `Graph<${this.typeToString(type.nodeType)}>`;
      case 'record': {
        const fields = type.fieldTypes
          .map(([name, fieldType]) => `${name}: ${this.typeToString(fieldType)}`)
          .join(', ');
        return `{ ${fields} }`;
      }
      case 'tuple':
        return `(${type.elementTypes.map((t) => this.typeToString(t)).join(', ')})`;
      case 'union':
        return type.types.map((t) => this.typeToString(t)).join(' | ');
      case 'intersection':
        return type.types.map((t) => this.typeToString(t)).join(' & ');
      case 'function':
        return `(${type.parameters.map((p) => this.typeToString(p)).join(', ')}) -> ${this.typeToString(type.returnType)}`;
    }
  }
}
