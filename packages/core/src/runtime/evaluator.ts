/**
 * Expression and Statement Evaluator for SchemA
 *
 * This class provides synchronous evaluation methods for expressions and statements.
 * It is used by both the Interpreter (for normal execution) and the Machine
 * (for invariant checking during stepping).
 */

import {
  Expression,
  Statement,
} from '../transpiler/ast-types';
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
} from '../builtins/data-structures';
import { Environment } from './environment';
import {
  extractInvariants,
  generateStringRange,
  getActualRuntimeType,
  hasDynamicTypes,
  isTruthy,
  keyToRuntimeTypedBinder,
  resolveTypeAnnotation,
  runtimeTypedBinderToKey,
  runtimeTypedBinderToString,
  RuntimeTypedBinder,
  valuesEqual,
  sole,
  Sole
} from './runtime-utils';
import { InvariantStatement } from '../transpiler/ast-types';
import { Type, typeToString } from '../type-checker/type-checker-utils';
import { parsePredicateName } from '../analyzer/analyzer-utils';
import { InvariantTracker } from '../analyzer/synthesizer';

/**
 * Exception thrown when a return statement is executed
 */
export class ReturnException {
  constructor(public value: RuntimeTypedBinder) { }
}

/**
 * Interface for providing the current environment and tracker stack
 */
export interface EvaluatorContext {
  getCurrentEnv(): Environment;
  setCurrentEnv(env: Environment): void;
  getTrackerStack(): InvariantTracker[];
}

/**
 * Synchronous evaluator for expressions and statements
 * Used for both normal interpretation and invariant checking
 */
export class Evaluator {
  private context: EvaluatorContext;

  constructor(context: EvaluatorContext) {
    this.context = context;
  }

  private get currentEnv(): Environment {
    return this.context.getCurrentEnv();
  }

  private set currentEnv(env: Environment) {
    this.context.setCurrentEnv(env);
  }

  private get trackerStack(): InvariantTracker[] {
    return this.context.getTrackerStack();
  }

  // ============================================================================
  // Expression Evaluation
  // ============================================================================

  public evaluateExpression(expr: Expression): RuntimeTypedBinder {
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
        const elementType = elements.length > 0 ? elements[0].type.static : { kind: 'weak' as const };
        return {
          value: new SchemaArray(elements),
          type: { static: { kind: 'array', elementType }, refinements: [] }
        };
      }

      case 'Identifier': {
        if (expr.name === '_') {
          throw new Error('Underscore (_) cannot be used as a value');
        }
        const value = this.currentEnv.get(expr.name);
        if (value === undefined) {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        return value;
      }

      case 'MetaIdentifier':
        return { value: expr.name, type: { static: { kind: 'string' }, refinements: [] } };

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
        return this.evaluateMember(object, propertyName, expr);
      }

      case 'IndexExpression': {
        const object = this.evaluateExpression(expr.object);
        const index = this.evaluateExpression(expr.index);
        return this.evaluateIndex(object, index);
      }

      case 'RangeExpression': {
        const inclusive = expr.inclusive;

        // Handle string range expressions like "aa".."bb", "a".."z"
        if (expr.start && expr.end) {
          const startVal = this.evaluateExpression(expr.start);
          const endVal = this.evaluateExpression(expr.end);
          if (startVal.type.static.kind === 'string' && endVal.type.static.kind === 'string') {
            return generateStringRange(
              startVal.value as string,
              endVal.value as string,
              inclusive
            );
          }
        }

        // Handle integer range expressions like 1..3, 1...3, ..3, 0..
        let start: number;
        let end: number | undefined;

        if (expr.start) {
          const startVal = this.evaluateExpression(expr.start);
          if (startVal.type.static.kind === 'int') {
            start = startVal.value as number;
          } else {
            throw new Error('Range start must be an integer or string');
          }
        } else {
          start = 0;
        }

        if (expr.end) {
          const endVal = this.evaluateExpression(expr.end);
          if (endVal.type.static.kind === 'int') {
            end = endVal.value as number;
          } else {
            throw new Error('Range end must be an integer');
          }
        } else {
          end = undefined;
        }

        const range = new LazyRange(start, end, inclusive);

        if (!range.isInfinite) {
          const elements = range.toArray().map(val => ({ type: { static: { kind: 'int' as const }, refinements: [] }, value: val }));
          return { type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }, value: new SchemaArray(elements) };
        } else {
          return { type: { static: { kind: 'range' }, refinements: [] }, value: range };
        }
      }

      case 'PredicateCheckExpression': {
        const subject = this.evaluateExpression(expr.subject);

        const tracker = this.trackerStack.length > 0
          ? this.trackerStack[this.trackerStack.length - 1]
          : new InvariantTracker();

        let predicateArgs: RuntimeTypedBinder[] | undefined;
        if (expr.predicateArgs && expr.predicateArgs.length > 0) {
          predicateArgs = expr.predicateArgs.map(arg => this.evaluateExpression(arg));
        }

        const predicate = parsePredicateName(expr.predicateName, predicateArgs);

        let variableName: string | undefined;
        if (expr.subject.type === 'Identifier') {
          variableName = (expr.subject as any).name;
        }

        const result = tracker.check(predicate, subject, variableName);
        return { type: { static: { kind: 'boolean' }, refinements: [] }, value: result };
      }

      case 'TypeOfExpression': {
        const operand = this.evaluateExpression(expr.operand);
        return { type: { static: { kind: 'string' }, refinements: [] }, value: typeToString(operand.type.static) };
      }

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  // ============================================================================
  // Statement Evaluation (for sync evaluation in invariants)
  // ============================================================================

  public evaluateStatement(stmt: Statement): RuntimeTypedBinder {
    switch (stmt.type) {
      case 'ExpressionStatement':
        return this.evaluateExpression(stmt.expression);

      case 'ReturnStatement':
        if (stmt.value) {
          throw new ReturnException(this.evaluateExpression(stmt.value));
        } else {
          throw new ReturnException({ value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } });
        }

      case 'VariableDeclaration':
        for (const declarator of stmt.declarations) {
          let value: RuntimeTypedBinder;
          if (declarator.initializer) {
            value = this.evaluateExpression(declarator.initializer);
            if (declarator.typeAnnotation) {
              const declaredType = resolveTypeAnnotation(declarator.typeAnnotation);
              if (!hasDynamicTypes(declaredType)) {
                value.type.static = declaredType;
              }
            }
          } else {
            const declaredType = resolveTypeAnnotation(declarator.typeAnnotation);
            value = { value: new Sole(), type: { static: declaredType, refinements: [] } };
          }
          if (declarator.name !== '_') {
            this.currentEnv.define(declarator.name, value);
          }
        }
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };

      case 'AssignmentStatement': {
        const value = this.evaluateExpression(stmt.value);
        if (stmt.target.type === 'Identifier') {
          if (stmt.target.name === '_') {
            throw new Error('Cannot assign to underscore (_)');
          }
          this.currentEnv.set(stmt.target.name, value);
        } else if (stmt.target.type === 'MemberExpression') {
          const object = this.evaluateExpression(stmt.target.object);
          const propertyName = stmt.target.property.name;
          if (object.type.static.kind === 'map') {
            (object.value as SchemaMap<any, RuntimeTypedBinder>).set(propertyName, value);
          } else {
            throw new Error(`Cannot assign to property ${propertyName}`);
          }
        } else if (stmt.target.type === 'IndexExpression') {
          const object = this.evaluateExpression(stmt.target.object);
          const index = this.evaluateExpression(stmt.target.index);
          const indexActualType = getActualRuntimeType(index);

          if ((object.type.static.kind === 'array' || object.value instanceof SchemaArray) &&
            (index.type.static.kind === 'int' || indexActualType === 'int')) {
            (object.value as SchemaArray<RuntimeTypedBinder>).set(index.value as number, value);
          } else if (object.type.static.kind === 'map' || object.value instanceof SchemaMap) {
            const key = runtimeTypedBinderToKey(index);
            (object.value as SchemaMap<any, RuntimeTypedBinder>).set(key, value);
          } else {
            throw new Error('Invalid assignment target');
          }
        } else {
          throw new Error('Invalid assignment target');
        }
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'IfStatement': {
        const condition = this.evaluateExpression(stmt.condition);
        if (condition.value) {
          return this.evaluateStatement(stmt.thenBranch);
        } else if (stmt.elseBranch) {
          return this.evaluateStatement(stmt.elseBranch);
        }
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'BlockStatement': {
        const savedEnv = this.currentEnv;
        this.currentEnv = new Environment(savedEnv);
        let result: RuntimeTypedBinder = { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
        for (const s of stmt.statements) {
          result = this.evaluateStatement(s);
        }
        this.currentEnv = savedEnv;
        return result;
      }

      case 'WhileStatement': {
        const invariants = extractInvariants(stmt.body);
        let iteration = 0;
        while (true) {
          const condition = this.evaluateExpression(stmt.condition);
          if (condition.type.static.kind !== 'boolean') {
            throw new Error('While condition must be boolean');
          }
          if (!(condition.value as boolean)) break;

          // Check invariants before iteration
          this.checkInvariants(invariants);

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              this.checkInvariants(invariants);
            }
            throw e;
          }

          // Check invariants after iteration
          this.checkInvariants(invariants);
          iteration++;
        }
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'UntilStatement': {
        const invariants = extractInvariants(stmt.body);
        let iteration = 0;
        while (true) {
          const condition = this.evaluateExpression(stmt.condition);
          if (condition.type.static.kind !== 'boolean') {
            throw new Error('Until condition must be boolean');
          }
          if (condition.value as boolean) break;

          // Check invariants before iteration
          this.checkInvariants(invariants);

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              this.checkInvariants(invariants);
            }
            throw e;
          }

          // Check invariants after iteration
          this.checkInvariants(invariants);
          iteration++;
        }
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'ForStatement': {
        const iterable = this.evaluateExpression(stmt.iterable);
        const savedEnv = this.currentEnv;
        this.currentEnv = new Environment(savedEnv);
        const invariants = extractInvariants(stmt.body);
        let iteration = 0;

        const iterator = this.getIterator(iterable);
        for (const item of iterator) {
          if (stmt.variable !== '_') {
            this.currentEnv.define(stmt.variable, item);
          }

          // Check invariants before iteration
          this.checkInvariants(invariants);

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              this.checkInvariants(invariants);
            }
            this.currentEnv = savedEnv;
            throw e;
          }

          // Check invariants after iteration
          this.checkInvariants(invariants);
          iteration++;
        }

        this.currentEnv = savedEnv;
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'FunctionDeclaration': {
        const paramTypes = stmt.parameters.map((p: any) => resolveTypeAnnotation(p.typeAnnotation));
        const returnType = resolveTypeAnnotation(stmt.returnType);

        const funcValue: RuntimeTypedBinder = {
          value: {
            parameters: stmt.parameters,
            body: stmt.body,
            closure: this.currentEnv,
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
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'InvariantStatement': {
        this.checkSingleInvariant(stmt);
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      case 'AssertStatement': {
        // Evaluate and check the assertion condition
        const condition = this.evaluateExpression(stmt.condition);
        if (typeof condition.value !== 'boolean') {
          throw new Error(`@assert condition must evaluate to a boolean at ${stmt.line}:${stmt.column}`);
        }
        if (!condition.value) {
          let message = 'Assertion failed';
          if (stmt.message && stmt.message.type === 'StringLiteral') {
            message = stmt.message.value;
          }
          // Include current state in error message
          const state = this.captureEnvironmentState();
          throw new Error(`${message}\nCurrent state:\n${state}`);
        }
        return { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };
      }

      default:
        throw new Error(`Unsupported statement type in synchronous evaluation: ${(stmt as any).type}`);
    }
  }

  // ============================================================================
  // Binary Expression Evaluation
  // ============================================================================

  private evaluateBinaryExpression(expr: any): RuntimeTypedBinder {
    // Short-circuit evaluation for logical operators
    if (expr.operator === '&&' || expr.operator === '||') {
      const left = this.evaluateExpression(expr.left);
      if (expr.operator === '&&') {
        if (!isTruthy(left)) {
          return { type: { static: { kind: 'boolean' }, refinements: [] }, value: false };
        }
      } else {
        if (isTruthy(left)) {
          return { type: { static: { kind: 'boolean' }, refinements: [] }, value: true };
        }
      }
      const right = this.evaluateExpression(expr.right);
      return { type: { static: { kind: 'boolean' }, refinements: [] }, value: isTruthy(right) };
    }

    const left = this.evaluateExpression(expr.left);
    const right = this.evaluateExpression(expr.right);
    return this.applyBinaryOp(expr.operator, left, right, expr.line, expr.column);
  }

  public applyBinaryOp(op: string, left: RuntimeTypedBinder, right: RuntimeTypedBinder, line: number, column: number): RuntimeTypedBinder {
    const leftType = getActualRuntimeType(left);
    const rightType = getActualRuntimeType(right);

    switch (op) {
      case '+':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) + (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
        }
        if (leftType === 'float' && rightType === 'float') {
          return { value: (left.value as number) + (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        if ((leftType === 'int' || leftType === 'float') && (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) + (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        if (leftType === 'string' && rightType === 'string') {
          return { value: (left.value as string) + (right.value as string), type: { static: { kind: 'string' }, refinements: [] } };
        }
        throw new Error(`Cannot add ${leftType} and ${rightType}`);

      case '-':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) - (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
        }
        if (leftType === 'float' && rightType === 'float') {
          return { value: (left.value as number) - (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        if ((leftType === 'int' || leftType === 'float') && (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) - (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        throw new Error(`Cannot subtract ${rightType} from ${leftType}`);

      case '*':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) * (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
        }
        if (leftType === 'float' && rightType === 'float') {
          return { value: (left.value as number) * (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        if ((leftType === 'int' || leftType === 'float') && (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) * (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        throw new Error(`Cannot multiply ${leftType} and ${rightType}`);

      case '/':
        if (leftType === 'int' && rightType === 'int') {
          return { value: Math.floor((left.value as number) / (right.value as number)), type: { static: { kind: 'int' }, refinements: [] } };
        }
        throw new Error('Integer division requires both operands to be int');

      case '/.':
        if ((leftType === 'int' || leftType === 'float') && (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) / (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        throw new Error('Float division requires numeric operands');

      case '%':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) % (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
        }
        if ((leftType === 'int' || leftType === 'float') && (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) % (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        throw new Error('Modulo requires numeric operands');

      case '<<':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) << (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
        }
        throw new Error('Left shift requires both operands to be int');

      case '>>':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) >> (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
        }
        throw new Error('Right shift requires both operands to be int');

      case '<':
        if ((leftType === 'int' || leftType === 'float') &&
          (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) < (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} < ${rightType}. At line ${line}, column ${column}`);

      case '<=':
        if ((leftType === 'int' || leftType === 'float') &&
          (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) <= (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} <= ${rightType}. At line ${line}, column ${column}`);

      case '>':
        if ((leftType === 'int' || leftType === 'float') &&
          (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) > (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} > ${rightType}. At line ${line}, column ${column}`);

      case '>=':
        if ((leftType === 'int' || leftType === 'float') &&
          (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) >= (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} >= ${rightType}. At line ${line}, column ${column}`);

      case '==':
        return { value: valuesEqual(left, right), type: { static: { kind: 'boolean' }, refinements: [] } };

      case '!=':
        return { value: !valuesEqual(left, right), type: { static: { kind: 'boolean' }, refinements: [] } };

      case '&&':
        return { value: isTruthy(left) && isTruthy(right), type: { static: { kind: 'boolean' }, refinements: [] } };

      case '||':
        return { value: isTruthy(left) || isTruthy(right), type: { static: { kind: 'boolean' }, refinements: [] } };

      default:
        throw new Error(`Unknown binary operator: ${op}`);
    }
  }

  // ============================================================================
  // Call Expression Evaluation
  // ============================================================================

  private evaluateCallExpression(expr: any): RuntimeTypedBinder {
    // Special case: MetaIdentifier callee means this is a predicate call
    if (expr.callee.type === 'MetaIdentifier') {
      const predicateName = expr.callee.name;
      const predicateArgs = expr.arguments.map((arg: Expression) => this.evaluateExpression(arg));
      return {
        value: { predicateName, predicateArgs },
        type: { static: { kind: 'predicate' }, refinements: [] }
      };
    }

    const callee = this.evaluateExpression(expr.callee);
    const args = expr.arguments.map((arg: Expression) => this.evaluateExpression(arg));
    return this.applyFunction(callee, args);
  }

  public applyFunction(callee: RuntimeTypedBinder, args: RuntimeTypedBinder[]): RuntimeTypedBinder {
    if (callee.type.static.kind !== 'function') {
      throw new Error('Not a function');
    }

    const calleeValue = callee.value as any;

    // Native function
    if ('fn' in calleeValue) {
      return calleeValue.fn(...args);
    }

    // User-defined function
    if ('parameters' in calleeValue && 'body' in calleeValue && 'closure' in calleeValue) {
      const savedEnv = this.currentEnv;
      const closureEnv = new Environment(calleeValue.closure as Environment);
      this.currentEnv = closureEnv;

      for (let i = 0; i < calleeValue.parameters.length; i++) {
        this.currentEnv.define(calleeValue.parameters[i].name, args[i]);
      }

      let result: RuntimeTypedBinder = { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } };

      try {
        for (const stmt of calleeValue.body.statements) {
          result = this.evaluateStatement(stmt);
        }
      } catch (e) {
        if (e instanceof ReturnException) {
          result = e.value;
        } else {
          this.currentEnv = savedEnv;
          throw e;
        }
      }

      this.currentEnv = savedEnv;
      return result;
    }

    throw new Error('Not a function');
  }

  // ============================================================================
  // Member Expression Evaluation
  // ============================================================================

  public evaluateMember(object: RuntimeTypedBinder, propertyName: string, expr?: any): RuntimeTypedBinder {
    if (object.type.static.kind === 'array') {
      if (propertyName === 'length') {
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof SchemaArray)) {
                throw new Error('Array value is undefined or invalid');
              }
              return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.length };
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
              return { value: undefined, type: { static: { kind: 'void' }, refinements: [] } };
            }
          }
        };
      }
      if (propertyName === 'pop') {
        return {
          type: { static: { kind: 'function', parameters: [], returnType: object.type.static.elementType }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof SchemaArray)) {
                throw new Error('Internal: Array value is undefined or invalid');
              }
              const poped = object.value.pop();
              if (!poped) {
                const line = expr?.object?.line || 0;
                const column = expr?.object?.column || 0;
                throw new Error(`Error: cannot pop from an empty array at ${line}:${column}`);
              }
              return poped;
            }
          }
        };
      }
    }

    if (object.type.static.kind === 'map') {
      return this.evaluateMapMember(object, propertyName);
    }

    if (object.type.static.kind === 'set') {
      return this.evaluateSetMember(object, propertyName);
    }

    if (object.type.static.kind === 'heap') {
      return this.evaluateHeapMember(object, propertyName);
    }

    if (object.type.static.kind === 'heapmap') {
      return this.evaluateHeapMapMember(object, propertyName);
    }

    if (object.type.static.kind === 'graph') {
      return this.evaluateGraphMember(object, propertyName);
    }

    if (object.type.static.kind === 'binarytree') {
      return this.evaluateBinaryTreeMember(object, propertyName);
    }

    throw new Error(`Property ${propertyName} does not exist`);
  }

  private evaluateMapMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const mapType = object.type.static as { kind: 'map'; keyType: Type; valueType: Type };
    const map = object.value as SchemaMap<any, RuntimeTypedBinder>;

    switch (propertyName) {
      case 'size':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              return { type: { static: { kind: 'int' }, refinements: [] }, value: object.value.size };
            }
          }
        };
      case 'get':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: mapType.valueType }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(key);
              return object.value.get(k) || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'set':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType, mapType.valueType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder, value: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(key);
              object.value.set(k, value);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'has':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: { kind: 'boolean' } }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(key);
              return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.has(k) };
            }
          }
        };
      case 'deleteWithKey':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(key);
              object.value.delete(k);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'keys':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: mapType.keyType } }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              const arr = new SchemaArray<RuntimeTypedBinder>();
              object.value.forEach((_, key) => {
                arr.push(keyToRuntimeTypedBinder(key));
              });
              return { type: { static: { kind: 'array', elementType: mapType.keyType }, refinements: [] }, value: arr };
            }
          }
        };
      case 'values':
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
      case 'entries':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] } } }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof SchemaMap)) {
                throw new Error('Internal: Map value is undefined or invalid');
              }
              const arr = new SchemaArray<RuntimeTypedBinder>();
              object.value.forEach((value, key) => {
                const tuple: RuntimeTypedBinder = {
                  type: { static: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] }, refinements: [] },
                  value: [keyToRuntimeTypedBinder(key), value]
                };
                arr.push(tuple);
              });
              return { type: { static: { kind: 'array', elementType: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] } }, refinements: [] }, value: arr };
            }
          }
        };
      default:
        throw new Error(`Property ${propertyName} does not exist on Map`);
    }
  }

  private evaluateSetMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const setType = object.type.static as { kind: 'set'; elementType: Type };
    const set = object.value as SchemaSet<any>;

    switch (propertyName) {
      case 'size':
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
      case 'add':
        return {
          type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaSet)) {
                throw new Error('Internal: Set value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(item);
              object.value.add(k);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'has':
        return {
          type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'boolean' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaSet)) {
                throw new Error('Internal: Set value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(item);
              return { type: { static: { kind: 'boolean' }, refinements: [] }, value: object.value.has(k) };
            }
          }
        };
      case 'delete':
        return {
          type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof SchemaSet)) {
                throw new Error('Internal: Set value is undefined or invalid');
              }
              const k = runtimeTypedBinderToKey(item);
              object.value.delete(k);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'values':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: setType.elementType } }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof SchemaSet)) {
                throw new Error('Internal: Set value is undefined or invalid');
              }
              const arr = new SchemaArray<RuntimeTypedBinder>();
              object.value.forEach((item) => {
                arr.push(keyToRuntimeTypedBinder(item));
              });
              return { type: { static: { kind: 'array', elementType: setType.elementType }, refinements: [] }, value: arr };
            }
          }
        };
      default:
        throw new Error(`Property ${propertyName} does not exist on Set`);
    }
  }

  private evaluateHeapMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const heapType = object.type.static as { kind: 'heap'; elementType: Type };
    const heap = object.value as MinHeap<RuntimeTypedBinder> | MaxHeap<RuntimeTypedBinder>;

    switch (propertyName) {
      case 'size':
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
      case 'push':
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
      case 'pop':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapType.elementType }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof MinHeap || object.value instanceof MaxHeap)) {
                throw new Error('Internal: Heap value is undefined or invalid');
              }
              const val = object.value.pop();
              if (!val) {
                throw new Error('Error: cannot pop from an empty heap');
              }
              return val;
            }
          }
        };
      case 'peek':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapType.elementType }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof MinHeap || object.value instanceof MaxHeap)) {
                throw new Error('Internal: Heap value is undefined or invalid');
              }
              const val = object.value.peek();
              if (!val) {
                throw new Error('Error: cannot peek from an empty heap');
              }
              return val;
            }
          }
        };
      default:
        throw new Error(`Property ${propertyName} does not exist on Heap`);
    }
  }

  private evaluateHeapMapMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const heapmapType = object.type.static as { kind: 'heapmap'; keyType: Type; valueType: Type };
    const heapmap = object.value as MinHeapMap<RuntimeTypedBinder, RuntimeTypedBinder> | MaxHeapMap<RuntimeTypedBinder, RuntimeTypedBinder>;

    switch (propertyName) {
      case 'size':
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
      case 'push':
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
      case 'pop':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapmapType.keyType }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof MinHeapMap || object.value instanceof MaxHeapMap)) {
                throw new Error('Internal: HeapMap value is undefined or invalid');
              }
              const val = object.value.pop();
              if (!val) {
                throw new Error('Error: cannot pop from an empty heapmap');
              }
              return val;
            }
          }
        };
      case 'peek':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapmapType.keyType }, refinements: [] },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof MinHeapMap || object.value instanceof MaxHeapMap)) {
                throw new Error('Internal: HeapMap value is undefined or invalid');
              }
              const val = object.value.peek();
              if (!val) {
                throw new Error('Error: cannot peek from an empty heapmap');
              }
              return val;
            }
          }
        };
      default:
        throw new Error(`Property ${propertyName} does not exist on HeapMap`);
    }
  }

  private evaluateGraphMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const graphType = object.type.static as { kind: 'graph'; nodeType: Type };
    const graph = object.value as Graph<RuntimeTypedBinder>;

    switch (propertyName) {
      case 'addVertex':
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
      case 'addEdge':
        return {
          type: { static: { kind: 'function', parameters: [graphType.nodeType, graphType.nodeType, { kind: 'int' }], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (from: RuntimeTypedBinder, to: RuntimeTypedBinder, weight?: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof Graph)) {
                throw new Error('Internal: Graph value is undefined or invalid');
              }
              const w = weight && (weight.type.static.kind === 'int' || weight.type.static.kind === 'float') ? weight.value as number : 1;
              object.value.addEdge(from, to, w);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'getNeighbors':
        // getNeighbors() returns Array<Record<{to: T, weight: int}>>
        return {
          type: {
            static: {
              kind: 'function',
              parameters: [graphType.nodeType],
              returnType: {
                kind: 'array',
                elementType: {
                  kind: 'record',
                  fieldTypes: [
                    ['to', graphType.nodeType], ['weight', { kind: 'int' }]]
                }
              }
            }, refinements: []
          },
          value: {
            fn: (vertex: RuntimeTypedBinder) => {
              if (!object.value || !(object.value instanceof Graph)) {
                throw new Error('Internal: Graph value is undefined or invalid');
              }
              const neighbors = object.value.getNeighbors(vertex);
              const arr = new SchemaArray<RuntimeTypedBinder>();
              neighbors.forEach((edge) => {
                const record: RuntimeTypedBinder = {
                  type: {
                    static: {
                      kind: 'record',
                      fieldTypes: [['to', graphType.nodeType], ['weight', { kind: 'int' }]]
                    },
                    refinements: []
                  },
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
      case 'hasVertex':
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
      case 'getVertices':
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
                arr.push(v);
              });
              return { type: { static: { kind: 'array', elementType: graphType.nodeType }, refinements: [] }, value: arr };
            }
          }
        };
      case 'isDirected':
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
      case 'size':
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
      case 'hasEdge':
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
      case 'getEdges': {

        return {
          type: {
            static: {
              kind: 'function',
              parameters: [],
              returnType: {
                kind: 'array',
                elementType: {
                  kind: 'record',
                  fieldTypes: [
                    ['from', graphType.nodeType],
                    ['to', graphType.nodeType],
                    ['weight', { kind: 'int' }]
                  ]
                }
              }
            },
            refinements: []
          },
          value: {
            fn: () => {
              if (!object.value || !(object.value instanceof Graph)) {
                throw new Error('Internal: Graph value is undefined or invalid');
              }
              const edges = object.value.getEdges();
              const arr = new SchemaArray<RuntimeTypedBinder>();
              edges.forEach((edge) => {
                const record: RuntimeTypedBinder = {
                  type: { static: { kind: 'record', fieldTypes: [['from', graphType.nodeType], ['to', graphType.nodeType], ['weight', { kind: 'int' }]] }, refinements: [] },
                  value: new Map<RuntimeTypedBinder, RuntimeTypedBinder>([
                    [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'from' }, edge.from as RuntimeTypedBinder],
                    [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'to' }, edge.to as RuntimeTypedBinder],
                    [{ type: { static: { kind: 'string' }, refinements: [] }, value: 'weight' }, { type: { static: { kind: 'int' }, refinements: [] }, value: edge.weight }],
                  ])
                };
                arr.push(record);
              });
              return { 
                type: { 
                  static: { 
                    kind: 'array', 
                    elementType: { 
                      kind: 'record', 
                      fieldTypes: [
                        ['from', graphType.nodeType], 
                        ['to', graphType.nodeType], 
                        ['weight', { kind: 'int' }]
                      ] 
                    } 
                  }, 
                  refinements: [] 
                }, 
                value: arr 
              }; 
            }
          }
        }
      }
      default:
        throw new Error(`Property ${propertyName} does not exist on Graph`);
    }
  }

  private evaluateBinaryTreeMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
  const treeType = object.type.static as { kind: 'binarytree' | 'avltree'; elementType: Type };
  const tree = object.value as BinaryTree<RuntimeTypedBinder> | AVLTree<RuntimeTypedBinder>;

  switch (propertyName) {
    case 'insert':
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
    case 'search':
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
    case 'inOrderTraversal':
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
    case 'preOrderTraversal':
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
    case 'postOrderTraversal':
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
    case 'getHeight':
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
    default:
      throw new Error(`Property ${propertyName} does not exist on BinaryTree/AVLTree`);
  }
}

  // ============================================================================
  // Index Expression Evaluation
  // ============================================================================

  public evaluateIndex(object: RuntimeTypedBinder, index: RuntimeTypedBinder): RuntimeTypedBinder {
  // Resolve actual runtime types for weak/union/intersection/dynamic types
  const indexActualType = getActualRuntimeType(index);

  // Check if object is an array (by static type or actual value)
  if (object.type.static.kind === 'array' || object.value instanceof SchemaArray) {
    if (index.type.static.kind === 'int' || indexActualType === 'int') {
      const val = (object.value as SchemaArray<RuntimeTypedBinder>).get(index.value as number);
      return val || { type: { static: { kind: 'void' }, refinements: [] }, value: new Sole() };
    }
    // Handle array slicing
    if (index.type.static.kind === 'array' && index.type.static.elementType.kind === 'int') {
      const indices = (index.value as SchemaArray<RuntimeTypedBinder>);
      const sourceArray = (object.value as SchemaArray<RuntimeTypedBinder>);
      const result = new SchemaArray<RuntimeTypedBinder>();

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

    // Handle array slicing with Range object
    if (index.type.static.kind === 'range') {
      const range = index.value as LazyRange;
      const sourceArray = (object.value as SchemaArray<RuntimeTypedBinder>);
      const result = new SchemaArray<RuntimeTypedBinder>();

      const start = range.getStart;
      let end = range.getEnd;
      const inclusive = range.isInclusive;

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

  if (object.type.static.kind === 'map' || object.value instanceof SchemaMap) {
    const key = runtimeTypedBinderToKey(index);
    const val = (object.value as SchemaMap<any, RuntimeTypedBinder>).get(key);
    return val || { type: { static: { kind: 'void' }, refinements: [] }, value: new Sole() };
  }

  if (object.type.static.kind === 'tuple' || Array.isArray(object.value)) {
    if (index.type.static.kind === 'int' || indexActualType === 'int') {
      const idx = index.value as number;
      const tupleValue = object.value as RuntimeTypedBinder[];
      if (idx >= 0 && idx < tupleValue.length) {
        return tupleValue[idx];
      }
      throw new Error(`Tuple index ${idx} out of bounds (length: ${tupleValue.length})`);
    }
    throw new Error('Tuple indices must be integers');
  }

  if (object.type.static.kind === 'record' || object.value instanceof Map) {
    if (index.type.static.kind === 'string' || indexActualType === 'string') {
      const recordValue = object.value as Map<RuntimeTypedBinder, RuntimeTypedBinder>;
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

  // ============================================================================
  // Invariant Helper
  // ============================================================================

  private checkInvariants(invariants: InvariantStatement[]): void {
  for(const invariant of invariants) {
    this.checkSingleInvariant(invariant);
  }
}

  private checkSingleInvariant(invariant: InvariantStatement): void {
  const condition = this.evaluateExpression(invariant.condition);
  if(typeof condition.value !== 'boolean') {
  throw new Error(`@invariant condition must evaluate to a boolean at ${invariant.line}:${invariant.column}`);
}
if (!condition.value) {
  let message = 'Invariant violated';
  if (invariant.message && invariant.message.type === 'StringLiteral') {
    message = invariant.message.value;
  }
  // Include current state in error message
  const state = this.captureEnvironmentState();
  throw new Error(`${message}\nCurrent state:\n${state}`);
}
  }

  private captureEnvironmentState(): string {
  const bindings: string[] = [];
  const envBindings = this.currentEnv.getAllBindings();

  for (const [name, binding] of envBindings) {
    // Skip function bindings for cleaner output
    if (binding.type.static.kind === 'function') {
      continue;
    }
    const valueStr = runtimeTypedBinderToString(binding);
    bindings.push(`  ${name} = ${valueStr}`);
  }

  return bindings.length > 0 ? bindings.join('\n') : '  (no variables)';
}

  // ============================================================================
  // Iterator Helper
  // ============================================================================

  private getIterator(iterable: RuntimeTypedBinder): IterableIterator < RuntimeTypedBinder > {
  const staticKind = iterable.type.static.kind;
  const isArray = staticKind === 'array' || iterable.value instanceof SchemaArray;
  const isSet = staticKind === 'set' || iterable.value instanceof SchemaSet;
  const isRange = staticKind === 'range' || iterable.value instanceof LazyRange;

  if(isArray) {
    const arr = iterable.value as SchemaArray<RuntimeTypedBinder>;
    let index = 0;
    return {
      [Symbol.iterator]() { return this; },
      next(): IteratorResult<RuntimeTypedBinder> {
        if (index < arr.length) {
          return { value: arr.get(index++)!, done: false };
        }
        return { value: undefined as any, done: true };
      }
    };
  }
    if(isSet) {
    const set = iterable.value as SchemaSet<any>;
    const values: RuntimeTypedBinder[] = [];
    set.forEach(v => values.push(keyToRuntimeTypedBinder(v)));
    let index = 0;
    return {
      [Symbol.iterator]() { return this; },
      next(): IteratorResult<RuntimeTypedBinder> {
        if (index < values.length) {
          return { value: values[index++], done: false };
        }
        return { value: undefined as any, done: true };
      }
    };
  }
    if(isRange) {
    const range = iterable.value as LazyRange;
    const gen = range.generate();
    return {
      [Symbol.iterator]() { return this; },
      next(): IteratorResult<RuntimeTypedBinder> {
        const result = gen.next();
        if (!result.done) {
          return { value: { value: result.value, type: { static: { kind: 'int' }, refinements: [] } }, done: false };
        }
        return { value: undefined as any, done: true };
      }
    };
  }
    throw new Error('Not iterable');
}
}
