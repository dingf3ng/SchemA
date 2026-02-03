import { Program, Statement, Expression, StructDeclaration } from '../transpiler/ast-types';
import { FunEnv, initializeBuiltins, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToAnnotation, typeToString, structRegistry, StructDefinition } from './type-checker-utils';
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
      } else if (statement.type === 'StructDeclaration') {
        // Pre-register struct constructor for forward references
        const typeParams: Type[] = statement.typeParameters.map(() => ({ kind: 'weak' as const }));
        this.functionEnv.set(statement.name, {
          parameters: [],
          returnType: { kind: 'struct', name: statement.name, typeParameters: typeParams }
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

      case 'StructDeclaration': {
        this.registerStructDeclaration(stmt);
        break;
      }
    }
  }

  /**
   * Register a struct declaration: creates struct definition and constructor
   */
  private registerStructDeclaration(stmt: StructDeclaration): void {
    const structName = stmt.name;
    const typeParamNames = stmt.typeParameters;

    // Create a mapping from type parameter names to weak types for field resolution
    const typeParamMap = new Map<string, Type>();
    for (const paramName of typeParamNames) {
      typeParamMap.set(paramName, { kind: 'weak' });
    }

    // Process fields - infer types for fields without annotations
    const fields: StructDefinition['fields'] = [];
    for (const field of stmt.fields) {
      let fieldType: Type;
      let hasTypeParam = false;

      if (field.typeAnnotation) {
        // Check if the type annotation references a type parameter
        if (field.typeAnnotation.kind === 'simple' && typeParamMap.has(field.typeAnnotation.name)) {
          // Direct type parameter reference (e.g., data val: T)
          fieldType = { kind: 'weak' };
          hasTypeParam = true;
        } else if (field.typeAnnotation.kind === 'generic') {
          // Generic type that may contain type parameters (e.g., Array<T>)
          fieldType = this.resolveTypeWithParams(field.typeAnnotation, typeParamMap);
          hasTypeParam = this.containsTypeParam(field.typeAnnotation, typeParamMap);
        } else {
          fieldType = resolve(field.typeAnnotation);
        }
      } else {
        // Infer type from initializer
        fieldType = this.inferExpressionType(field.initializer);
      }

      fields.push({ name: field.name, type: fieldType, hasTypeParam });
    }

    // Process methods - create method signatures
    const methods = new Map<string, { parameters: Type[]; returnType: Type }>();
    for (const method of stmt.methods) {
      const paramTypes: Type[] = [];
      for (const param of method.parameters) {
        if (param.typeAnnotation) {
          if (param.typeAnnotation.kind === 'simple' && typeParamMap.has(param.typeAnnotation.name)) {
            paramTypes.push({ kind: 'weak' });
          } else {
            paramTypes.push(resolve(param.typeAnnotation));
          }
        } else {
          paramTypes.push({ kind: 'weak' });
        }
      }

      let returnType: Type = { kind: 'weak' };
      if (method.returnType) {
        if (method.returnType.kind === 'simple' && typeParamMap.has(method.returnType.name)) {
          returnType = { kind: 'weak' };
        } else {
          returnType = resolve(method.returnType);
        }
      } else {
        // Infer return type from method body
        // Save current state
        const savedEnv = new Map(this.typeEnv);
        const savedInferredReturnTypes = this.inferredReturnTypes;
        this.inferredReturnTypes = [];

        // Add struct fields to type environment for method body inference
        for (const field of fields) {
          this.typeEnv.set(field.name, field.type);
        }

        // Add method parameters to type environment
        for (let i = 0; i < method.parameters.length; i++) {
          this.typeEnv.set(method.parameters[i].name, paramTypes[i]);
        }

        // Process method body to collect return types
        this.inferStatement(method.body);

        // Determine return type from collected types
        let inferredReturnType: Type | undefined = undefined;
        for (const typeInferred of this.inferredReturnTypes) {
          if (!inferredReturnType) {
            inferredReturnType = typeInferred;
          } else if (!typesEqual(inferredReturnType, typeInferred, this.typeEqualityCache)) {
            // Multiple return types - keep as weak for now (will be checked later)
            inferredReturnType = { kind: 'weak' };
            break;
          }
        }

        if (inferredReturnType) {
          returnType = inferredReturnType;
        } else {
          // No return statements - default to void
          returnType = { kind: 'void' };
        }

        // Restore state
        this.typeEnv = savedEnv;
        this.inferredReturnTypes = savedInferredReturnTypes;
      }

      methods.set(method.name, { parameters: paramTypes, returnType });
    }

    // Register struct definition in the global registry
    const structDef: StructDefinition = {
      name: structName,
      typeParameterNames: typeParamNames,
      fields,
      methods
    };
    structRegistry.set(structName, structDef);

    // Register constructor in function environment
    // Constructor returns the struct type with weak type parameters
    const typeParams: Type[] = typeParamNames.map(() => ({ kind: 'weak' as const }));
    this.functionEnv.set(structName, {
      parameters: [],
      returnType: { kind: 'struct', name: structName, typeParameters: typeParams }
    });
  }

  /**
   * Resolve a type annotation, replacing type parameters with weak types
   */
  private resolveTypeWithParams(annotation: any, typeParamMap: Map<string, Type>): Type {
    if (annotation.kind === 'simple') {
      if (typeParamMap.has(annotation.name)) {
        return { kind: 'weak' };
      }
      return resolve(annotation);
    } else if (annotation.kind === 'generic') {
      // Handle generic types like Array<T>
      const resolvedParams = annotation.typeParameters.map((p: any) =>
        this.resolveTypeWithParams(p, typeParamMap)
      );

      // Reconstruct the generic type with resolved parameters
      switch (annotation.name) {
        case 'Array':
          return { kind: 'array', elementType: resolvedParams[0] };
        case 'Map':
          return { kind: 'map', keyType: resolvedParams[0], valueType: resolvedParams[1] };
        case 'Set':
          return { kind: 'set', elementType: resolvedParams[0] };
        default:
          return resolve(annotation);
      }
    }
    return resolve(annotation);
  }

  /**
   * Check if a type annotation contains any type parameters
   */
  private containsTypeParam(annotation: any, typeParamMap: Map<string, Type>): boolean {
    if (annotation.kind === 'simple') {
      return typeParamMap.has(annotation.name);
    } else if (annotation.kind === 'generic') {
      return annotation.typeParameters.some((p: any) => this.containsTypeParam(p, typeParamMap));
    }
    return false;
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
