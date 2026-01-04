import { Program, Statement, Expression } from '../transpiler/ast-types';
import { FunEnv, TypeEnv } from './type-checker-main';
import { resolve, Type, typesEqual, typeToString } from './type-checker-utils';

export class TypeChecker {
  // Environments

  // Maps variable names to their types
  private typeEnv: TypeEnv = new Map();

  // Maps function names to their parameter types and return type
  private functionEnv: FunEnv = new Map();

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
          // If the annotated type is weak but the initializer has a concrete type, use the initializer type
          const finalType = (annotatedType.kind === 'weak' || annotatedType.kind === 'poly') &&
            initializerType.kind !== 'weak' && initializerType.kind !== 'poly'
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
    if (!typesEqual(actualType, expectedType, this.typeEqualityCache)) {
      throw new Error(
        `Type mismatch: expected ${typeToString(expectedType)}, got ${typeToString(actualType)}. At ${expr.line}, ${expr.column}`
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

      case 'PredicateCheckExpression': {
        // Evaluate subject expression to ensure it's well-typed
        this.synthExpression(expr.subject);

        // Evaluate predicate arguments if any
        if (expr.predicateArgs) {
          for (const arg of expr.predicateArgs) {
            this.synthExpression(arg);
          }
        }

        // Turnstile operator always returns boolean
        return { kind: 'boolean' };
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
        const allSame = elementTypes.every(
          (t) => typesEqual(t, firstType, this.typeEqualityCache) &&
            typesEqual(firstType, t, this.typeEqualityCache));

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

      case 'MetaIdentifier':
        return { kind: 'string' };

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
          if (typesEqual(leftType, rightType, this.typeEqualityCache) ||
            typesEqual(rightType, leftType, this.typeEqualityCache)) {
            return { kind: 'boolean' };
          }
          // Allow comparison between numeric types (int and float)
          if (leftNumeric && rightNumeric) {
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

        // If operands are unions and we haven't matched a specific rule, allow it as weak (runtime check)
        if (leftType.kind === 'union' || rightType.kind === 'union') {
          return { kind: 'weak' };
        }

        throw new Error(
          `Type checking: invalid binary operation, ${typeToString(leftType)} ${expr.operator} ${typeToString(rightType)}, at ${expr.line}, ${expr.column}`
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
          `Type checking: invalid unary operation, ${expr.operator} ${typeToString(operandType)}`
        );
      }

      case 'CallExpression': {
        const callee = expr.callee;
        let funcType: Type;

        // Special case: MetaIdentifier callee means this is a predicate call like @greater_than(5)
        // These are used as arguments to other predicates
        if (callee.type === 'MetaIdentifier') {
          // Type-check all arguments to ensure they're valid expressions
          for (const arg of expr.arguments) {
            this.synthExpression(arg);
          }
          // Predicate calls have the predicate type
          return { kind: 'predicate' };
        }

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
          throw new Error(`Type checking: cannot call non-function type: ${typeToString(funcType)}, at ${expr.line}, ${expr.column}`);
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
          `Type checking: property ${expr.property.name} does not exist on type ${typeToString(objectType)}, at ${expr.line}, ${expr.column}`
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
              `Type checking: cannot index tuple with non-integer type ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
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
          if (typesEqual(indexType, indexKeyType ? indexKeyType! : { kind: 'poly' }, this.typeEqualityCache)) {
            // Return a union of all possible value types since we don't track actual field names
            if (objectType.fieldTypes.length === 1) {
              return objectType.fieldTypes[0][1];
            }
            // Create a union of all value types
            const valueTypes = objectType.fieldTypes.map(([_, valueType]) => valueType);
            // Deduplicate if all types are the same
            const allSame = valueTypes.every(t => typesEqual(t, valueTypes[0], this.typeEqualityCache));
            if (allSame) {
              return valueTypes[0];
            }
            return {
              kind: 'union',
              types: valueTypes
            };
          }
          throw new Error(
            `Type checking: cannot index record with key type ${typeToString(indexKeyType!)} using index type ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
          );
        }

        if (objectType.kind === 'weak') {
          return { kind: 'weak' };
        }

        throw new Error(
          `Type checking: cannot index type ${typeToString(objectType)} with ${typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
        );
      }

      default:
        throw new Error(`Type checking: unknown expression type ${(expr as any).type}, at ${expr.line}, ${expr.column}`);
    }
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
