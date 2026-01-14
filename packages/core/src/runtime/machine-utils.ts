import {
  Expression,
  Statement,
  TypeAnnotation,
  InvariantStatement,
  AssertStatement
} from "../transpiler/ast-types";
import { Environment } from "./environment";
import { RuntimeTypedBinder } from "./runtime-utils";

/**
 * Base interface for all continuations
 */
export interface BaseContinuation {
  kind: string;
}

/**
 * Halt continuation - evaluation is complete
 */
export interface HaltCont extends BaseContinuation {
  kind: 'halt';
}

/**
 * Statement sequence continuation - after evaluating current statement, continue with rest
 */
export interface StmtSeqCont extends BaseContinuation {
  kind: 'stmt-seq';
  statements: Statement[];
  index: number;
  savedEnv: Environment;  // Environment to restore after block
  restoreEnv: boolean;    // Whether to restore environment after
}

/**
 * Variable declaration continuation - bind the evaluated value to variable
 */
export interface VarDeclCont extends BaseContinuation {
  kind: 'var-decl';
  name: string;
  typeAnnotation: TypeAnnotation;
  remainingDeclarators: Array<{ name: string; typeAnnotation: TypeAnnotation; initializer: Expression }>;
}

/**
 * Assignment continuation - assign the evaluated value to target
 */
export interface AssignCont extends BaseContinuation {
  kind: 'assign';
  target: Expression;
}

/**
 * Assignment to index - we have the object, now need the index
 */
export interface AssignIndexCont extends BaseContinuation {
  kind: 'assign-index';
  object: RuntimeTypedBinder;
  indexExpr: Expression;
}

/**
 * Assignment to index final - we have object and index, now assign value
 */
export interface AssignIndexFinalCont extends BaseContinuation {
  kind: 'assign-index-final';
  object: RuntimeTypedBinder;
  index: RuntimeTypedBinder;
}

/**
 * If condition continuation - evaluate then/else branch based on condition result
 */
export interface IfCondCont extends BaseContinuation {
  kind: 'if-cond';
  thenBranch: Statement;
  elseBranch?: Statement;
}

/**
 * While continuation - check condition and potentially loop
 */
export interface WhileCont extends BaseContinuation {
  kind: 'while';
  condition: Expression;
  body: Statement;
  iteration?: number;
  invariants?: InvariantStatement[];
}

/**
 * While condition continuation - evaluate body if condition is true
 */
export interface WhileCondCont extends BaseContinuation {
  kind: 'while-cond';
  condition: Expression;
  body: Statement;
  iteration?: number;
  invariants?: InvariantStatement[];
}

/**
 * Until continuation - check condition and potentially loop
 */
export interface UntilCont extends BaseContinuation {
  kind: 'until';
  condition: Expression;
  body: Statement;
  iteration?: number;
  invariants?: InvariantStatement[];
}

/**
 * Until condition continuation - evaluate body if condition is false
 */
export interface UntilCondCont extends BaseContinuation {
  kind: 'until-cond';
  condition: Expression;
  body: Statement;
  iteration?: number;
  invariants?: InvariantStatement[];
}

/**
 * For loop initialization continuation - receives the iterable
 */
export interface ForInitCont extends BaseContinuation {
  kind: 'for-init';
  variable: string;
  body: Statement;
  savedEnv: Environment;
  invariants?: InvariantStatement[];
}

/**
 * For loop next continuation - continues iteration after body execution
 */
export interface ForNextCont extends BaseContinuation {
  kind: 'for-next';
  variable: string;
  iterator: IterableIterator<RuntimeTypedBinder>;
  body: Statement;
  savedEnv: Environment;
  iteration: number;
  invariants: InvariantStatement[];
}

/**
 * Return continuation - throw return exception with the value
 */
export interface ReturnCont extends BaseContinuation {
  kind: 'return';
}

/**
 * Binary operator left continuation - evaluate right operand next
 */
export interface BinOpLeftCont extends BaseContinuation {
  kind: 'binop-left';
  operator: string;
  right: Expression;
  line: number;
  column: number;
}

/**
 * Binary operator right continuation - apply operator to both values
 */
export interface BinOpRightCont extends BaseContinuation {
  kind: 'binop-right';
  operator: string;
  left: RuntimeTypedBinder;
  line: number;
  column: number;
}

/**
 * Short-circuit AND continuation
 */
export interface AndCont extends BaseContinuation {
  kind: 'and';
  right: Expression;
}

/**
 * Short-circuit OR continuation
 */
export interface OrCont extends BaseContinuation {
  kind: 'or';
  right: Expression;
}

/**
 * Unary operator continuation
 */
export interface UnaryOpCont extends BaseContinuation {
  kind: 'unary';
  operator: string;
}

/**
 * Call expression - evaluate callee first
 */
export interface CallCalleeCont extends BaseContinuation {
  kind: 'call-callee';
  args: Expression[];
}

/**
 * Call expression - evaluate arguments
 */
export interface CallArgsCont extends BaseContinuation {
  kind: 'call-args';
  callee: RuntimeTypedBinder;
  evaluatedArgs: RuntimeTypedBinder[];
  remainingArgs: Expression[];
}

/**
 * Call expression - apply function to arguments
 */
export interface CallApplyCont extends BaseContinuation {
  kind: 'call-apply';
  callee: RuntimeTypedBinder;
  args: RuntimeTypedBinder[];
  savedEnv: Environment;
}

/**
 * Member expression continuation
 */
export interface MemberCont extends BaseContinuation {
  kind: 'member';
  property: string;
}

/**
 * Index expression - evaluate object first
 */
export interface IndexObjCont extends BaseContinuation {
  kind: 'index-obj';
  index: Expression;
}

/**
 * Index expression - evaluate index
 */
export interface IndexIdxCont extends BaseContinuation {
  kind: 'index-idx';
  object: RuntimeTypedBinder;
}

/**
 * Array literal continuation
 */
export interface ArrayLitCont extends BaseContinuation {
  kind: 'array-lit';
  evaluatedElements: RuntimeTypedBinder[];
  remainingElements: Expression[];
}

/**
 * Set literal continuation
 */
export interface SetLitCont extends BaseContinuation {
  kind: 'set-lit';
  evaluatedElements: RuntimeTypedBinder[];
  remainingElements: Expression[];
}

/**
 * Tuple literal continuation
 */
export interface TupleLitCont extends BaseContinuation {
  kind: 'tuple-lit';
  evaluatedElements: RuntimeTypedBinder[];
  remainingElements: Expression[];
}

/**
 * Record literal continuation - evaluating values
 */
export interface RecordLitCont extends BaseContinuation {
  kind: 'record-lit';
  evaluatedEntries: Array<{ key: string; value: RuntimeTypedBinder }>;
  remainingEntries: Array<{ key: string; value: Expression }>;
}

/**
 * Map literal continuation - evaluating key first
 */
export interface MapLitKeyCont extends BaseContinuation {
  kind: 'map-lit-key';
  evaluatedEntries: Array<{ key: RuntimeTypedBinder; value: RuntimeTypedBinder }>;
  remainingEntries: Array<{ key: Expression; value: Expression }>;
  currentValue: Expression;
}

/**
 * Map literal continuation - evaluating value after key
 */
export interface MapLitValueCont extends BaseContinuation {
  kind: 'map-lit-value';
  evaluatedEntries: Array<{ key: RuntimeTypedBinder; value: RuntimeTypedBinder }>;
  remainingEntries: Array<{ key: Expression; value: Expression }>;
  currentKey: RuntimeTypedBinder;
}

/**
 * Range expression continuation - evaluate start
 */
export interface RangeStartCont extends BaseContinuation {
  kind: 'range-start';
  end?: Expression;
  inclusive: boolean;
}

/**
 * Range expression continuation - evaluate end
 */
export interface RangeEndCont extends BaseContinuation {
  kind: 'range-end';
  start: RuntimeTypedBinder | undefined;
  inclusive: boolean;
}

/**
 * Expression statement continuation - discard the result
 */
export interface ExprStmtCont extends BaseContinuation {
  kind: 'expr-stmt';
}

/**
 * Invariant check continuation - check the evaluated condition
 */
export interface InvariantCheckCont extends BaseContinuation {
  kind: 'invariant-check';
  stmt: InvariantStatement;
  savedEnv: Environment;
}

/**
 * Assert check continuation - check the evaluated condition
 */
export interface AssertCheckCont extends BaseContinuation {
  kind: 'assert-check';
  stmt: AssertStatement;
  savedEnv: Environment;
}

/**
 * Predicate check continuation - evaluate subject, then check predicate
 */
export interface PredicateCheckCont extends BaseContinuation {
  kind: 'predicate-check';
  predicateName: string;
  predicateArgs?: RuntimeTypedBinder[];
  subjectExpr: Expression;
}

/**
 * Predicate arguments continuation - evaluate predicate arguments before subject
 */
export interface PredicateArgsCont extends BaseContinuation {
  kind: 'predicate-args';
  predicateName: string;
  subject: Expression;
  evaluatedArgs: RuntimeTypedBinder[];
  remainingArgs: Expression[];
}

export type Continuation =
  | HaltCont
  | StmtSeqCont
  | VarDeclCont
  | AssignCont
  | AssignIndexCont
  | AssignIndexFinalCont
  | IfCondCont
  | WhileCont
  | WhileCondCont
  | UntilCont
  | UntilCondCont
  | ForInitCont
  | ForNextCont
  | ReturnCont
  | BinOpLeftCont
  | BinOpRightCont
  | AndCont
  | OrCont
  | UnaryOpCont
  | CallCalleeCont
  | CallArgsCont
  | CallApplyCont
  | MemberCont
  | IndexObjCont
  | IndexIdxCont
  | ArrayLitCont
  | SetLitCont
  | TupleLitCont
  | RecordLitCont
  | MapLitKeyCont
  | MapLitValueCont
  | RangeStartCont
  | RangeEndCont
  | ExprStmtCont
  | InvariantCheckCont
  | AssertCheckCont
  | PredicateCheckCont
  | PredicateArgsCont;

// ============================================================================
// Machine State
// ============================================================================

/**
 * The focus can be either an expression, a statement, or a value (when applying continuations)
 */
export type Focus =
  | { kind: 'expr'; expr: Expression }
  | { kind: 'stmt'; stmt: Statement }
  | { kind: 'value'; value: RuntimeTypedBinder }
  | { kind: 'done' };

// ReturnException is now exported from evaluator.ts
// Re-export it here for backwards compatibility
export { ReturnException } from './evaluator';

/**
 * Machine state snapshot for stepping
 */
export interface MachineState {
  focus: Focus;
  environment: Environment;
  kontinuation: Continuation[];
  output: string[];
  finished: boolean;
  line: number;
  column: number;
}
