import { Program, Statement, Expression, MemberExpression } from '../transpiler/ast-types';
import { FunEnv, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToAnnotation } from './type-checker-utils';

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
            if (constrainedType && constrainedType.kind !== 'weak' && constrainedType.kind !== 'poly') {
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
            // Refine if completely weak/poly
            if (funcInfo.returnType.kind === 'weak' || funcInfo.returnType.kind === 'poly') {
              if (returnType.kind !== 'weak' && returnType.kind !== 'poly') {
                Object.assign(funcInfo.returnType, returnType);
                stmt.returnType = typeToAnnotation(returnType, stmt.line, stmt.column);
                this.refinementChanged = true;
              }
            }
            // Or refine nested weak types
            else if (this.hasWeakTypes(funcInfo.returnType) && !this.hasWeakTypes(returnType)) {
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
          this.refineTypeFromExpression(varType.keyType, args[0]);
          this.refineTypeFromExpression(varType.valueType, args[1]);

          this.refineExpressionFromType(args[0], varType.keyType);
          this.refineExpressionFromType(args[1], varType.valueType);
        }
        if (methodName === 'get' && args.length === 1) {
          this.refineTypeFromExpression(varType.keyType, args[0]);
          this.refineExpressionFromType(args[0], varType.keyType);
        }
      }
      else if (varType.kind === 'set') {
        if ((methodName === 'add' || methodName === 'has') && args.length === 1) {
          this.refineTypeFromExpression(varType.elementType, args[0]);
          this.refineExpressionFromType(args[0], varType.elementType);
        }
      }
      else if (varType.kind === 'heap') {
        if (methodName === 'push' && args.length === 1) {
          this.refineTypeFromExpression(varType.elementType, args[0]);
          this.refineExpressionFromType(args[0], varType.elementType);
        }
      }
      else if (varType.kind === 'heapmap') {
        if (methodName === 'push' && args.length === 2) {
          this.refineTypeFromExpression(varType.keyType, args[0]);
          this.refineTypeFromExpression(varType.valueType, args[1]);

          this.refineExpressionFromType(args[0], varType.keyType);
          this.refineExpressionFromType(args[1], varType.valueType);
        }
      }
      else if (varType.kind === 'array') {
        if (methodName === 'push' && args.length === 1) {
          this.refineTypeFromExpression(varType.elementType, args[0]);
          this.refineExpressionFromType(args[0], varType.elementType);
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
          funcDecl.parameters[i].typeAnnotation = typeToAnnotation(
            argType,
            funcDecl.parameters[i].typeAnnotation?.line || 0,
            funcDecl.parameters[i].typeAnnotation?.column || 0
          );
        }
      }
      // Refine array element types
      else if (paramType.kind === 'array' && argType.kind === 'array') {
        if ((paramType.elementType.kind === 'weak' || paramType.elementType.kind === 'poly') &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'poly') {
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
      // Refine map key/value types
      else if (paramType.kind === 'map' && argType.kind === 'map') {
        let mapChanged = false;
        if ((paramType.keyType.kind === 'weak' || paramType.keyType.kind === 'poly') &&
          argType.keyType.kind !== 'weak' && argType.keyType.kind !== 'poly') {
          Object.assign(paramType.keyType, argType.keyType);
          mapChanged = true;
        }
        if ((paramType.valueType.kind === 'weak' || paramType.valueType.kind === 'poly') &&
          argType.valueType.kind !== 'weak' && argType.valueType.kind !== 'poly') {
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
      // Refine set element types
      else if (paramType.kind === 'set' && argType.kind === 'set') {
        if ((paramType.elementType.kind === 'weak' || paramType.elementType.kind === 'poly') &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'poly') {
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
      // Refine heap element types
      else if (paramType.kind === 'heap' && argType.kind === 'heap') {
        if ((paramType.elementType.kind === 'weak' || paramType.elementType.kind === 'poly') &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'poly') {
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
      // Refine heapmap key/value types
      else if (paramType.kind === 'heapmap' && argType.kind === 'heapmap') {
        let heapmapChanged = false;
        if ((paramType.keyType.kind === 'weak' || paramType.keyType.kind === 'poly') &&
          argType.keyType.kind !== 'weak' && argType.keyType.kind !== 'poly') {
          Object.assign(paramType.keyType, argType.keyType);
          heapmapChanged = true;
        }
        if ((paramType.valueType.kind === 'weak' || paramType.valueType.kind === 'poly') &&
          argType.valueType.kind !== 'weak' && argType.valueType.kind !== 'poly') {
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
      // Refine binarytree element types
      else if (paramType.kind === 'binarytree' && argType.kind === 'binarytree') {
        if ((paramType.elementType.kind === 'weak' || paramType.elementType.kind === 'poly') &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'poly') {
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
      // Refine avltree element types
      else if (paramType.kind === 'avltree' && argType.kind === 'avltree') {
        if ((paramType.elementType.kind === 'weak' || paramType.elementType.kind === 'poly') &&
          argType.elementType.kind !== 'weak' && argType.elementType.kind !== 'poly') {
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
      // Refine graph node types
      else if (paramType.kind === 'graph' && argType.kind === 'graph') {
        if ((paramType.nodeType.kind === 'weak' || paramType.nodeType.kind === 'poly') &&
          argType.nodeType.kind !== 'weak' && argType.nodeType.kind !== 'poly') {
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
        funcDecl.returnType = typeToAnnotation(
          constraints.returnType,
          funcDecl.line,
          funcDecl.column
        );
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

  private refineTypeFromExpression(targetType: Type, expr: Expression): void {
    const exprType = this.analyzeExpressionType(expr, this.typeEnv);

    if (targetType.kind === 'weak' || targetType.kind === 'poly') {
      if (exprType.kind !== 'weak' && exprType.kind !== 'poly') {
        Object.assign(targetType, exprType);
        this.refinementChanged = true;
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
              // Multiple return types - create union
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
      case 'ForStatement':
        return this.analyzeReturnType(stmt.body);

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
        const allSame = elementTypes.every((t) => typesEqual(t, firstType, this.typeEqualityCache));
        if (allSame) {
          return { kind: 'array', elementType: firstType };
        }
        throw new Error('Array literal has elements of differing types.');

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
                    ['to', objectType.nodeType],
                    ['weight', { kind: 'int' }]
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
          throw new Error('Record has fields of differing types.');
        }
        return { kind: 'weak' };
      }

      case 'RangeExpression':
        return { kind: 'range' };

      default:
        return { kind: 'weak' };
    }
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
