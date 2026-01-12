import { Program, Statement, Expression } from '../transpiler/ast-types';
import { FunEnv, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToString } from './type-checker-utils';
import { synthExpression, TypeSynthContext } from './expression-synth-utils';

export class TypeChecker {
  // Environments

  // Maps variable names to their types
  private typeEnv: TypeEnv;

  // Maps function names to their parameter types and return type
  private functionEnv: FunEnv;

  // Current function being checked (for return type validation)
  private currentFunction: string | null = null;

  // Current loop depth (for invariant statement validation)
  private loopDepth: number = 0;

  // Maps variable names to their declarations (for updating annotations)
  private variableDeclEnv: Map<string, any> = new Map();

  // Optimization: Type equality cache to avoid redundant comparisons
  private typeEqualityCache: Map<string, boolean> = new Map();

  constructor(refined: { typeEnv: TypeEnv; functionEnv: FunEnv }) {
    this.typeEnv = refined.typeEnv;
    this.functionEnv = refined.functionEnv;
  }

  public check(program: Program): void {
    for (const statement of program.body) {
      this.checkStatement(statement);
    }
  }

  private checkStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration': {
        // Safe since we fully annotate program using infer beforehand
        // Use existing refined types from functionEnv if available, otherwise resolve from annotations
        const existingFuncInfo = this.functionEnv.get(stmt.name);
        const paramTypes: Type[] = existingFuncInfo
          ? existingFuncInfo.parameters
          : stmt.parameters.map((p) => resolve(p.typeAnnotation!));
        const returnType: Type = existingFuncInfo
          ? existingFuncInfo.returnType
          : resolve(stmt.returnType!);

        if (!existingFuncInfo) {
          this.functionEnv.set(stmt.name, {
            parameters: paramTypes,
            returnType,
          });
        }

        const savedEnv = new Map(this.typeEnv);
        const savedDeclEnv = new Map(this.variableDeclEnv);
        const savedFunction = this.currentFunction;
        this.currentFunction = stmt.name;

        for (let i = 0; i < stmt.parameters.length; i++) {
          this.typeEnv.set(stmt.parameters[i].name, paramTypes[i]);
          // Also add parameters to variableDeclEnv for consistency
          this.variableDeclEnv.set(stmt.parameters[i].name, stmt.parameters[i]);
        }

        this.checkStatement(stmt.body);

        this.typeEnv = savedEnv;
        this.variableDeclEnv = savedDeclEnv;
        this.currentFunction = savedFunction;
        break;
      }

      case 'VariableDeclaration': {
        for (const declarator of stmt.declarations) {
          const annotatedType = resolve(declarator.typeAnnotation!);
          const initializerType = this.synthExpression(declarator.initializer);
          if (!typesEqual(initializerType, annotatedType, this.typeEqualityCache)) {
            throw new Error(
              `Type mismatch: expected ${typeToString(annotatedType)}, got ${typeToString(initializerType)}. At ${declarator.line}, ${declarator.column}`
            );
          }
          // If the annotated type is weak (polymorphic) but the initializer has a concrete type, use the initializer type
          // Note: 'dynamic' types should remain dynamic - they represent statically unresolvable types
          const finalType = annotatedType.kind === 'weak' &&
            initializerType.kind !== 'weak' && initializerType.kind !== 'dynamic'
            ? initializerType
            : annotatedType;
          this.typeEnv.set(declarator.name, finalType);
          // Also add to variableDeclEnv so we can check type annotations in assignments
          this.variableDeclEnv.set(declarator.name, declarator);
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
        this.loopDepth++;
        this.checkStatement(stmt.body);
        this.loopDepth--;
        break;

      case 'UntilStatement':
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        this.loopDepth++;
        this.checkStatement(stmt.body);
        this.loopDepth--;
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
          iterated.kind !== 'dynamic'
        ) {
          throw new Error(
            `Type checking: Cannot iterate over non-iterable type ${iterated.kind}. At ${stmt.iterable.line}, ${stmt.iterable.column}`
          );
        }

        const savedEnv = new Map(this.typeEnv);

        // Skip binding if variable name is '_'
        if (stmt.variable !== '_') {
          if (iterated.kind === 'dynamic') {
            // Dynamic iterable - loop variable is dynamic (statically unresolvable)
            this.typeEnv.set(stmt.variable, { kind: 'dynamic' });
          } else if (iterated.kind === 'array' || iterated.kind === 'set') {
            this.typeEnv.set(stmt.variable, iterated.elementType);
          } else if (iterated.kind === 'map') {
            this.typeEnv.set(stmt.variable, iterated.keyType);
          } else if (iterated.kind === 'range') {
            this.typeEnv.set(stmt.variable, { kind: 'int' });
          }
        }

        this.loopDepth++;
        this.checkStatement(stmt.body);
        this.loopDepth--;
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
          if (!typesEqual(returnType, funcInfo.returnType, this.typeEqualityCache)) {
            throw new Error(
              `Return type mismatch: expected ${typeToString(funcInfo.returnType)}, got ${typeToString(returnType)}. At ${stmt.line}, ${stmt.column}`
            );
          }
        } else {
          // Return without a value - should be void
          if (!typesEqual({ kind: 'void' }, funcInfo.returnType, this.typeEqualityCache)) {
            throw new Error(
              `Return type mismatch: expected ${typeToString(funcInfo.returnType)}, got void. At ${stmt.line}, ${stmt.column}`
            );
          }
        }
        break;

      case 'BlockStatement':
        for (const s of stmt.statements) {
          this.checkStatement(s);
        }
        break;

      case 'AssignmentStatement': {
        const targetType = this.synthExpression(stmt.target);
        const valueType = this.synthExpression(stmt.value);

        // Check if this is an assignment to a variable or array element with explicit type annotation
        let shouldEnforceStrictType = false;

        if (stmt.target.type === 'Identifier') {
          // Simple variable assignment
          const varDecl = this.variableDeclEnv.get(stmt.target.name);
          shouldEnforceStrictType = varDecl && varDecl.typeAnnotation && !varDecl.typeAnnotation.isInferred;
        } else if (stmt.target.type === 'IndexExpression' && stmt.target.object.type === 'Identifier') {
          // Array/Map element assignment
          const varDecl = this.variableDeclEnv.get(stmt.target.object.name);
          shouldEnforceStrictType = varDecl && varDecl.typeAnnotation && !varDecl.typeAnnotation.isInferred;

          // Also enforce strict type checking if the collection's element/value type
          // has already been refined to a concrete type (even if inferred)
          if (!shouldEnforceStrictType && targetType.kind !== 'weak' && targetType.kind !== 'dynamic') {
            shouldEnforceStrictType = true;
          }
        }

        if (shouldEnforceStrictType && !typesEqual(valueType, targetType, this.typeEqualityCache)) {
          throw new Error(
            `Type mismatch: cannot assign ${typeToString(valueType)} to ${typeToString(targetType)}. At ${stmt.line}, ${stmt.column}`
          );
        }
        break;
      }

      case 'ExpressionStatement':
        this.synthExpression(stmt.expression);
        break;

      case 'InvariantStatement':
        // Check that invariant is inside a loop or function (not at top level)
        if (this.loopDepth === 0 && !this.currentFunction) {
          throw new Error(
            `Type checking: @invariant statement must be inside a loop or function. At ${stmt.line}, ${stmt.column}`
          );
        }
        // Check that condition is boolean
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        // Check that message (if present) is a string
        if (stmt.message) {
          this.checkExpression(stmt.message, { kind: 'string' });
        }
        break;

      case 'AssertStatement':
        // Check that condition is boolean
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        // Check that message (if present) is a string
        if (stmt.message) {
          this.checkExpression(stmt.message, { kind: 'string' });
        }
        break;
    }
  }

  private isWeak(type: Type): boolean {
    if (type.kind === 'weak') return true;
    return false;
  }

  private getNumericKind(type: Type): 'int' | 'float' | null {
    if (type.kind === 'int') return 'int';
    if (type.kind === 'float') return 'float';
    return null;
  }

  private checkExpression(expr: Expression, expectedType: Type): void {
    const actualType = this.synthExpression(expr);
    if (!typesEqual(actualType, expectedType, this.typeEqualityCache)) {
      throw new Error(
        `Type mismatch: expected ${typeToString(expectedType)}, got ${typeToString(actualType)}. At ${expr.line}, ${expr.column}`
      );
    }
  }
  private synthExpression(expr: Expression): Type {
    const ctx: TypeSynthContext = {
      getVariableType: (name: string): Type | undefined => {
        return this.typeEnv.get(name);
      },
      getFunctionInfo: (name: string): { parameters: Type[]; returnType: Type; variadic?: boolean } | undefined => {
        return this.functionEnv.get(name);
      },
      typeEqualityCache: this.typeEqualityCache,
    };
    return synthExpression(expr, ctx);
  }
}

export function check(refined: { typeEnv: TypeEnv; functionEnv: FunEnv }, program: Program): void {
  const typeChecker = new TypeChecker(refined);
  typeChecker.check(program);
}

export function checkAndReturn(refined: { typeEnv: TypeEnv; functionEnv: FunEnv }, program: Program): TypeChecker {
  const typeChecker = new TypeChecker(refined);
  typeChecker.check(program);
  return typeChecker;
}
