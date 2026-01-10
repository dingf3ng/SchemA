/**
 * Abstract Machine Implementation for SchemA
 *
 * This implements a CEK-style abstract machine where:
 * - C (Control): The focused expression/statement being evaluated
 * - E (Environment): The current variable bindings
 * - K (Kontinuation): The evaluation context (what to do with the result)
 *
 * The machine operates in small steps, making stepping trivial.
 * Each step either:
 * 1. Decomposes a complex expression into simpler parts (pushing continuations)
 * 2. Applies a continuation to a value (popping continuations)
 */

import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  BlockStatement,
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
} from '../builtins/data-structures';
import { Environment } from './environment';
import {
  generateStringRange,
  getActualRuntimeType,
  hasWeakTypes,
  isTruthy,
  keyToRuntimeTypeBinder,
  resolveTypeAnnotation,
  RuntimeTypeBinderToKey,
  RuntimeTypedBinder,
  RuntimeTypedBinderToString,
  valuesEqual
} from './runtime-utils';
import { Type, typeToString } from '../type-checker/type-checker-utils';
import { Continuation, Focus, MachineState, ReturnException } from './machine-utils';
import { parsePredicateName } from '../analyzer/analyzer-utils';
import { InvariantTracker } from '../analyzer/synthesizer';
import { initializeBuiltins } from './init-builtins';


// ============================================================================
// Machine Implementation
// ============================================================================

export class Machine {
  private focus: Focus = { kind: 'done' };
  private currentEnv: Environment;
  private globalEnv: Environment;
  private kontinuation: Continuation[] = [];
  private output: string[] = [];
  private trackerStack: InvariantTracker[] = [];

  constructor() {
    this.globalEnv = new Environment();
    this.currentEnv = initializeBuiltins(this.globalEnv, this.output);
  }

  /**
   * Initialize with a program
   */
  initialize(program: Program): void {
    this.output.length = 0;
    this.kontinuation = [{ kind: 'halt' }];

    if (program.body.length > 0) {
      this.focus = { kind: 'stmt', stmt: program.body[0] };
      if (program.body.length > 1) {
        this.kontinuation.push({
          kind: 'stmt-seq',
          statements: program.body,
          index: 1,
          savedEnv: this.currentEnv,
          restoreEnv: false
        });
      }
    } else {
      this.focus = { kind: 'done' };
    }
  }

  /**
   * Check if the machine has finished
   */
  isFinished(): boolean {
    return this.focus.kind === 'done';
  }

  /**
   * Get current state for stepping UI
   */
  getState(): MachineState {
    let line = 0, column = 0;
    if (this.focus.kind === 'expr') {
      line = this.focus.expr.line;
      column = this.focus.expr.column;
    } else if (this.focus.kind === 'stmt') {
      line = this.focus.stmt.line;
      column = this.focus.stmt.column;
    }

    return {
      focus: this.focus,
      environment: this.currentEnv,
      kontinuation: this.kontinuation,
      output: [...this.output],
      finished: this.isFinished(),
      line,
      column
    };
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.currentEnv;
  }

  /**
   * Get output
   */
  getOutput(): string[] {
    return this.output;
  }

  /**
   * Execute a single step
   */
  step(): MachineState {
    if (this.isFinished()) {
      return this.getState();
    }

    try {
      if (this.focus.kind === 'expr') {
        this.stepExpr(this.focus.expr);
      } else if (this.focus.kind === 'stmt') {
        this.stepStmt(this.focus.stmt);
      } else if (this.focus.kind === 'value') {
        this.stepValue(this.focus.value);
      }
    } catch (e) {
      if (e instanceof ReturnException) {
        // Handle return by unwinding continuation stack until we find a call-apply
        this.handleReturn(e.value);
      } else {
        throw e;
      }
    }

    return this.getState();
  }

  /**
   * Run to completion
   */
  run(): string[] {
    while (!this.isFinished()) {
      this.step();
    }
    return this.output;
  }

  // ============================================================================
  // Expression Stepping
  // ============================================================================

  private stepExpr(expr: Expression): void {
    switch (expr.type) {
      case 'IntegerLiteral':
        this.focus = { kind: 'value', value: { value: expr.value, type: { static: { kind: 'int' }, refinements: [] } } };
        break;

      case 'FloatLiteral':
        this.focus = { kind: 'value', value: { value: expr.value, type: { static: { kind: 'float' }, refinements: [] } } };
        break;

      case 'StringLiteral':
        this.focus = { kind: 'value', value: { value: expr.value, type: { static: { kind: 'string' }, refinements: [] } } };
        break;

      case 'BooleanLiteral':
        this.focus = { kind: 'value', value: { value: expr.value, type: { static: { kind: 'boolean' }, refinements: [] } } };
        break;

      case 'Identifier': {
        if (expr.name === '_') {
          throw new Error('Underscore (_) cannot be used as a value');
        }
        const value = this.currentEnv.get(expr.name);
        this.focus = { kind: 'value', value };
        break;
      }

      case 'MetaIdentifier':
        this.focus = { kind: 'value', value: { value: expr.name, type: { static: { kind: 'predicate' }, refinements: [] } } };
        break;

      case 'ArrayLiteral': {
        if (expr.elements.length === 0) {
          this.focus = {
            kind: 'value',
            value: { value: new SchemaArray([]), type: { static: { kind: 'array', elementType: { kind: 'poly' } }, refinements: [] } }
          };
        } else {
          this.kontinuation.push({
            kind: 'array-lit',
            evaluatedElements: [],
            remainingElements: expr.elements.slice(1)
          });
          this.focus = { kind: 'expr', expr: expr.elements[0] };
        }
        break;
      }

      case 'BinaryExpression': {
        // Handle short-circuit operators specially
        if (expr.operator === '&&') {
          this.kontinuation.push({ kind: 'and', right: expr.right });
          this.focus = { kind: 'expr', expr: expr.left };
        } else if (expr.operator === '||') {
          this.kontinuation.push({ kind: 'or', right: expr.right });
          this.focus = { kind: 'expr', expr: expr.left };
        } else {
          this.kontinuation.push({
            kind: 'binop-left',
            operator: expr.operator,
            right: expr.right,
            line: expr.line,
            column: expr.column
          });
          this.focus = { kind: 'expr', expr: expr.left };
        }
        break;
      }

      case 'UnaryExpression': {
        this.kontinuation.push({ kind: 'unary', operator: expr.operator });
        this.focus = { kind: 'expr', expr: expr.operand };
        break;
      }

      case 'CallExpression': {
        this.kontinuation.push({
          kind: 'call-callee',
          args: expr.arguments
        });
        this.focus = { kind: 'expr', expr: expr.callee };
        break;
      }

      case 'MemberExpression': {
        this.kontinuation.push({ kind: 'member', property: expr.property.name });
        this.focus = { kind: 'expr', expr: expr.object };
        break;
      }

      case 'IndexExpression': {
        this.kontinuation.push({ kind: 'index-obj', index: expr.index });
        this.focus = { kind: 'expr', expr: expr.object };
        break;
      }

      case 'RangeExpression': {
        if (expr.start) {
          this.kontinuation.push({
            kind: 'range-start',
            end: expr.end,
            inclusive: expr.inclusive
          });
          this.focus = { kind: 'expr', expr: expr.start };
        } else {
          // No start, use default 0
          const startVal: RuntimeTypedBinder = { value: 0, type: { static: { kind: 'int' }, refinements: [] } };
          if (expr.end) {
            this.kontinuation.push({
              kind: 'range-end',
              start: startVal,
              inclusive: expr.inclusive
            });
            this.focus = { kind: 'expr', expr: expr.end };
          } else {
            // Infinite range from 0
            const range = new LazyRange(0, undefined, expr.inclusive);
            this.focus = { kind: 'value', value: { value: range, type: { static: { kind: 'range' }, refinements: [] } } };
          }
        }
        break;
      }

      case 'TypeOfExpression': {
        // Evaluate the operand first
        this.kontinuation.push({ kind: 'unary', operator: 'typeof' });
        this.focus = { kind: 'expr', expr: expr.operand };
        break;
      }

      case 'PredicateCheckExpression': {
        // Evaluate predicate arguments first if any
        if (expr.predicateArgs && expr.predicateArgs.length > 0) {
          this.kontinuation.push({
            kind: 'predicate-args',
            predicateName: expr.predicateName,
            subject: expr.subject,
            evaluatedArgs: [],
            remainingArgs: expr.predicateArgs.slice(1)
          });
          this.focus = { kind: 'expr', expr: expr.predicateArgs[0] };
        } else {
          // No predicate args, evaluate subject directly
          this.kontinuation.push({
            kind: 'predicate-check',
            predicateName: expr.predicateName,
            predicateArgs: undefined,
            subjectExpr: expr.subject
          });
          this.focus = { kind: 'expr', expr: expr.subject };
        }
        break;
      }

      default:
        throw new Error(`Unsupported expression type: ${(expr as any).type}`);
    }
  }

  // ============================================================================
  // Statement Stepping
  // ============================================================================

  private stepStmt(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration':
        this.evaluateFunctionDeclaration(stmt);
        this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        break;

      case 'VariableDeclaration': {
        const decl = stmt.declarations[0];
        if (decl.initializer) {
          const remaining = stmt.declarations.slice(1).map(d => ({
            name: d.name,
            typeAnnotation: d.typeAnnotation!,
            initializer: d.initializer
          }));
          this.kontinuation.push({
            kind: 'var-decl',
            name: decl.name,
            typeAnnotation: decl.typeAnnotation!,
            remainingDeclarators: remaining
          });
          this.focus = { kind: 'expr', expr: decl.initializer };
        } else {
          // No initializer - bind undefined
          const declaredType = resolveTypeAnnotation(decl.typeAnnotation);
          const value: RuntimeTypedBinder = { value: undefined, type: { static: declaredType, refinements: [] } };
          if (decl.name !== '_') {
            this.currentEnv.define(decl.name, value);
          }
          // Process remaining declarations
          if (stmt.declarations.length > 1) {
            const remaining = stmt.declarations.slice(1);
            this.focus = {
              kind: 'stmt',
              stmt: { ...stmt, declarations: remaining }
            };
          } else {
            this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
          }
        }
        break;
      }

      case 'AssignmentStatement': {
        this.kontinuation.push({ kind: 'assign', target: stmt.target });
        this.focus = { kind: 'expr', expr: stmt.value };
        break;
      }

      case 'IfStatement': {
        this.kontinuation.push({
          kind: 'if-cond',
          thenBranch: stmt.thenBranch,
          elseBranch: stmt.elseBranch
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      case 'WhileStatement': {
        this.kontinuation.push({
          kind: 'while-cond',
          condition: stmt.condition,
          body: stmt.body
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      case 'UntilStatement': {
        this.kontinuation.push({
          kind: 'until-cond',
          condition: stmt.condition,
          body: stmt.body
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      case 'ForStatement': {
        // First evaluate the iterable
        this.kontinuation.push({
          kind: 'for-init',
          variable: stmt.variable,
          body: stmt.body,
          savedEnv: this.currentEnv
        });
        this.focus = { kind: 'expr', expr: stmt.iterable };
        break;
      }

      case 'ReturnStatement': {
        if (stmt.value) {
          this.kontinuation.push({ kind: 'return' });
          this.focus = { kind: 'expr', expr: stmt.value };
        } else {
          throw new ReturnException({ value: undefined, type: { static: { kind: 'void' }, refinements: [] } });
        }
        break;
      }

      case 'BlockStatement': {
        const savedEnv = this.currentEnv;
        this.currentEnv = new Environment(savedEnv);

        if (stmt.statements.length === 0) {
          this.currentEnv = savedEnv;
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        } else {
          if (stmt.statements.length > 1) {
            this.kontinuation.push({
              kind: 'stmt-seq',
              statements: stmt.statements,
              index: 1,
              savedEnv,
              restoreEnv: true
            });
          } else {
            // Single statement, restore env after
            this.kontinuation.push({
              kind: 'stmt-seq',
              statements: [],
              index: 0,
              savedEnv,
              restoreEnv: true
            });
          }
          this.focus = { kind: 'stmt', stmt: stmt.statements[0] };
        }
        break;
      }

      case 'ExpressionStatement': {
        this.kontinuation.push({ kind: 'expr-stmt' });
        this.focus = { kind: 'expr', expr: stmt.expression };
        break;
      }

      case 'InvariantStatement': {
        // Evaluate the condition and check invariant
        this.kontinuation.push({
          kind: 'invariant-check',
          stmt: stmt,
          savedEnv: this.currentEnv
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      case 'AssertStatement': {
        // Evaluate the condition and check assertion
        this.kontinuation.push({
          kind: 'assert-check',
          stmt: stmt,
          savedEnv: this.currentEnv
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      default:
        throw new Error(`Unsupported statement type: ${(stmt as any).type}`);
    }
  }

  // ============================================================================
  // Value/Continuation Stepping
  // ============================================================================

  private stepValue(value: RuntimeTypedBinder): void {
    if (this.kontinuation.length === 0) {
      this.focus = { kind: 'done' };
      return;
    }

    const kont = this.kontinuation.pop()!;

    switch (kont.kind) {
      case 'halt':
        this.focus = { kind: 'done' };
        break;

      case 'stmt-seq': {
        if (kont.index < kont.statements.length) {
          this.kontinuation.push({
            ...kont,
            index: kont.index + 1
          });
          this.focus = { kind: 'stmt', stmt: kont.statements[kont.index] };
        } else {
          if (kont.restoreEnv) {
            this.currentEnv = kont.savedEnv;
          }
          this.focus = { kind: 'value', value };
        }
        break;
      }

      case 'var-decl': {
        if (kont.name !== '_') {
          // Apply type annotation if present
          let finalValue = value;
          if (kont.typeAnnotation) {
            const declaredType = resolveTypeAnnotation(kont.typeAnnotation);
            if (!hasWeakTypes(declaredType)) {
              finalValue = { ...value, type: { ...value.type, static: declaredType } };
            }
          }
          this.currentEnv.define(kont.name, finalValue);
        }

        if (kont.remainingDeclarators.length > 0) {
          const next = kont.remainingDeclarators[0];
          if (next.initializer) {
            this.kontinuation.push({
              kind: 'var-decl',
              name: next.name,
              typeAnnotation: next.typeAnnotation,
              remainingDeclarators: kont.remainingDeclarators.slice(1)
            });
            this.focus = { kind: 'expr', expr: next.initializer };
          }
        } else {
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'assign': {
        const target = kont.target;
        if (target.type === 'Identifier') {
          if (target.name === '_') {
            throw new Error('Cannot assign to underscore (_)');
          }
          this.currentEnv.set(target.name, value);
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        } else if (target.type === 'MemberExpression') {
          this.kontinuation.push({
            kind: 'assign-index-final',
            object: null as any, // Will be set
            index: { value: target.property.name, type: { static: { kind: 'string' }, refinements: [] } }
          });
          // Save the value to assign
          this.kontinuation.push({
            kind: 'assign-index',
            object: null as any, // placeholder
            indexExpr: null as any // placeholder
          });
          // Hack: store value temporarily
          (this.kontinuation[this.kontinuation.length - 1] as any).valueToAssign = value;
          this.focus = { kind: 'expr', expr: target.object };
        } else if (target.type === 'IndexExpression') {
          // Store value, evaluate object
          this.kontinuation.push({
            kind: 'assign-index',
            object: null as any,
            indexExpr: target.index
          });
          (this.kontinuation[this.kontinuation.length - 1] as any).valueToAssign = value;
          this.focus = { kind: 'expr', expr: target.object };
        } else {
          throw new Error('Invalid assignment target');
        }
        break;
      }

      case 'assign-index': {
        // Value is the object, now evaluate index
        const valueToAssign = (kont as any).valueToAssign;
        this.kontinuation.push({
          kind: 'assign-index-final',
          object: value,
          index: null as any
        });
        (this.kontinuation[this.kontinuation.length - 1] as any).valueToAssign = valueToAssign;
        this.focus = { kind: 'expr', expr: kont.indexExpr };
        break;
      }

      case 'assign-index-final': {
        const valueToAssign = (kont as any).valueToAssign;
        const obj = kont.object;
        const idx = value;

        if (obj.type.static.kind === 'array' && idx.type.static.kind === 'int') {
          (obj.value as SchemaArray<RuntimeTypedBinder>).set(idx.value as number, valueToAssign);
        } else if (obj.type.static.kind === 'map') {
          const key = RuntimeTypeBinderToKey(idx);
          (obj.value as SchemaMap<any, RuntimeTypedBinder>).set(key, valueToAssign);
        } else {
          throw new Error('Invalid assignment target');
        }
        this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        break;
      }

      case 'if-cond': {
        if (value.type.static.kind !== 'boolean') {
          throw new Error('If condition must be boolean');
        }
        if (value.value as boolean) {
          this.focus = { kind: 'stmt', stmt: kont.thenBranch };
        } else if (kont.elseBranch) {
          this.focus = { kind: 'stmt', stmt: kont.elseBranch };
        } else {
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'while-cond': {
        if (value.type.static.kind !== 'boolean') {
          throw new Error('While condition must be boolean');
        }
        if (value.value as boolean) {
          // Push continuation for next iteration check
          this.kontinuation.push({
            kind: 'while',
            condition: kont.condition,
            body: kont.body
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'while': {
        // After body, check condition again
        this.kontinuation.push({
          kind: 'while-cond',
          condition: kont.condition,
          body: kont.body
        });
        this.focus = { kind: 'expr', expr: kont.condition };
        break;
      }

      case 'until-cond': {
        if (value.type.static.kind !== 'boolean') {
          throw new Error('Until condition must be boolean');
        }
        if (!(value.value as boolean)) {
          // Push continuation for next iteration check
          this.kontinuation.push({
            kind: 'until',
            condition: kont.condition,
            body: kont.body
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'until': {
        // After body, check condition again
        this.kontinuation.push({
          kind: 'until-cond',
          condition: kont.condition,
          body: kont.body
        });
        this.focus = { kind: 'expr', expr: kont.condition };
        break;
      }

      case 'for-init': {
        // Value is the iterable, set up iterator
        const iterator = this.getIterator(value);
        const next = iterator.next();

        if (!next.done) {
          this.currentEnv = new Environment(kont.savedEnv);
          if (kont.variable !== '_') {
            this.currentEnv.define(kont.variable, next.value);
          }
          // Push continuation for next iteration
          this.kontinuation.push({
            kind: 'for-next',
            variable: kont.variable,
            iterator,
            body: kont.body,
            savedEnv: kont.savedEnv
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'for-next': {
        // Value is body result (void), continue iteration
        const iterator = kont.iterator;
        const next = iterator.next();

        if (!next.done) {
          this.currentEnv = new Environment(kont.savedEnv);
          if (kont.variable !== '_') {
            this.currentEnv.define(kont.variable, next.value);
          }
          // Push continuation for next iteration
          this.kontinuation.push({
            kind: 'for-next',
            variable: kont.variable,
            iterator,
            body: kont.body,
            savedEnv: kont.savedEnv
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          // Restore environment
          this.currentEnv = kont.savedEnv;
          this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'return': {
        throw new ReturnException(value);
      }

      case 'binop-left': {
        this.kontinuation.push({
          kind: 'binop-right',
          operator: kont.operator,
          left: value,
          line: kont.line,
          column: kont.column
        });
        this.focus = { kind: 'expr', expr: kont.right };
        break;
      }

      case 'binop-right': {
        const result = this.applyBinaryOp(kont.operator, kont.left, value, kont.line, kont.column);
        this.focus = { kind: 'value', value: result };
        break;
      }

      case 'and': {
        if (!isTruthy(value)) {
          this.focus = { kind: 'value', value: { value: false, type: { static: { kind: 'boolean' }, refinements: [] } } };
        } else {
          this.kontinuation.push({
            kind: 'binop-right',
            operator: '&&',
            left: value,
            line: 0,
            column: 0
          });
          this.focus = { kind: 'expr', expr: kont.right };
        }
        break;
      }

      case 'or': {
        if (isTruthy(value)) {
          this.focus = { kind: 'value', value: { value: true, type: { static: { kind: 'boolean' }, refinements: [] } } };
        } else {
          this.kontinuation.push({
            kind: 'binop-right',
            operator: '||',
            left: value,
            line: 0,
            column: 0
          });
          this.focus = { kind: 'expr', expr: kont.right };
        }
        break;
      }

      case 'unary': {
        if (kont.operator === '-') {
          if (value.type.static.kind === 'int') {
            this.focus = { kind: 'value', value: { value: -(value.value as number), type: { static: { kind: 'int' }, refinements: [] } } };
          } else if (value.type.static.kind === 'float') {
            this.focus = { kind: 'value', value: { value: -(value.value as number), type: { static: { kind: 'float' }, refinements: [] } } };
          } else {
            throw new Error('Unary minus requires int or float operand');
          }
        } else if (kont.operator === '!') {
          if (value.type.static.kind !== 'boolean') {
            throw new Error('Logical NOT requires boolean operand');
          }
          this.focus = { kind: 'value', value: { value: !(value.value as boolean), type: { static: { kind: 'boolean' }, refinements: [] } } };
        } else if (kont.operator === 'typeof') {
          const typeStr = typeToString(value.type.static);
          this.focus = { kind: 'value', value: { value: typeStr, type: { static: { kind: 'string' }, refinements: [] } } };
        } else {
          throw new Error(`Unknown unary operator: ${kont.operator}`);
        }
        break;
      }

      case 'call-callee': {
        if (kont.args.length === 0) {
          // No arguments, apply immediately
          const result = this.applyFunction(value, []);
          // If result is null, applyFunction already set up the focus (user-defined function)
          if (result !== null) {
            this.focus = { kind: 'value', value: result };
          }
        } else {
          this.kontinuation.push({
            kind: 'call-args',
            callee: value,
            evaluatedArgs: [],
            remainingArgs: kont.args.slice(1)
          });
          this.focus = { kind: 'expr', expr: kont.args[0] };
        }
        break;
      }

      case 'call-args': {
        const evaluatedArgs = [...kont.evaluatedArgs, value];
        if (kont.remainingArgs.length === 0) {
          // All arguments evaluated, apply function
          const result = this.applyFunction(kont.callee, evaluatedArgs);
          // If result is null, applyFunction already set up the focus (user-defined function)
          if (result !== null) {
            this.focus = { kind: 'value', value: result };
          }
        } else {
          this.kontinuation.push({
            kind: 'call-args',
            callee: kont.callee,
            evaluatedArgs,
            remainingArgs: kont.remainingArgs.slice(1)
          });
          this.focus = { kind: 'expr', expr: kont.remainingArgs[0] };
        }
        break;
      }

      case 'call-apply': {
        // Restore environment after function call
        this.currentEnv = kont.savedEnv;
        this.focus = { kind: 'value', value };
        break;
      }

      case 'member': {
        const result = this.evaluateMember(value, kont.property);
        this.focus = { kind: 'value', value: result };
        break;
      }

      case 'index-obj': {
        this.kontinuation.push({ kind: 'index-idx', object: value });
        this.focus = { kind: 'expr', expr: kont.index };
        break;
      }

      case 'index-idx': {
        const result = this.evaluateIndex(kont.object, value);
        this.focus = { kind: 'value', value: result };
        break;
      }

      case 'array-lit': {
        const evaluated = [...kont.evaluatedElements, value];
        if (kont.remainingElements.length === 0) {
          const elementType = evaluated.length > 0 ? evaluated[0].type.static : { kind: 'poly' as const };
          this.focus = {
            kind: 'value',
            value: {
              value: new SchemaArray(evaluated),
              type: { static: { kind: 'array', elementType }, refinements: [] }
            }
          };
        } else {
          this.kontinuation.push({
            kind: 'array-lit',
            evaluatedElements: evaluated,
            remainingElements: kont.remainingElements.slice(1)
          });
          this.focus = { kind: 'expr', expr: kont.remainingElements[0] };
        }
        break;
      }

      case 'range-start': {
        if (kont.end) {
          this.kontinuation.push({
            kind: 'range-end',
            start: value,
            inclusive: kont.inclusive
          });
          this.focus = { kind: 'expr', expr: kont.end };
        } else {
          // Infinite range from start
          const start = value.value as number;
          const range = new LazyRange(start, undefined, kont.inclusive);
          this.focus = { kind: 'value', value: { value: range, type: { static: { kind: 'range' }, refinements: [] } } };
        }
        break;
      }

      case 'range-end': {
        // Check if this is a string range
        if (kont.start && kont.start.type.static.kind === 'string' && value.type.static.kind === 'string') {
          // String range
          const start = kont.start.value as string;
          const end = value.value as string;
          const elements = generateStringRange(start, end, kont.inclusive);
          this.focus = {
            kind: 'value',
            value: elements
          };
        } else {
          // Integer range
          const start = kont.start ? (kont.start.value as number) : 0;
          const end = value.value as number;
          const range = new LazyRange(start, end, kont.inclusive);

          if (!range.isInfinite) {
            const elements = range.toArray().map(val => ({
              value: val,
              type: { static: { kind: 'int' as const }, refinements: [] }
            }));
            this.focus = {
              kind: 'value',
              value: { value: new SchemaArray(elements), type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] } }
            };
          } else {
            this.focus = { kind: 'value', value: { value: range, type: { static: { kind: 'range' }, refinements: [] } } };
          }
        }
        break;
      }

      case 'expr-stmt': {
        // Discard expression result
        this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        break;
      }

      case 'invariant-check': {
        // Value is the evaluated condition
        if (typeof value.value !== 'boolean') {
          throw new Error(
            `@invariant condition must evaluate to a boolean, got ${typeof value.value}. At ${kont.stmt.line}, ${kont.stmt.column}`
          );
        }

        if (!value.value) {
          let message = 'Invariant violated';

          if (kont.stmt.message) {
            // Evaluate message expression
            if (kont.stmt.message.type === 'StringLiteral') {
              message = kont.stmt.message.value;
            }
          }

          // Include current state in error message
          const state = this.captureEnvironmentState(kont.savedEnv);
          throw new Error(`${message}\nCurrent state:\n${state}`);
        }

        this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        break;
      }

      case 'assert-check': {
        // Value is the evaluated condition
        if (typeof value.value !== 'boolean') {
          throw new Error(
            `@assert condition must evaluate to a boolean, got ${typeof value.value}. At ${kont.stmt.line}, ${kont.stmt.column}`
          );
        }

        if (!value.value) {
          let message = 'Assertion failed';

          if (kont.stmt.message) {
            // Evaluate message expression
            // For simplicity, we'll handle string literals directly
            if (kont.stmt.message.type === 'StringLiteral') {
              message = kont.stmt.message.value;
            }
          }

          // Include current state in error message
          const state = this.captureEnvironmentState(kont.savedEnv);
          throw new Error(`${message}\nCurrent state:\n${state}`);
        }

        this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
        break;
      }

      case 'predicate-args': {
        // Value is the evaluated predicate argument
        const evaluatedArgs = [...kont.evaluatedArgs, value];

        if (kont.remainingArgs.length === 0) {
          // All args evaluated, now evaluate the subject
          this.kontinuation.push({
            kind: 'predicate-check',
            predicateName: kont.predicateName,
            predicateArgs: evaluatedArgs,
            subjectExpr: kont.subject
          });
          this.focus = { kind: 'expr', expr: kont.subject };
        } else {
          // More args to evaluate
          this.kontinuation.push({
            kind: 'predicate-args',
            predicateName: kont.predicateName,
            subject: kont.subject,
            evaluatedArgs,
            remainingArgs: kont.remainingArgs.slice(1)
          });
          this.focus = { kind: 'expr', expr: kont.remainingArgs[0] };
        }
        break;
      }

      case 'predicate-check': {
        // Value is the evaluated subject
        const subject = value;

        // Use existing tracker if available (inside a loop), otherwise create a new one
        const tracker = this.trackerStack.length > 0
          ? this.trackerStack[this.trackerStack.length - 1]
          : new InvariantTracker();

        // Parse the predicate name into a Predicate object
        const predicate = parsePredicateName(kont.predicateName, kont.predicateArgs);

        // Get variable name if subject is an identifier
        let variableName: string | undefined;
        if (kont.subjectExpr.type === 'Identifier') {
          variableName = kont.subjectExpr.name;
        }

        // Check the predicate against the subject value
        const result = tracker.check(predicate, subject, variableName);

        this.focus = { kind: 'value', value: { value: result, type: { static: { kind: 'boolean' }, refinements: [] } } };
        break;
      }

      default:
        throw new Error(`Unknown continuation kind: ${(kont as any).kind}`);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private handleReturn(value: RuntimeTypedBinder): void {
    // Unwind continuation stack until we find a call-apply
    while (this.kontinuation.length > 0) {
      const kont = this.kontinuation.pop()!;
      if (kont.kind === 'call-apply') {
        this.currentEnv = kont.savedEnv;
        this.focus = { kind: 'value', value };
        return;
      }
      // Clean up any environments that need restoring
      if (kont.kind === 'stmt-seq' && kont.restoreEnv) {
        this.currentEnv = kont.savedEnv;
      }
    }
    // If we didn't find a call-apply, we're at top level
    this.focus = { kind: 'done' };
  }

  /**
   * Capture the current environment state for error reporting
   */
  private captureEnvironmentState(env: Environment): string {
    const bindings: string[] = [];

    // Get all variable bindings from the environment
    const envBindings = env.getAllBindings();

    for (const [name, binding] of envBindings) {
      // Skip function bindings for cleaner output
      if (binding.type.static.kind === 'function') {
        continue;
      }

      const valueStr = RuntimeTypedBinderToString(binding);
      bindings.push(`  ${name} = ${valueStr}`);
    }

    return bindings.length > 0 ? bindings.join('\n') : '  (no variables)';
  }

  private applyFunction(callee: RuntimeTypedBinder, args: RuntimeTypedBinder[]): RuntimeTypedBinder | null {
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

      // Push continuation for returning from function
      this.kontinuation.push({
        kind: 'call-apply',
        callee,
        args,
        savedEnv
      });

      // Set up to evaluate function body
      const body = calleeValue.body as BlockStatement;
      if (body.statements.length > 0) {
        if (body.statements.length > 1) {
          this.kontinuation.push({
            kind: 'stmt-seq',
            statements: body.statements,
            index: 1,
            savedEnv: this.currentEnv,
            restoreEnv: false
          });
        }
        this.focus = { kind: 'stmt', stmt: body.statements[0] };
      } else {
        // Empty function body - return void
        this.focus = { kind: 'value', value: { value: undefined, type: { static: { kind: 'void' }, refinements: [] } } };
      }

      // Return null to indicate focus was already set
      return null;
    }

    throw new Error('Not a function');
  }

  private evaluateMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    if (object.type.static.kind === 'array') {
      if (propertyName === 'length') {
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
          value: {
            fn: () => ({ type: { static: { kind: 'int' }, refinements: [] }, value: (object.value as SchemaArray<any>).length })
          }
        };
      }
      if (propertyName === 'push') {
        return {
          type: { static: { kind: 'function', parameters: [object.type.static.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              (object.value as SchemaArray<RuntimeTypedBinder>).push(item);
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
              const popped = (object.value as SchemaArray<RuntimeTypedBinder>).pop();
              if (!popped) throw new Error('Cannot pop from empty array');
              return popped;
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

    if (object.type.static.kind === 'binarytree' || object.type.static.kind === 'avltree') {
      return this.evaluateBinaryTreeMember(object, propertyName);
    }

    throw new Error(`Property ${propertyName} does not exist on type ${object.type.static.kind}`);
  }

  private evaluateMapMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const mapType = object.type.static as { kind: 'map'; keyType: Type; valueType: Type };
    const map = object.value as SchemaMap<any, RuntimeTypedBinder>;

    switch (propertyName) {
      case 'size':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
          value: { fn: () => ({ type: { static: { kind: 'int' }, refinements: [] }, value: map.size }) }
        };
      case 'get':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: mapType.valueType }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder) => {
              const k = RuntimeTypeBinderToKey(key);
              return map.get(k) || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'set':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType, mapType.valueType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder, value: RuntimeTypedBinder) => {
              const k = RuntimeTypeBinderToKey(key);
              map.set(k, value);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'has':
        return {
          type: { static: { kind: 'function', parameters: [mapType.keyType], returnType: { kind: 'boolean' } }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder) => {
              const k = RuntimeTypeBinderToKey(key);
              return { type: { static: { kind: 'boolean' }, refinements: [] }, value: map.has(k) };
            }
          }
        };
      case 'keys':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: mapType.keyType } }, refinements: [] },
          value: {
            fn: () => {
              const arr = new SchemaArray<RuntimeTypedBinder>();
              map.forEach((_, key) => arr.push(keyToRuntimeTypeBinder(key)));
              return { type: { static: { kind: 'array', elementType: mapType.keyType }, refinements: [] }, value: arr };
            }
          }
        };
      case 'values':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: mapType.valueType } }, refinements: [] },
          value: {
            fn: () => {
              const arr = new SchemaArray<RuntimeTypedBinder>();
              map.forEach((value) => arr.push(value));
              return { type: { static: { kind: 'array', elementType: mapType.valueType }, refinements: [] }, value: arr };
            }
          }
        };
      case 'entries':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] } } }, refinements: [] },
          value: {
            fn: () => {
              const arr = new SchemaArray<RuntimeTypedBinder>();
              map.forEach((value, key) => {
                const tuple: RuntimeTypedBinder[] = [
                  keyToRuntimeTypeBinder(key),
                  value
                ];
                arr.push({ type: { static: { kind: 'tuple', elementTypes: [mapType.keyType, mapType.valueType] }, refinements: [] }, value: tuple });
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
          value: { fn: () => ({ type: { static: { kind: 'int' }, refinements: [] }, value: set.size }) }
        };
      case 'add':
        return {
          type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              const k = RuntimeTypeBinderToKey(item);
              set.add(k);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'has':
        return {
          type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'boolean' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              const k = RuntimeTypeBinderToKey(item);
              return { type: { static: { kind: 'boolean' }, refinements: [] }, value: set.has(k) };
            }
          }
        };
      case 'delete':
        return {
          type: { static: { kind: 'function', parameters: [setType.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              const k = RuntimeTypeBinderToKey(item);
              set.delete(k);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'values':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: setType.elementType } }, refinements: [] },
          value: {
            fn: () => {
              const arr = new SchemaArray<RuntimeTypedBinder>();
              set.forEach((item) => arr.push(keyToRuntimeTypeBinder(item)));
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
          value: { fn: () => ({ type: { static: { kind: 'int' }, refinements: [] }, value: heap.size }) }
        };
      case 'push':
        return {
          type: { static: { kind: 'function', parameters: [heapType.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (item: RuntimeTypedBinder) => {
              heap.push(item);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'pop':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapType.elementType }, refinements: [] },
          value: {
            fn: () => {
              const val = heap.pop();
              if (!val) throw new Error('Cannot pop from empty heap');
              return val;
            }
          }
        };
      case 'peek':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapType.elementType }, refinements: [] },
          value: {
            fn: () => {
              const val = heap.peek();
              if (!val) throw new Error('Cannot peek empty heap');
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
          value: { fn: () => ({ type: { static: { kind: 'int' }, refinements: [] }, value: heapmap.size }) }
        };
      case 'push':
        return {
          type: { static: { kind: 'function', parameters: [heapmapType.keyType, heapmapType.valueType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (key: RuntimeTypedBinder, value: RuntimeTypedBinder) => {
              heapmap.push(key, value);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'pop':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapmapType.keyType }, refinements: [] },
          value: {
            fn: () => {
              const val = heapmap.pop();
              if (!val) throw new Error('Cannot pop from empty heapmap');
              return val;
            }
          }
        };
      case 'peek':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: heapmapType.keyType }, refinements: [] },
          value: {
            fn: () => {
              const val = heapmap.peek();
              if (!val) throw new Error('Cannot peek empty heapmap');
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
          type: {
            static: {
              kind: 'function',
              parameters: [graphType.nodeType],
              returnType: { kind: 'void' }
            },
            refinements: []
          },
          value: {
            fn: (vertex: RuntimeTypedBinder) => {
              graph.addVertex(vertex);
              return {
                type: {
                  static: { kind: 'void' },
                  refinements: []
                },
                value: undefined
              };
            }
          }
        };
      case 'addEdge':
        return {
          type: { static: { kind: 'function', parameters: [graphType.nodeType, graphType.nodeType, { kind: 'int' }], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (from: RuntimeTypedBinder, to: RuntimeTypedBinder, weight?: RuntimeTypedBinder) => {
              const w = weight && (weight.type.static.kind === 'int' || weight.type.static.kind === 'float') ? weight.value as number : 1;
              graph.addEdge(from, to, w);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'hasVertex':
        return {
          type: { static: { kind: 'function', parameters: [graphType.nodeType], returnType: { kind: 'boolean' } }, refinements: [] },
          value: {
            fn: (vertex: RuntimeTypedBinder) => {
              return { type: { static: { kind: 'boolean' }, refinements: [] }, value: graph.hasVertex(vertex) };
            }
          }
        };
      case 'getVertices':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: graphType.nodeType } }, refinements: [] },
          value: {
            fn: () => {
              const vertices = graph.getVertices();
              const arr = new SchemaArray<RuntimeTypedBinder>();
              vertices.forEach(v => arr.push(v));
              return { type: { static: { kind: 'array', elementType: graphType.nodeType }, refinements: [] }, value: arr };
            }
          }
        };
      case 'getEdges':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: { kind: 'tuple', elementTypes: [graphType.nodeType, graphType.nodeType, { kind: 'float' }] } } }, refinements: [] },
          value: {
            fn: () => {
              const edges = graph.getEdges();
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
      case 'getNeighbors':
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
      case 'size':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
          value: { fn: () => ({ type: { static: { kind: 'int' }, refinements: [] }, value: graph.getVertices().length }) }
        };
      case 'isDirected':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'boolean' } }, refinements: [] },
          value: { fn: () => ({ type: { static: { kind: 'boolean' }, refinements: [] }, value: graph.isDirected() }) }
        };
      default:
        throw new Error(`Property "${propertyName}" does not exist on Graph`);
    }
  }

  private evaluateBinaryTreeMember(object: RuntimeTypedBinder, propertyName: string): RuntimeTypedBinder {
    const tree = object.value as BinaryTree<RuntimeTypedBinder>;
    const treeType = object.type.static as { kind: 'binarytree' | 'avltree'; elementType: Type };

    switch (propertyName) {
      case 'insert':
        return {
          type: { static: { kind: 'function', parameters: [treeType.elementType], returnType: { kind: 'void' } }, refinements: [] },
          value: {
            fn: (value: RuntimeTypedBinder) => {
              tree.insert(value);
              return { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
            }
          }
        };
      case 'search':
        return {
          type: { static: { kind: 'function', parameters: [treeType.elementType], returnType: { kind: 'boolean' } }, refinements: [] },
          value: {
            fn: (value: RuntimeTypedBinder) => {
              const result = tree.search(value);
              return { type: { static: { kind: 'boolean' }, refinements: [] }, value: result };
            }
          }
        };
      case 'getHeight':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'int' } }, refinements: [] },
          value: {
            fn: () => {
              const height = tree.getHeight();
              return { type: { static: { kind: 'int' }, refinements: [] }, value: height };
            }
          }
        };
      case 'preOrderTraversal':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: treeType.elementType } }, refinements: [] },
          value: {
            fn: () => {
              const values = tree.preOrderTraversal();
              return { type: { static: { kind: 'array', elementType: treeType.elementType }, refinements: [] }, value: new SchemaArray(values) };
            }
          }
        };
      case 'inOrderTraversal':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: treeType.elementType } }, refinements: [] },
          value: {
            fn: () => {
              const values = tree.inOrderTraversal();
              return { type: { static: { kind: 'array', elementType: treeType.elementType }, refinements: [] }, value: new SchemaArray(values) };
            }
          }
        };
      case 'postOrderTraversal':
        return {
          type: { static: { kind: 'function', parameters: [], returnType: { kind: 'array', elementType: treeType.elementType } }, refinements: [] },
          value: {
            fn: () => {
              const values = tree.postOrderTraversal();
              return { type: { static: { kind: 'array', elementType: treeType.elementType }, refinements: [] }, value: new SchemaArray(values) };
            }
          }
        };
      default:
        throw new Error(`Property "${propertyName}" does not exist on BinaryTree/AVLTree`);
    }
  }

  private evaluateIndex(object: RuntimeTypedBinder, index: RuntimeTypedBinder): RuntimeTypedBinder {
    if (object.type.static.kind === 'array') {
      if (index.type.static.kind === 'int') {
        const val = (object.value as SchemaArray<RuntimeTypedBinder>).get(index.value as number);
        return val || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
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
      const key = index;
      const val = (object.value as SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>).get(key);
      return val || { type: { static: { kind: 'void' }, refinements: [] }, value: undefined };
    }

    if (object.type.static.kind === 'tuple') {
      if (index.type.static.kind === 'int') {
        const idx = index.value as number;
        const tupleValue = object.value as RuntimeTypedBinder[];
        if (idx >= 0 && idx < tupleValue.length) {
          return tupleValue[idx];
        }
        throw new Error(`Tuple index ${idx} out of bounds`);
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

  private applyBinaryOp(op: string, left: RuntimeTypedBinder, right: RuntimeTypedBinder, _line: number, _column: number): RuntimeTypedBinder {
    const leftType = getActualRuntimeType(left);
    const rightType = getActualRuntimeType(right);

    switch (op) {
      case '+':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) + (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
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
        if ((leftType === 'int' || leftType === 'float') && (rightType === 'int' || rightType === 'float')) {
          return { value: (left.value as number) - (right.value as number), type: { static: { kind: 'float' }, refinements: [] } };
        }
        throw new Error(`Cannot subtract ${rightType} from ${leftType}`);

      case '*':
        if (leftType === 'int' && rightType === 'int') {
          return { value: (left.value as number) * (right.value as number), type: { static: { kind: 'int' }, refinements: [] } };
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
        if ((leftType === 'int' || leftType === 'float' || leftType === 'intersection') &&
          (rightType === 'int' || rightType === 'float' || rightType === 'intersection')) {
          return { value: (left.value as number) < (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} < ${rightType}`);

      case '<=':
        if ((leftType === 'int' || leftType === 'float' || leftType === 'intersection') &&
          (rightType === 'int' || rightType === 'float' || rightType === 'intersection')) {
          return { value: (left.value as number) <= (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} <= ${rightType}`);

      case '>':
        if ((leftType === 'int' || leftType === 'float' || leftType === 'intersection') &&
          (rightType === 'int' || rightType === 'float' || rightType === 'intersection')) {
          return { value: (left.value as number) > (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} > ${rightType}`);

      case '>=':
        if ((leftType === 'int' || leftType === 'float' || leftType === 'intersection') &&
          (rightType === 'int' || rightType === 'float' || rightType === 'intersection')) {
          return { value: (left.value as number) >= (right.value as number), type: { static: { kind: 'boolean' }, refinements: [] } };
        }
        throw new Error(`Cannot compare ${leftType} >= ${rightType}`);

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

  private getIterator(iterable: RuntimeTypedBinder): IterableIterator<RuntimeTypedBinder> {
    // Check static type first, then check actual value type for weak/poly types
    const staticKind = iterable.type.static.kind;
    const isArray = staticKind === 'array' || iterable.value instanceof SchemaArray;
    const isSet = staticKind === 'set' || iterable.value instanceof SchemaSet;
    const isRange = staticKind === 'range' || iterable.value instanceof LazyRange;

    if (isArray) {
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
    if (isSet) {
      const set = iterable.value as SchemaSet<any>;
      const values: RuntimeTypedBinder[] = [];
      set.forEach(v => values.push(keyToRuntimeTypeBinder(v)));
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
    if (isRange) {
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

  private evaluateFunctionDeclaration(stmt: FunctionDeclaration): void {
    const paramTypes = stmt.parameters.map(p => resolveTypeAnnotation(p.typeAnnotation));
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
  }
}
