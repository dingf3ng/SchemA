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
  LazyRange,
} from '../builtins/data-structures';
import { Environment } from './environment';
import {
  checkLoopInvariants,
  extractInvariants,
  generateStringRange,
  getActualRuntimeType,
  hasDynamicTypes,
  isTruthy,
  keyToRuntimeTypedBinder,
  resolveTypeAnnotation,
  runtimeTypedBinderToKey,
  RuntimeTypedBinder,
  runtimeTypedBinderToString,
  Sole,
} from './runtime-utils';
import { Continuation, Focus, MachineState } from './machine-utils';
import { InvariantTracker } from '../analyzer/synthesizer';
import { initializeBuiltins } from './init-builtins';
import { Analyzer } from '../analyzer/analyzer';
import { Evaluator, EvaluatorContext, ReturnException } from './evaluator';


// ============================================================================
// Machine Implementation
// ============================================================================

export class Machine implements EvaluatorContext {
  private focus: Focus = { kind: 'done' };
  private currentEnv: Environment;
  private globalEnv: Environment;
  private analyzer: Analyzer = new Analyzer();
  private kontinuation: Continuation[] = [];
  private output: string[] = [];
  private trackerStack: InvariantTracker[] = [];
  private evaluator: Evaluator;

  constructor() {
    this.globalEnv = new Environment();
    this.currentEnv = initializeBuiltins(this.globalEnv, this.output);
    this.evaluator = new Evaluator(this);
  }

  // EvaluatorContext implementation
  getCurrentEnv(): Environment {
    return this.currentEnv;
  }

  setCurrentEnv(env: Environment): void {
    this.currentEnv = env;
  }

  getTrackerStack(): InvariantTracker[] {
    return this.trackerStack;
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
            value: { value: new SchemaArray([]), type: { static: { kind: 'array', elementType: { kind: 'weak' } }, refinements: [] } }
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
        this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
          const value: RuntimeTypedBinder = { value: new Sole(), type: { static: declaredType, refinements: [] } };
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
            this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
        const invariants = extractInvariants(stmt.body);
        this.kontinuation.push({
          kind: 'while-cond',
          condition: stmt.condition,
          body: stmt.body,
          iteration: 0,
          invariants
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      case 'UntilStatement': {
        const invariants = extractInvariants(stmt.body);
        this.kontinuation.push({
          kind: 'until-cond',
          condition: stmt.condition,
          body: stmt.body,
          iteration: 0,
          invariants
        });
        this.focus = { kind: 'expr', expr: stmt.condition };
        break;
      }

      case 'ForStatement': {
        // First evaluate the iterable
        const invariants = extractInvariants(stmt.body);
        this.kontinuation.push({
          kind: 'for-init',
          variable: stmt.variable,
          body: stmt.body,
          savedEnv: this.currentEnv,
          invariants
        });
        this.focus = { kind: 'expr', expr: stmt.iterable };
        break;
      }

      case 'ReturnStatement': {
        if (stmt.value) {
          this.kontinuation.push({ kind: 'return' });
          this.focus = { kind: 'expr', expr: stmt.value };
        } else {
          throw new ReturnException({ value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } });
        }
        break;
      }

      case 'BlockStatement': {
        const savedEnv = this.currentEnv;
        this.currentEnv = new Environment(savedEnv);

        if (stmt.statements.length === 0) {
          this.currentEnv = savedEnv;
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
            if (!hasDynamicTypes(declaredType)) {
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
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
        const idxActualType = getActualRuntimeType(idx);

        if ((obj.type.static.kind === 'array' || obj.value instanceof SchemaArray) &&
            (idx.type.static.kind === 'int' || idxActualType === 'int')) {
          (obj.value as SchemaArray<RuntimeTypedBinder>).set(idx.value as number, valueToAssign);
        } else if (obj.type.static.kind === 'map' || obj.value instanceof SchemaMap) {
          const key = runtimeTypedBinderToKey(idx);
          (obj.value as SchemaMap<any, RuntimeTypedBinder>).set(key, valueToAssign);
        } else {
          throw new Error('Invalid assignment target');
        }
        this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'while-cond': {
        if (value.type.static.kind !== 'boolean') {
          throw new Error('While condition must be boolean');
        }
        if (value.value as boolean) {
          const iteration = kont.iteration || 0;
          const invariants = kont.invariants || [];

          // Push tracker on first iteration
          if (iteration === 0 && invariants.length > 0) {
            const tracker = new InvariantTracker();
            this.trackerStack.push(tracker);
          }

          // Check invariants before iteration (using Evaluator)
          if (invariants.length > 0) {
            checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          }

          // Push continuation for next iteration check
          this.kontinuation.push({
            kind: 'while',
            condition: kont.condition,
            body: kont.body,
            iteration,
            invariants
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          // Loop is done, pop tracker if we have invariants
          if (kont.invariants && kont.invariants.length > 0) {
            this.trackerStack.pop();
          }
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'while': {
        const iteration = kont.iteration || 0;
        const invariants = kont.invariants || [];

        // Check invariants after body (using Evaluator)
        if (invariants.length > 0) {
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
        }

        // Record state for invariant synthesis
        if (this.trackerStack.length > 0) {
          const tracker = this.trackerStack[this.trackerStack.length - 1];
          tracker.recordState(this.currentEnv, iteration);
        }

        // After body, check condition again
        this.kontinuation.push({
          kind: 'while-cond',
          condition: kont.condition,
          body: kont.body,
          iteration: iteration + 1,
          invariants
        });
        this.focus = { kind: 'expr', expr: kont.condition };
        break;
      }

      case 'until-cond': {
        if (value.type.static.kind !== 'boolean') {
          throw new Error('Until condition must be boolean');
        }
        if (!(value.value as boolean)) {
          const iteration = kont.iteration || 0;
          const invariants = kont.invariants || [];

          // Push tracker on first iteration
          if (iteration === 0 && invariants.length > 0) {
            const tracker = new InvariantTracker();
            this.trackerStack.push(tracker);
          }

          // Check invariants before iteration (using Evaluator)
          if (invariants.length > 0) {
            checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          }

          // Push continuation for next iteration check
          this.kontinuation.push({
            kind: 'until',
            condition: kont.condition,
            body: kont.body,
            iteration,
            invariants
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          // Loop is done, pop tracker if we have invariants
          if (kont.invariants && kont.invariants.length > 0) {
            this.trackerStack.pop();
          }
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'until': {
        const iteration = kont.iteration || 0;
        const invariants = kont.invariants || [];

        // Check invariants after body (using Evaluator)
        if (invariants.length > 0) {
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
        }

        // Record state for invariant synthesis
        if (this.trackerStack.length > 0) {
          const tracker = this.trackerStack[this.trackerStack.length - 1];
          tracker.recordState(this.currentEnv, iteration);
        }

        // After body, check condition again
        this.kontinuation.push({
          kind: 'until-cond',
          condition: kont.condition,
          body: kont.body,
          iteration: iteration + 1,
          invariants
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

          // Push tracker for this loop
          const tracker = new InvariantTracker();
          this.trackerStack.push(tracker);

          // Check invariants before first iteration (using Evaluator)
          const invariants = kont.invariants || [];
          if (invariants.length > 0) {
            checkLoopInvariants(invariants, 0, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          }

          // Push continuation for next iteration
          this.kontinuation.push({
            kind: 'for-next',
            variable: kont.variable,
            iterator,
            body: kont.body,
            savedEnv: kont.savedEnv,
            iteration: 0,
            invariants
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
        }
        break;
      }

      case 'for-next': {
        // Check invariants after iteration (using Evaluator)
        if (kont.invariants.length > 0) {
          checkLoopInvariants(kont.invariants, kont.iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
        }

        // Record state for invariant synthesis
        const tracker = this.trackerStack[this.trackerStack.length - 1];
        if (tracker) {
          tracker.recordState(this.currentEnv, kont.iteration);
        }

        // Value is body result (void), continue iteration
        const iterator = kont.iterator;
        const next = iterator.next();

        if (!next.done) {
          this.currentEnv = new Environment(kont.savedEnv);
          if (kont.variable !== '_') {
            this.currentEnv.define(kont.variable, next.value);
          }

          const nextIteration = kont.iteration + 1;

          // Check invariants before iteration (using Evaluator)
          if (kont.invariants.length > 0) {
            checkLoopInvariants(kont.invariants, nextIteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          }

          // Push continuation for next iteration
          this.kontinuation.push({
            kind: 'for-next',
            variable: kont.variable,
            iterator,
            body: kont.body,
            savedEnv: kont.savedEnv,
            iteration: nextIteration,
            invariants: kont.invariants
          });
          this.focus = { kind: 'stmt', stmt: kont.body };
        } else {
          // Loop is done, pop tracker
          this.trackerStack.pop();

          // Restore environment
          this.currentEnv = kont.savedEnv;
          this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
        const result = this.evaluator.applyBinaryOp(kont.operator, kont.left, value, kont.line, kont.column);
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
          const { typeToString } = require('../type-checker/type-checker-utils');
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
        const result = this.evaluator.evaluateMember(value, kont.property);
        this.focus = { kind: 'value', value: result };
        break;
      }

      case 'index-obj': {
        this.kontinuation.push({ kind: 'index-idx', object: value });
        this.focus = { kind: 'expr', expr: kont.index };
        break;
      }

      case 'index-idx': {
        const result = this.evaluator.evaluateIndex(kont.object, value);
        this.focus = { kind: 'value', value: result };
        break;
      }

      case 'array-lit': {
        const evaluated = [...kont.evaluatedElements, value];
        if (kont.remainingElements.length === 0) {
          const elementType = evaluated.length > 0 ? evaluated[0].type.static : { kind: 'weak' as const };
          this.focus = {
            kind: 'value',
            value: {
              value: new SchemaArray(evaluated),
              type: { static: { kind: 'array', elementType: elementType }, refinements: [] }
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
        this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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

        this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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

        this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
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
        const { parsePredicateName } = require('../analyzer/analyzer-utils');

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

      // Check invariants before exiting loops on early return (using Evaluator)
      if (kont.kind === 'for-next') {
        if (kont.invariants.length > 0) {
          checkLoopInvariants(kont.invariants, kont.iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
        }
        // Pop tracker when exiting loop
        if (this.trackerStack.length > 0) {
          this.trackerStack.pop();
        }
      } else if (kont.kind === 'while' || kont.kind === 'until') {
        const invariants = kont.invariants || [];
        const iteration = kont.iteration || 0;
        if (invariants.length > 0) {
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          // Pop tracker when exiting loop
          if (this.trackerStack.length > 0) {
            this.trackerStack.pop();
          }
        }
      }

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

      const valueStr = runtimeTypedBinderToString(binding);
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
        this.focus = { kind: 'value', value: { value: new Sole(), type: { static: { kind: 'void' }, refinements: [] } } };
      }

      // Return null to indicate focus was already set
      return null;
    }

    throw new Error('Not a function');
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
          return { value: undefined, done: true };
        }
      };
    }
    if (isSet) {
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
          return { value: undefined, done: true };
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
          return { value: undefined, done: true };
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
