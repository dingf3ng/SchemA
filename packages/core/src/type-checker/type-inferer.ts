import { Program, Statement, Expression } from '../transpiler/ast-types';
import { FunEnv, initializeBuiltins, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToAnnotation, typeToString } from './type-checker-utils';
import { synthExpression, TypeSynthContext} from './expression-synth-utils';

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
                // Multiple return types - error
                throw new Error(`Type inference error: function ${stmt.name} has multiple return types (${typeToString(returnTypeInferred)} and ${typeToString(typeInferred)}).`);
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
            // Mark the annotation as inferred
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
          } else if (iterableType.kind === 'weak') {
            // Weak polymorphic iterable - loop variable is also weak (can be refined)
            this.typeEnv.set(stmt.variable, { kind: 'weak' });
          } else {
            // Unknown iterable type, use dynamic (static type cannot be determined)
            this.typeEnv.set(stmt.variable, { kind: 'dynamic' });
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
   * Infer the type of an expression without checking against environment.
   * This is used during the inference phase before type checking.
   * Delegates to the shared synthesizeExpressionType function.
   */
  private inferExpressionType(expr: Expression): Type {
    const ctx: TypeSynthContext = {
      getVariableType: (name) => this.typeEnv.get(name),
      getFunctionInfo: (name) => this.functionEnv.get(name),
      typeEqualityCache: this.typeEqualityCache,
    };
    return synthExpression(expr, ctx);
  }
}

export function infer(program: Program): { typeEnv: TypeEnv; functionEnv: FunEnv; functionDeclEnv: Map<string, any> } {
  const inferer = new TypeInferer();
  return inferer.infer(program);
}
