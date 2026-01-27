import { Program, Statement, Expression, MemberExpression, StringLiteral } from '../transpiler/ast-types';
import { synthMemberExpression } from './member-utils';
import { FunEnv, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToAnnotation } from './type-checker-utils';
import { synthExpression, TypeSynthContext} from './expression-synth-utils';

/**
 * TypeRefiner is responsible for refining weak polymorphic types into more precise types.
 * It analyzes usage patterns and constraints to determine the most specific types possible.
 */
class TypeRefiner {
  // Maps variable names to their types
  private typeEnv: TypeEnv = new Map();

  // Maps function names to their parameter types and return type
  private functionEnv: FunEnv = new Map();

  // Maps variable names to their declarations (for updating annotations)
  private variableDeclEnv: Map<string, any> = new Map();

  // Maps function names to their declarations (for updating annotations during refinement)
  private functionDeclEnv: Map<string, any> = new Map();

  // Current function being refined (for context)
  private currentFunction: string | null = null;

  // Optimization: Type equality cache to avoid redundant comparisons
  private typeEqualityCache: Map<string, boolean> = new Map();

  // Optimization: Track if any changes were made during refinement
  private refinementChanged: boolean = false;

  constructor(
    infered: { typeEnv: TypeEnv; functionEnv: FunEnv; functionDeclEnv: Map<string, any> }
  ) {
    this.typeEnv = infered.typeEnv;
    this.functionEnv = infered.functionEnv;
    this.functionDeclEnv = infered.functionDeclEnv;
  }

  /**
   * Refine weak polymorphic types based on usage patterns.
   * Uses fixed-point iteration until no more changes occur.
   * @param program The program to refine types for
   */
  public refine(program: Program): { typeEnv: TypeEnv; functionEnv: FunEnv } {
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
    return { typeEnv: this.typeEnv, functionEnv: this.functionEnv };
  }

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
            const type = resolve(param.typeAnnotation);
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
            if (constrainedType && constrainedType.kind !== 'weak' && constrainedType.kind !== 'dynamic') {
              param.typeAnnotation = typeToAnnotation(constrainedType, param.typeAnnotation.line, param.typeAnnotation.column);
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
              paramTypeMap.set(param.name, resolve(param.typeAnnotation));
            }
          }

          // Re-collect constraints to get updated return type
          const newConstraints = this.collectConstraints(stmt.body, paramTypeMap);
          if (newConstraints.returnType && newConstraints.returnType.kind !== 'weak') {
            stmt.returnType = typeToAnnotation(newConstraints.returnType, stmt.line, stmt.column);
            this.refinementChanged = true;

            // Update function environment
            this.functionEnv.set(stmt.name, {
              parameters: stmt.parameters.map((param) => resolve(param.typeAnnotation!)),
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
            // Only refine 'weak' types (polymorphic types), not 'dynamic' types
            // 'dynamic' represents statically unresolvable types and should not be refined
            if (funcInfo.returnType.kind === 'weak') {
              if (returnType.kind !== 'weak' && returnType.kind !== 'dynamic') {
                Object.assign(funcInfo.returnType, returnType);
                stmt.returnType = typeToAnnotation(returnType, stmt.line, stmt.column);
                this.refinementChanged = true;
              }
            }
            // Or refine nested weak types (but not if the return type is dynamic)
            else if (funcInfo.returnType.kind !== 'dynamic' && this.hasWeakTypes(funcInfo.returnType) && !this.hasWeakTypes(returnType)) {
              this.refineNestedTypes(funcInfo.returnType, returnType);
              stmt.returnType = typeToAnnotation(funcInfo.returnType, stmt.line, stmt.column);
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
            const type = resolve(declarator.typeAnnotation);
            this.typeEnv.set(declarator.name, type);
            this.variableDeclEnv.set(declarator.name, declarator);
          }
          // Also refine initializer
          this.refineExpression(declarator.initializer);

          // Update variable type from initializer
          const initializerType = this.analyzeExpressionType(declarator.initializer, this.typeEnv);
          const varType = this.typeEnv.get(declarator.name);

          if (varType && initializerType.kind !== 'weak' && initializerType.kind !== 'dynamic') {
            // Only refine 'weak' types (polymorphic types), not 'dynamic' types
            // 'dynamic' represents statically unresolvable types and should not be refined
            if (varType.kind === 'weak') {
              Object.assign(varType, initializerType);
              this.updateVariableAnnotation(declarator.name, varType);
              this.refinementChanged = true;
            }
            // Or refine nested weak types in complex types (dynamic types remain unchanged)
            else if (varType.kind !== 'dynamic' && this.hasWeakTypes(varType) && !this.hasWeakTypes(initializerType)) {
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
        // Default to dynamic - type cannot be statically determined
        let loopVarType: Type = { kind: 'dynamic' };

        if (iterableType.kind === 'weak') {
          // Weak polymorphic iterable - loop variable is also weak (can be refined)
          loopVarType = { kind: 'weak' };
        } else if (iterableType.kind === 'array' || iterableType.kind === 'set') {
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

        // Handle index assignment for type widening
        if (stmt.target.type === 'IndexExpression' && stmt.target.object.type === 'Identifier') {
          const varName = stmt.target.object.name;
          const varType = this.typeEnv.get(varName);
          const decl = this.variableDeclEnv.get(varName);
          const isInferred = decl && decl.typeAnnotation && decl.typeAnnotation.isInferred;

          if (varType && varType.kind === 'array' && isInferred) {
            // Widen array element type if it's an inferred array
            this.refineTypeFromExpression(varType.elementType, stmt.value);
            this.updateVariableAnnotation(varName, varType);
          }

          // Handle map index assignment: refine key and value types
          if (varType && varType.kind === 'map' && isInferred) {
            // Refine keyType from the index expression
            const indexType = this.analyzeExpressionType(stmt.target.index, this.typeEnv);
            if (varType.keyType.kind === 'weak' && indexType.kind !== 'weak' && indexType.kind !== 'dynamic') {
              Object.assign(varType.keyType, indexType);
              this.refinementChanged = true;
            }
            // Refine valueType from the assigned value
            this.refineTypeFromExpression(varType.valueType, stmt.value);
            this.updateVariableAnnotation(varName, varType);
          }
        }

        // Refine target from value
        const valueType = this.analyzeExpressionType(stmt.value, this.typeEnv);
        this.refineExpressionFromType(stmt.target, valueType);
        break;

      case 'InvariantStatement':
        this.refineExpression(stmt.condition);
        if (stmt.message) {
          this.refineExpression(stmt.message);
        }
        break;

      case 'AssertStatement':
        this.refineExpression(stmt.condition);
        if (stmt.message) {
          this.refineExpression(stmt.message);
        }
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

  private refineExpectedType(targetType: Type, sourceType: Type): void {
    // Only refine 'weak' types (polymorphic types), not 'dynamic' types
    // 'dynamic' represents statically unresolvable types and should not be refined
    if (targetType.kind === 'weak') {
      if (sourceType.kind !== 'weak' && sourceType.kind !== 'dynamic') {
        Object.assign(targetType, sourceType);
        this.refinementChanged = true;
      }
      return;
    }

    // Don't try to refine from weak/dynamic source types
    if (sourceType.kind === 'weak' || sourceType.kind === 'dynamic') {
      return;
    }

    // Don't refine dynamic target types
    if (targetType.kind === 'dynamic') {
      return;
    }

    if (targetType.kind === 'array' && sourceType.kind === 'array') {
      this.refineExpectedType(targetType.elementType, sourceType.elementType);
    } else if (targetType.kind === 'map' && sourceType.kind === 'map') {
      this.refineExpectedType(targetType.keyType, sourceType.keyType);
      this.refineExpectedType(targetType.valueType, sourceType.valueType);
    } else if (targetType.kind === 'set' && sourceType.kind === 'set') {
      this.refineExpectedType(targetType.elementType, sourceType.elementType);
    } else if (targetType.kind === 'heap' && sourceType.kind === 'heap') {
      this.refineExpectedType(targetType.elementType, sourceType.elementType);
    } else if (targetType.kind === 'heapmap' && sourceType.kind === 'heapmap') {
      this.refineExpectedType(targetType.keyType, sourceType.keyType);
      this.refineExpectedType(targetType.valueType, sourceType.valueType);
    } else if (targetType.kind === 'graph' && sourceType.kind === 'graph') {
      this.refineExpectedType(targetType.nodeType, sourceType.nodeType);
    } else if (targetType.kind === 'binarytree' && sourceType.kind === 'binarytree') {
      this.refineExpectedType(targetType.elementType, sourceType.elementType);
    }
  }

  private refineMethodCall(callee: MemberExpression, args: Expression[]): void {
    const objectType = this.analyzeExpressionType(callee.object, this.typeEnv);

    if (!objectType || objectType.kind === 'weak' || objectType.kind === 'dynamic') return;

    try {
      const methodType = synthMemberExpression(callee, objectType);

      if (methodType.kind === 'function') {
        for (let i = 0; i < Math.min(args.length, methodType.parameters.length); i++) {
          const paramType = methodType.parameters[i];
          const argExpr = args[i];
          const argType = this.analyzeExpressionType(argExpr, this.typeEnv);

          // Refine the object type components (paramType is a reference to them)
          this.refineExpectedType(paramType, argType);

          // Refine the argument expression based on the parameter type
          this.refineExpressionFromType(argExpr, paramType);
        }
      }
    } catch (e) {
      // Ignore errors during refinement
    }

    if (callee.object.type === 'Identifier') {
      this.updateVariableAnnotation(callee.object.name, objectType);
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

      // Only refine 'weak' types (polymorphic types that can be instantiated)
      // 'dynamic' types should NOT be refined - they represent statically unresolvable types
      if (paramType.kind === 'weak' && argType.kind !== 'weak' && argType.kind !== 'dynamic') {
        Object.assign(paramType, argType);
        paramsChanged = true;

        // Update the function declaration's parameter annotation
        if (i < funcDecl.parameters.length) {
          funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
            argType,
            funcDecl.parameters[i].typeAnnotation?.line || 0,
            funcDecl.parameters[i].typeAnnotation?.column || 0
          );
        }
      }
      // Refine array element types (only weak, not dynamic)
      else if (paramType.kind === 'array' && argType.kind === 'array') {
        if (paramType.elementType.kind === 'weak' &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'dynamic') {
          Object.assign(paramType.elementType, argType.elementType);
          paramsChanged = true;

          // Update the function declaration's parameter annotation
          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }
      // Refine map key/value types (only weak, not dynamic)
      else if (paramType.kind === 'map' && argType.kind === 'map') {
        let mapChanged = false;
        if (paramType.keyType.kind === 'weak' &&
          argType.keyType.kind !== 'weak' && argType.keyType.kind !== 'dynamic') {
          Object.assign(paramType.keyType, argType.keyType);
          mapChanged = true;
        }
        if (paramType.valueType.kind === 'weak' &&
          argType.valueType.kind !== 'weak' && argType.valueType.kind !== 'dynamic') {
          Object.assign(paramType.valueType, argType.valueType);
          mapChanged = true;
        }
        if (mapChanged) {
          paramsChanged = true;
          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }
      // Refine set element types (only weak, not dynamic)
      else if (paramType.kind === 'set' && argType.kind === 'set') {
        if (paramType.elementType.kind === 'weak' &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'dynamic') {
          Object.assign(paramType.elementType, argType.elementType);
          paramsChanged = true;

          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }
      // Refine heap element types (only weak, not dynamic)
      else if (paramType.kind === 'heap' && argType.kind === 'heap') {
        if (paramType.elementType.kind === 'weak' &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'dynamic') {
          Object.assign(paramType.elementType, argType.elementType);
          paramsChanged = true;

          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }
      // Refine heapmap key/value types (only weak, not dynamic)
      else if (paramType.kind === 'heapmap' && argType.kind === 'heapmap') {
        let heapmapChanged = false;
        if (paramType.keyType.kind === 'weak' &&
          argType.keyType.kind !== 'weak' && argType.keyType.kind !== 'dynamic') {
          Object.assign(paramType.keyType, argType.keyType);
          heapmapChanged = true;
        }
        if (paramType.valueType.kind === 'weak' &&
          argType.valueType.kind !== 'weak' && argType.valueType.kind !== 'dynamic') {
          Object.assign(paramType.valueType, argType.valueType);
          heapmapChanged = true;
        }
        if (heapmapChanged) {
          paramsChanged = true;
          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }
      // Refine binarytree element types (only weak, not dynamic)
      else if (paramType.kind === 'binarytree' && argType.kind === 'binarytree') {
        if (paramType.elementType.kind === 'weak' &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'dynamic') {
          Object.assign(paramType.elementType, argType.elementType);
          paramsChanged = true;

          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }

      // Refine graph node types (only weak, not dynamic)
      else if (paramType.kind === 'graph' && argType.kind === 'graph') {
        if (paramType.nodeType.kind === 'weak' &&
          argType.nodeType.kind !== 'weak' && argType.nodeType.kind !== 'dynamic') {
          Object.assign(paramType.nodeType, argType.nodeType);
          paramsChanged = true;

          if (i < funcDecl.parameters.length) {
            funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
              paramType,
              funcDecl.parameters[i].typeAnnotation?.line || 0,
              funcDecl.parameters[i].typeAnnotation?.column || 0
            );
          }
        }
      }
    }

    // If parameters changed, trigger another refinement pass and re-infer return type if needed
    if (paramsChanged) {
      this.refinementChanged = true;
      
      // Re-infer return type if it's still weak (not dynamic)
      // Only 'weak' types can be refined, 'dynamic' represents statically unresolvable types
      if (funcInfo.returnType.kind === 'weak') {
        // Build parameter type map with updated types
        const paramTypeMap = new Map<string, Type>();
        for (let i = 0; i < funcDecl.parameters.length; i++) {
          paramTypeMap.set(funcDecl.parameters[i].name, funcInfo.parameters[i]);
        }

        // Re-collect constraints to get updated return type
        const constraints = this.collectConstraints(funcDecl.body, paramTypeMap);
        if (constraints.returnType && constraints.returnType.kind !== 'weak' && constraints.returnType.kind !== 'dynamic') {
          Object.assign(funcInfo.returnType, constraints.returnType);
          funcDecl.returnType = typeToAnnotation(
            constraints.returnType,
            funcDecl.line,
            funcDecl.column
          );
        }
      }
    }
  }

  private hasWeakTypes(type: Type): boolean {
    if (type.kind === 'weak') {
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
    // Only refine 'weak' types, not 'dynamic' types
    if (targetType.kind === 'array' && sourceType.kind === 'array') {
      if (this.hasWeakTypes(targetType.elementType) && !this.hasWeakTypes(sourceType.elementType)) {
        if (targetType.elementType.kind === 'weak') {
          Object.assign(targetType.elementType, sourceType.elementType);
          this.refinementChanged = true;
        } else if (targetType.elementType.kind !== 'dynamic') {
          this.refineNestedTypes(targetType.elementType, sourceType.elementType);
        }
      }
    } else if (targetType.kind === 'map' && sourceType.kind === 'map') {
      if (this.hasWeakTypes(targetType.keyType) && !this.hasWeakTypes(sourceType.keyType)) {
        if (targetType.keyType.kind === 'weak') {
          Object.assign(targetType.keyType, sourceType.keyType);
          this.refinementChanged = true;
        } else if (targetType.keyType.kind !== 'dynamic') {
          this.refineNestedTypes(targetType.keyType, sourceType.keyType);
        }
      }
      if (this.hasWeakTypes(targetType.valueType) && !this.hasWeakTypes(sourceType.valueType)) {
        if (targetType.valueType.kind === 'weak') {
          Object.assign(targetType.valueType, sourceType.valueType);
          this.refinementChanged = true;
        } else if (targetType.valueType.kind !== 'dynamic') {
          this.refineNestedTypes(targetType.valueType, sourceType.valueType);
        }
      }
    } else if ((targetType.kind === 'set' || targetType.kind === 'heap') &&
      (sourceType.kind === 'set' || sourceType.kind === 'heap')) {
      if (this.hasWeakTypes(targetType.elementType) && !this.hasWeakTypes(sourceType.elementType)) {
        if (targetType.elementType.kind === 'weak') {
          Object.assign(targetType.elementType, sourceType.elementType);
          this.refinementChanged = true;
        } else if (targetType.elementType.kind !== 'dynamic') {
          this.refineNestedTypes(targetType.elementType, sourceType.elementType);
        }
      }
    } else if (targetType.kind === 'heapmap' && sourceType.kind === 'heapmap') {
      if (this.hasWeakTypes(targetType.keyType) && !this.hasWeakTypes(sourceType.keyType)) {
        if (targetType.keyType.kind === 'weak') {
          Object.assign(targetType.keyType, sourceType.keyType);
          this.refinementChanged = true;
        } else if (targetType.keyType.kind !== 'dynamic') {
          this.refineNestedTypes(targetType.keyType, sourceType.keyType);
        }
      }
      if (this.hasWeakTypes(targetType.valueType) && !this.hasWeakTypes(sourceType.valueType)) {
        if (targetType.valueType.kind === 'weak') {
          Object.assign(targetType.valueType, sourceType.valueType);
          this.refinementChanged = true;
        } else if (targetType.valueType.kind !== 'dynamic') {
          this.refineNestedTypes(targetType.valueType, sourceType.valueType);
        }
      }
    }
  }

  private refineTypeFromExpression(targetType: Type, expr: Expression): void {
    const exprType = this.analyzeExpressionType(expr, this.typeEnv);

    // Only refine 'weak' types (polymorphic types), not 'dynamic' types
    // 'dynamic' represents statically unresolvable types and should not be refined
    if (targetType.kind === 'weak') {
      if (exprType.kind !== 'weak' && exprType.kind !== 'dynamic') {
        Object.assign(targetType, exprType);
        this.refinementChanged = true;
      }
    }
  }

  private refineExpressionFromType(expr: Expression, type: Type): void {
    if (expr.type === 'Identifier') {
      const varName = expr.name;
      const varType = this.typeEnv.get(varName);
      // Only refine 'weak' types (polymorphic types), not 'dynamic' types
      // 'dynamic' represents statically unresolvable types and should not be refined
      if (varType && varType.kind === 'weak') {
        if (type.kind !== 'weak' && type.kind !== 'dynamic') {
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
      decl.typeAnnotation = typeToAnnotation(type, decl.typeAnnotation?.line || 0, decl.typeAnnotation?.column || 0);
      if (wasInferred) {
        decl.typeAnnotation.isInferred = true;
      }
    }
  }

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
            } else if (!typesEqual(returnType, stmtReturnType, this.typeEqualityCache)) {
              throw new Error('Multiple return types detected in function body.');
            }
          }
        }
        return returnType;

      case 'IfStatement':
        const thenType = this.analyzeReturnType(stmt.thenBranch);
        const elseType = stmt.elseBranch ? this.analyzeReturnType(stmt.elseBranch) : null;
        if (thenType && elseType) {
          if (typesEqual(thenType, elseType, this.typeEqualityCache)) {
            return thenType;
          }
          throw new Error('Conflicting return types in if-else branches.');
        }
        return thenType || elseType;

      case 'WhileStatement':
      case 'UntilStatement':
        return this.analyzeReturnType(stmt.body);

      case 'ForStatement': {
        // Save environment before adding loop variable
        const savedEnv = new Map(this.typeEnv);

        // Infer loop variable type from iterable
        const iterableType = this.analyzeExpressionType(stmt.iterable, this.typeEnv);
        let loopVarType: Type = { kind: 'dynamic' };

        if (iterableType.kind === 'weak') {
          loopVarType = { kind: 'weak' };
        } else if (iterableType.kind === 'array' || iterableType.kind === 'set') {
          loopVarType = iterableType.elementType;
        } else if (iterableType.kind === 'map' || iterableType.kind === 'heapmap') {
          loopVarType = iterableType.keyType;
        } else if (iterableType.kind === 'range') {
          loopVarType = { kind: 'int' };
        }

        // Add loop variable to environment
        this.typeEnv.set(stmt.variable, loopVarType);

        const result = this.analyzeReturnType(stmt.body);

        // Restore environment
        this.typeEnv = savedEnv;

        return result;
      }

      default:
        return null;
    }
  }

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
            } else if (!typesEqual(constraints.returnType, returnType, this.typeEqualityCache)) {
              throw Error("Conflicting return types detected in function body.");
            }
          }
          break;

        case 'VariableDeclaration':
          for (const declarator of s.declarations) {
            this.analyzeExpressionForConstraints(declarator.initializer, paramTypes, constraints.parameters);
            // Add declared variable to paramTypes so it can be found in subsequent expressions
            const initType = this.analyzeExpressionType(declarator.initializer, paramTypes);
            paramTypes.set(declarator.name, initType);
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
          // Add loop variable to paramTypes so it can be found in the body
          const iterableType = this.analyzeExpressionType(s.iterable, paramTypes);
          let loopVarType: Type = { kind: 'dynamic' };
          if (iterableType.kind === 'array' || iterableType.kind === 'set') {
            loopVarType = iterableType.elementType;
          } else if (iterableType.kind === 'map' || iterableType.kind === 'heapmap') {
            loopVarType = iterableType.keyType;
          } else if (iterableType.kind === 'range') {
            loopVarType = { kind: 'int' };
          }
          paramTypes.set(s.variable, loopVarType);
          collectFromStatement(s.body);
          break;

        case 'InvariantStatement':
          this.analyzeExpressionForConstraints(s.condition, paramTypes, constraints.parameters);
          if (s.message) {
            this.analyzeExpressionForConstraints(s.message, paramTypes, constraints.parameters);
          }
          break;

        case 'AssertStatement':
          this.analyzeExpressionForConstraints(s.condition, paramTypes, constraints.parameters);
          if (s.message) {
            this.analyzeExpressionForConstraints(s.message, paramTypes, constraints.parameters);
          }
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
   * Analyze the type of an expression using the provided type environment.
   * Delegates to the shared synthesizeExpressionType function.
   */
  private analyzeExpressionType(expr: Expression, paramTypes: Map<string, Type>): Type {
    const ctx: TypeSynthContext = {
      getVariableType: (name) => paramTypes.get(name) ?? this.typeEnv.get(name),
      getFunctionInfo: (name) => this.functionEnv.get(name),
      typeEqualityCache: this.typeEqualityCache,
    };
    return synthExpression(expr, ctx);
  }

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
          if (rightType.kind !== 'weak' && rightType.kind !== 'dynamic') {
            const currentConstraint = constraints.get(expr.left.name);
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'dynamic') {
              constraints.set(expr.left.name, rightType);
            }
          }
        }

        if (expr.right.type === 'Identifier' && paramTypes.has(expr.right.name)) {
          const leftType = this.analyzeExpressionType(expr.left, paramTypes);
          if (leftType.kind !== 'weak' && leftType.kind !== 'dynamic') {
            const currentConstraint = constraints.get(expr.right.name);
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'dynamic') {
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
            inferredType = { kind: 'binarytree', elementType: { kind: 'weak' } };
          }

          if (inferredType) {
            const currentConstraint = constraints.get(paramName);
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'dynamic') {
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
            if (!currentConstraint || currentConstraint.kind === 'weak' || currentConstraint.kind === 'dynamic') {
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
          if (paramType.kind === 'weak' || paramType.kind === 'dynamic') {
            // Constrain to be an array
            constraints.set(expr.object.name, { kind: 'array', elementType: { kind: 'weak' } });
          }
        }
        break;

      default:
        break;
    }
  }
}

export function refine(
  inferred: { typeEnv: TypeEnv; functionEnv: FunEnv; functionDeclEnv: Map<string, any>; },
  program: Program
): { typeEnv: TypeEnv; functionEnv: FunEnv } {
  const refiner = new TypeRefiner(
    {
      typeEnv: inferred.typeEnv,
      functionEnv: inferred.functionEnv,
      functionDeclEnv: inferred.functionDeclEnv
    });
  return refiner.refine(program);
}
