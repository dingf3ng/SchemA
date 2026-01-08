import { Program, Statement, Expression, CallExpression, BlockStatement, WhileStatement, UntilStatement, ForStatement, IfStatement } from '../transpiler/ast-types';
import { Interpreter } from './interpreter';
import { RuntimeTypedBinder } from './runtime-utils';
import { Environment } from './environment';

/**
 * Stepper extends the regular interpreter with step-by-step execution capabilities.
 * This is useful for debugging and educational purposes.
 */

export interface CallFrame {
  functionName: string;
  statements: Statement[];
  statementIndex: number;
  savedEnv: Environment;
  callSite: { line: number; column: number };
  initialLoopStackLength: number;
  initialBranchStackLength: number;
  // For handling return values when stepping out of a function
  pendingCall?: {
    originalStatement: Statement;
    callExpr: CallExpression;
    evaluatedArgs: RuntimeTypedBinder[];
    pendingArgIndex: number;
  };
}

export interface LoopFrame {
  loopStatement: WhileStatement | UntilStatement | ForStatement;
  bodyStatements: Statement[];
  bodyIndex: number;
  iterationCount: number;
}

export interface BranchFrame {
  ifStatement: IfStatement;
  branchStatements: Statement[];
  branchIndex: number;
  isElseBranch: boolean;
}

export interface StepState {
  statementIndex: number;
  statement: Statement | null;
  environment: Map<string, RuntimeTypedBinder>;
  output: string[];
  finished: boolean;
  line: number;
  column: number;
  callStack: Array<{ functionName: string; line: number; column: number }>;
}

export class Stepper {
  private program: Program | null = null;
  private currentStatementIndex: number = 0;
  private interpreter: Interpreter;
  private finished: boolean = false;
  private callStack: CallFrame[] = [];
  private loopStack: LoopFrame[] = [];
  private branchStack: BranchFrame[] = [];
  // Track pending nested calls: when we have max(fib(3), fib(5)), we need to step into fib(3) first
  private pendingCalls: Array<{
    originalStatement: Statement;
    workingStatement: Statement; // Cloned and progressively rewritten AST
    workingCallExpr?: CallExpression; // Not really needed if we use findDeepest on workingStatement
    evaluatedArgs: RuntimeTypedBinder[]; // Still needed for main call stepInto?? No, we rewrite main call too.
    pendingArgIndex: number; // Maybe deprecated logic?
    steppedIntoCurrentArg: boolean; // Just tracking if we are waiting for return
    callStackLengthAtCreation: number; 
    lastReturnValue?: RuntimeTypedBinder; // Returned value from last step-in
  }> = [];

  constructor(interpreter: Interpreter = new Interpreter()) {
    this.interpreter = interpreter;
  }

  /**
   * Initialize with a program
   */
  public initialize(program: Program): void {
    this.program = program;
    this.currentStatementIndex = 0;
    this.finished = false;
    this.callStack = [];
    this.loopStack = [];
    this.branchStack = [];
    this.pendingCalls = [];
  }

  /**
   * Execute the next statement
   */
  public step(): StepState {
    if (!this.program) {
      throw new Error('Program not initialized. Call initialize() first.');
    }

    try {
      // If we have pending calls (nested function call arguments being evaluated)
      if (this.pendingCalls.length > 0) {
        return this.stepPendingCall();
      }

      // Determine priorities based on nesting
      // If we are in a function, we only care about loops/branches created *within* that function
      const topFrame = this.callStack.length > 0 ? this.callStack[this.callStack.length - 1] : null;
      
      const effectiveLoopStackSize = topFrame 
        ? this.loopStack.length - topFrame.initialLoopStackLength 
        : this.loopStack.length;
        
      const effectiveBranchStackSize = topFrame 
        ? this.branchStack.length - topFrame.initialBranchStackLength 
        : this.branchStack.length;

      // If we're inside a loop (within the current context), step through the loop body
      if (effectiveLoopStackSize > 0) {
        return this.stepInLoop();
      }

      // If we're inside a branch (within the current context), step through the branch body
      if (effectiveBranchStackSize > 0) {
        return this.stepInBranch();
      }

      // If we're inside a function, step through the function's statements
      if (topFrame) {
        return this.stepInFunction();
      }

      // Otherwise, step through the program's top-level statements
      if (this.finished || this.currentStatementIndex >= this.program.body.length) {
        this.finished = true;
        return this.getCurrentState();
      }

      const statement = this.program.body[this.currentStatementIndex];

      // Check if this is a loop statement
      if (this.isLoopStatement(statement)) {
        return this.enterLoop(statement);
      }

      // Check if this is an if statement
      if (statement.type === 'IfStatement') {
        return this.enterBranch(statement);
      }

      // Check if this statement contains function calls that we should step into
      const result = this.tryStepIntoNestedCalls(statement);
      if (result) {
        return this.getCurrentState();
      }

      // Execute the statement normally
      try {
        this.interpreter.evaluateStatement(statement);
        this.currentStatementIndex++;
      } catch (error) {
        this.finished = true;
        throw error;
      }

      return this.getCurrentState();
    } catch (error: any) {
      if (error?.constructor?.name === 'ReturnException') {
        return this.handleReturnException(error);
      }
      throw error;
    }
  }

  /**
   * Handle ReturnException that propagated from a nested call
   */
  private handleReturnException(error: any): StepState {
    if (this.callStack.length === 0) {
      this.finished = true;
      throw error;
    }

    const topFrame = this.callStack.pop()!;
    this.interpreter.setEnvironment(topFrame.savedEnv);

    // Clean up stacks - revert to state before this function was called
    if (topFrame.initialLoopStackLength !== undefined) {
      this.loopStack.length = topFrame.initialLoopStackLength;
    }
    if (topFrame.initialBranchStackLength !== undefined) {
      this.branchStack.length = topFrame.initialBranchStackLength;
    }
    
    // Capture return value for pending calls
    if (this.pendingCalls.length > 0) {
         const pending = this.pendingCalls[this.pendingCalls.length - 1];
         // We assume the return corresponds to the function we just stepped out of
         // which matches the pending call's expectation
         pending.lastReturnValue = error.value;
         pending.steppedIntoCurrentArg = true; // Mark as returned
         
         // We do NOT advance context here, because we want to resume stepPendingCall logic
         return this.getCurrentState();
    }

    // Advance the execution of the caller
    // We prioritize inner stacks (loop > branch > call stack > top level)
    // But ONLY if we are not in the middle of evaluating pending calls
    if (this.pendingCalls.length === 0) {
      if (this.loopStack.length > 0) {
        this.loopStack[this.loopStack.length - 1].bodyIndex++;
      } else if (this.branchStack.length > 0) {
        this.branchStack[this.branchStack.length - 1].branchIndex++;
      } else if (this.callStack.length > 0) {
        this.callStack[this.callStack.length - 1].statementIndex++;
      } else {
        this.currentStatementIndex++;
      }
    }

    return this.getCurrentState();
  }

  /**
   * Step through statements inside a function
   */
  private stepInFunction(): StepState {
    const topFrame = this.callStack[this.callStack.length - 1];


    // Check if we've finished executing all statements in this function
    if (topFrame.statementIndex >= topFrame.statements.length) {
      // Pop the call frame and return to the caller
      this.callStack.pop();
      this.interpreter.setEnvironment(topFrame.savedEnv);

      // If we're back at the top level, move to the next statement
      if (this.callStack.length === 0 && this.branchStack.length === 0 && this.loopStack.length === 0) {
        this.currentStatementIndex++;
      } else if (this.callStack.length > 0) {
        // We returned into another function, advance that function's statement
        this.callStack[this.callStack.length - 1].statementIndex++;
      } else if (this.branchStack.length > 0) {
        // We returned into a branch
        this.branchStack[this.branchStack.length - 1].branchIndex++;
      } else if (this.loopStack.length > 0) {
        // We returned into a loop
        this.loopStack[this.loopStack.length - 1].bodyIndex++;
      }

      return this.getCurrentState();
    }

    const statement = topFrame.statements[topFrame.statementIndex];

    // Check if we are already inside this loop (processing it)
    if (this.loopStack.length > 0 && this.loopStack[this.loopStack.length - 1].loopStatement === statement) {
      return this.stepInLoop();
    }

    // Check if we are already inside this branch (processing it)
    if (this.branchStack.length > 0) {
        const topBranch = this.branchStack[this.branchStack.length - 1];
        if (topBranch.ifStatement === statement) {
             return this.stepInBranch();
        } else {
             // Debug why mismatch
        }
    }

    // Check if this is a loop statement
    if (this.isLoopStatement(statement)) {
      return this.enterLoop(statement);
    }

    // Check if this is an if statement
    if (statement.type === 'IfStatement') {
      return this.enterBranch(statement);
    }

    // Check if this statement contains function calls that we should step into
    const result = this.tryStepIntoNestedCalls(statement);
    if (result) {
      return this.getCurrentState();
    }

    // Execute the statement
    try {
      this.interpreter.evaluateStatement(statement);
      topFrame.statementIndex++;
    } catch (error: any) {
      // If it's a ReturnException, let the main step() loop handle it via handleReturnException
      // This ensures proper stack unwinding and capturing outcomes for pendingCalls
      if (error?.constructor?.name === 'ReturnException') {
        throw error;
      }

      // Handle other runtime errors
      this.finished = true;
      throw error;
    }

    return this.getCurrentState();
  }

  /**
   * Enter an if-else branch and set up the branch frame
   */
  private enterBranch(statement: IfStatement): StepState {
    // Evaluate the condition
    const condition = this.interpreter.evaluateExpressionPublic(statement.condition);
    const takeThenBranch = condition.value as boolean;

    let branchStatements: Statement[];
    let branchStatement: Statement;

    if (takeThenBranch) {
      branchStatement = statement.thenBranch;
    } else if (statement.elseBranch) {
      branchStatement = statement.elseBranch;

      // Special case: if the else branch is itself an if statement (else-if chain),
      // recursively enter that branch instead of creating a frame for the intermediate if
      if (branchStatement.type === 'IfStatement') {
        // Recursively evaluate the else-if
        // Note: We don't advance context here because the outer if statement
        // hasn't been "completed" yet - we're still evaluating its else-if chain
        return this.enterBranch(branchStatement);
      }
    } else {
      // No else branch and condition is false, skip this statement
      this.advanceCurrentContext();
      return this.getCurrentState();
    }

    // Extract statements from the branch
    if (branchStatement.type === 'BlockStatement') {
      branchStatements = branchStatement.statements;
    } else {
      branchStatements = [branchStatement];
    }

    // DEBUG
    if (process.env.DEBUG_STEPPER) {
      console.log(`enterBranch: ifStmt line=${statement.line}, branchType=${branchStatement.type}, numStatements=${branchStatements.length}`);
    }

    // Push branch frame
    this.branchStack.push({
      ifStatement: statement,
      branchStatements,
      branchIndex: 0,
      isElseBranch: !takeThenBranch,
    });

    return this.getCurrentState();
  }

  /**
   * Step through statements inside a branch (if-else)
   */
  private stepInBranch(): StepState {
    const topBranch = this.branchStack[this.branchStack.length - 1];

    // DEBUG
    if (process.env.DEBUG_STEPPER) {
      console.log(`stepInBranch START: branchIndex=${topBranch.branchIndex}/${topBranch.branchStatements.length}`);
    }

    // Check if we've finished executing all statements in this branch
    if (topBranch.branchIndex >= topBranch.branchStatements.length) {
      // Pop the branch frame
      this.branchStack.pop();

      // DEBUG
      if (process.env.DEBUG_STEPPER) {
        console.log(`stepInBranch: branch complete, popping`);
      }

      // Advance the parent context
      this.advanceCurrentContext();

      return this.getCurrentState();
    }

    const statement = topBranch.branchStatements[topBranch.branchIndex];


    // Check if we are already inside a loop (processing it)
    if (this.loopStack.length > 0 && this.loopStack[this.loopStack.length - 1].loopStatement === statement) {
      return this.stepInLoop();
    }

    // Check if this is a nested if statement
    // Note: else-if chains are handled in enterBranch by recursively calling enterBranch
    // so we should only see actual nested if statements here (like if inside if)
    if (statement.type === 'IfStatement') {
      return this.enterBranch(statement);
    }

    // Check if this is a loop statement
    if (this.isLoopStatement(statement)) {
      return this.enterLoop(statement);
    }

    // Check if this statement contains function calls that we should step into
    const result = this.tryStepIntoNestedCalls(statement);
    if (result) {
      return this.getCurrentState();
    }

    // Execute the statement
    try {
      this.interpreter.evaluateStatement(statement);
      topBranch.branchIndex++;
    } catch (error: any) {
      if (error?.constructor?.name === 'ReturnException') {
        throw error;
      }

      // Handle errors in branch
      this.branchStack.pop();
      this.advanceCurrentContext();

      this.finished = true;
      throw error;
    }

    return this.getCurrentState();
  }

  /**
   * Handle stepping when there are pending nested calls
   *
   * This uses a CPS-like transformation (rewriting the AST) to serialize nested calls.
   * e.g. print(fib(3)) -> fib(3) executes -> returns V -> print(V) executes
   */
  private stepPendingCall(): StepState {
    const pending = this.pendingCalls[this.pendingCalls.length - 1];
    
    // If we're deeper in the call stack than when this pending call was created,
    // that means we're still inside a nested function. Let it execute first.
    if (this.callStack.length > pending.callStackLengthAtCreation) {
      return this.stepInFunction();
    }

    // If we just returned from a user function call
    if (pending.steppedIntoCurrentArg) {
      // 1. Get the return value
      const val = pending.lastReturnValue;
      const tempName = `$step_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // 2. Define a temporary variable in the environment to hold the value
      // This handles complex objects that AST Literals might not support
      const binder = val ? val : { value: null, type: { static: { kind: 'void' } } } as any;
      this.interpreter.getEnvironment().define(tempName, binder);

      // 3. Find the call we just executed in the working statement
      // Since we rewrite the tree, the "deepest" user call should be the one we just ran
      const callToReplace = this.findDeepestUserDefinedCall(pending.workingStatement);
      
      if (callToReplace) {
        // 4. Replace the call with an Identifier referencing the temp variable
        const replaced = this.replaceNodeInTree(pending.workingStatement, callToReplace, {
          type: 'Identifier',
          name: tempName,
          line: callToReplace.line,
          column: callToReplace.column,
          // Add minimal type info if needed by AST types, though runtime doesn't check often
        });
      }

      // Reset state for next iteration
      pending.steppedIntoCurrentArg = false;
      pending.lastReturnValue = undefined;
    }

    // Check if there are more nested calls to process
    const nextCall = this.findDeepestUserDefinedCall(pending.workingStatement);
    if (nextCall) {
      pending.steppedIntoCurrentArg = true;
      this.stepIntoUserFunction(nextCall);
      return this.getCurrentState();
    }

    // No more nested user calls in this statement - execute the fully resolved statement
    this.pendingCalls.pop();

    try {
      this.interpreter.evaluateStatement(pending.workingStatement);
    } catch (error: any) {
      if (error?.constructor?.name !== 'ReturnException') {
        this.finished = true;
        throw error;
      }
      throw error;
    }

    // Advance the context
    this.advanceCurrentContext();
    return this.getCurrentState();
  }

  private clone<T>(node: T): T {
    return JSON.parse(JSON.stringify(node));
  }

  private replaceNodeInTree(root: any, target: any, replacement: any): boolean {
    if (root === target) return false;
    
    // Safety check for null/undefined
    if (!root || typeof root !== 'object') return false;

    for (const key in root) {
      if (Object.prototype.hasOwnProperty.call(root, key)) {
        const val = root[key];
        
        if (val === target) {
          root[key] = replacement;
          return true;
        }
        
        if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            if (val[i] === target) {
              val[i] = replacement;
              return true;
            }
            if (typeof val[i] === 'object' && val[i] !== null) {
              if (this.replaceNodeInTree(val[i], target, replacement)) return true;
            }
          }
        } else if (typeof val === 'object' && val !== null) {
          if (this.replaceNodeInTree(val, target, replacement)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Find the deepest user-defined function call in an expression or statement
   */
  private findDeepestUserDefinedCall(root: Expression | Statement): CallExpression | null {
    if ((root as any).type === 'ExpressionStatement') {
       return this.findDeepestUserDefinedCall((root as any).expression);
    }
    if ((root as any).type === 'VariableDeclaration') {
       // declarations array
       for (const decl of (root as any).declarations) {
         if (decl.initializer) {
           const found = this.findDeepestUserDefinedCall(decl.initializer);
           if (found) return found;
         }
       }
       return null;
    }
    if ((root as any).type === 'AssignmentStatement') {
       return this.findDeepestUserDefinedCall((root as any).value);
    }
    if ((root as any).type === 'ReturnStatement') {
       if ((root as any).value) {
          return this.findDeepestUserDefinedCall((root as any).value);
       }
       return null;
    }
    if ((root as any).type === 'IfStatement') {
       // IfStatements should be handled by enterBranch/stepInBranch, not as nested calls
       // Only check the condition for user-defined calls, not the branches
       return this.findDeepestUserDefinedCall((root as any).condition);
    }
    if ((root as any).type === 'BlockStatement') {
       // BlockStatements should not be treated as containing calls themselves
       // The stepper will iterate through their statements
       return null;
    }
    // Only handle simple statements where calls can appear as part of execution
    // Block, loops etc should have been handled by stepper entering them.

    const expr = root as Expression;
    if (expr.type === 'CallExpression') {
      const callExpr = expr as CallExpression;

      // Check arguments for deeper user-defined calls first
      for (const arg of callExpr.arguments) {
        const deeper = this.findDeepestUserDefinedCall(arg);
        if (deeper) {
          return deeper;
        }
      }

      // No deeper user calls, check if this one is user-defined
      if (this.isUserDefinedFunction(callExpr)) {
        return callExpr;
      }
      return null;
    }

    if (expr.type === 'BinaryExpression') {
      const leftDeep = this.findDeepestUserDefinedCall((expr as any).left);
      if (leftDeep) return leftDeep;
      return this.findDeepestUserDefinedCall((expr as any).right);
    }

    if (expr.type === 'UnaryExpression') {
      return this.findDeepestUserDefinedCall((expr as any).operand);
    }
    
    // Array literals, Object literals, Index expressions etc.
    if (expr.type === 'ArrayLiteral') {
        for (const el of (expr as any).elements) {
            const deep = this.findDeepestUserDefinedCall(el);
            if (deep) return deep;
        }
    }
    
    // Fallback for other expressions
    return null;
  }

  /**
   * Advance the current execution context (move to next statement)
   */
  private advanceCurrentContext(): void {
    const topFrame = this.callStack.length > 0 ? this.callStack[this.callStack.length - 1] : null;
    
    const effectiveLoopStackSize = topFrame 
      ? this.loopStack.length - topFrame.initialLoopStackLength 
      : this.loopStack.length;
      
    const effectiveBranchStackSize = topFrame 
      ? this.branchStack.length - topFrame.initialBranchStackLength 
      : this.branchStack.length;

    if (effectiveLoopStackSize > 0) {
      this.loopStack[this.loopStack.length - 1].bodyIndex++;
    } else if (effectiveBranchStackSize > 0) {
      this.branchStack[this.branchStack.length - 1].branchIndex++;
    } else if (topFrame) {
      topFrame.statementIndex++;
    } else {
      this.currentStatementIndex++;
    }
  }

  /**
   * Try to step into nested function calls within a statement
   * Returns true if we stepped into a call
   */
  private tryStepIntoNestedCalls(statement: Statement): boolean {
    // Find all call expressions in this statement (outermost first)
    const allCalls = this.findAllCallExpressions(statement);

    if (allCalls.length === 0) {
      return false;
    }

    // Check if any call is user-defined
    // We check all calls because even if outer is not user-defined, argument might be
    const hasUserCalls = allCalls.some(call => {
       // Check if call itself is user defined
       if (this.isUserDefinedFunction(call)) return true;
       // Check args ?? No, findAllCallExpressions is recursive, so it found all args too.
       return false;
    });

    if (!hasUserCalls) return false;

    // Clone the statement to create a working copy where we can replace calls with values
    const workingStatement = this.clone(statement);
    
    // Find the deepest user-defined call in the working statement
    const nestedCall = this.findDeepestUserDefinedCall(workingStatement);

    if (nestedCall) {
        this.pendingCalls.push({
            originalStatement: statement,
            workingStatement,
            evaluatedArgs: [], // Deprecated
            pendingArgIndex: 0, // Deprecated
            steppedIntoCurrentArg: true, // We are about to step in
            callStackLengthAtCreation: this.callStack.length,
            // isExecutingMainCall deprecated
        });

        this.stepIntoUserFunction(nestedCall);
        return true;
    }

    return false;
  }

  /**
   * Find all call expressions in a statement (at any nesting level)
   */
  private findAllCallExpressions(statement: Statement): CallExpression[] {
    const calls: CallExpression[] = [];

    const findInExpr = (expr: Expression): void => {
      if (expr.type === 'CallExpression') {
        calls.push(expr);
        // Also search in arguments
        for (const arg of expr.arguments) {
          findInExpr(arg);
        }
        // And in callee (for chained calls)
        findInExpr(expr.callee);
      } else if (expr.type === 'BinaryExpression') {
        findInExpr(expr.left);
        findInExpr(expr.right);
      } else if (expr.type === 'UnaryExpression') {
        findInExpr(expr.operand);
      } else if (expr.type === 'MemberExpression') {
        findInExpr(expr.object);
      } else if (expr.type === 'IndexExpression') {
        findInExpr(expr.object);
        findInExpr(expr.index);
      } else if (expr.type === 'ArrayLiteral') {
        for (const elem of expr.elements) {
          findInExpr(elem);
        }
      }
    };

    if (statement.type === 'ExpressionStatement') {
      findInExpr(statement.expression);
    } else if (statement.type === 'VariableDeclaration') {
      for (const decl of statement.declarations) {
        if (decl.initializer) {
          findInExpr(decl.initializer);
        }
      }
    } else if (statement.type === 'AssignmentStatement') {
      findInExpr(statement.value);
    } else if (statement.type === 'ReturnStatement' && statement.value) {
      findInExpr(statement.value);
    }

    return calls;
  }

  /**
   * Check if a call expression is a call to a user-defined function
   */
  private isUserDefinedFunction(callExpr: CallExpression): boolean {
    try {
      const callee = this.interpreter.evaluateExpressionPublic(callExpr.callee);
      return this.isUserFunctionValue(callee);
    } catch {
      return false;
    }
  }

  /**
   * Check if a runtime value is a user-defined function
   */
  private isUserFunctionValue(callee: RuntimeTypedBinder): boolean {
    if (callee.type.static.kind !== 'function') {
      return false;
    }
    const calleeValue = callee.value as any;
    // Built-in functions have 'fn' property
    if ('fn' in calleeValue) {
      return false;
    }
    // User-defined functions have 'parameters', 'body', 'closure'
    return 'parameters' in calleeValue && 'body' in calleeValue && 'closure' in calleeValue;
  }

  /**
   * Step into a user-defined function
   */
  private stepIntoUserFunction(callExpr: CallExpression): boolean {
    try {
      const callee = this.interpreter.evaluateExpressionPublic(callExpr.callee);

      if (!this.isUserFunctionValue(callee)) {
        return false;
      }

      const calleeValue = callee.value as any;
      const args = callExpr.arguments.map((arg: Expression) =>
        this.interpreter.evaluateExpressionPublic(arg)
      );

      return this.pushFunctionFrame(callExpr, calleeValue, args);
    } catch {
      return false;
    }
  }

  /**
   * Step into a user-defined function with pre-evaluated arguments
   */
  private stepIntoUserFunctionWithArgs(callExpr: CallExpression, args: RuntimeTypedBinder[]): boolean {
    try {
      const callee = this.interpreter.evaluateExpressionPublic(callExpr.callee);

      if (!this.isUserFunctionValue(callee)) {
        return false;
      }

      const calleeValue = callee.value as any;
      return this.pushFunctionFrame(callExpr, calleeValue, args);
    } catch {
      return false;
    }
  }

  /**
   * Push a new function call frame onto the call stack
   */
  private pushFunctionFrame(callExpr: CallExpression, calleeValue: any, args: RuntimeTypedBinder[]): boolean {
    const savedEnv = this.interpreter.getEnvironment();
    const closureEnv = new Environment(calleeValue.closure as Environment);

    // Bind parameters to arguments
    for (let i = 0; i < calleeValue.parameters.length; i++) {
      closureEnv.define(calleeValue.parameters[i].name, args[i]);
    }

    this.interpreter.setEnvironment(closureEnv);

    // Get function name if the callee is an identifier
    const functionName = callExpr.callee.type === 'Identifier'
      ? (callExpr.callee as any).name
      : '<anonymous>';

    // Push a new call frame
    this.callStack.push({
      functionName,
      statements: calleeValue.body.statements,
      statementIndex: 0,
      savedEnv,
      callSite: { line: callExpr.line, column: callExpr.column },
      initialLoopStackLength: this.loopStack.length,
      initialBranchStackLength: this.branchStack.length,
    });

    return true;
  }

  /**
   * Check if a statement is a loop statement
   */
  private isLoopStatement(statement: Statement): boolean {
    return statement.type === 'WhileStatement' ||
           statement.type === 'UntilStatement' ||
           statement.type === 'ForStatement';
  }

  /**
   * Enter a loop and set up the loop frame
   */
  private enterLoop(statement: Statement): StepState {

    if (statement.type !== 'WhileStatement' &&
        statement.type !== 'UntilStatement' &&
        statement.type !== 'ForStatement') {
      throw new Error('Internal Error: enterLoop called with non-loop statement');
    }

    // Check the loop condition/setup
    if (statement.type === 'WhileStatement') {
      const condition = this.interpreter.evaluateExpressionPublic(statement.condition);
      if (!condition.value) {
        // Condition is false, skip the loop
        this.advanceCurrentContext();
        return this.getCurrentState();
      }
    } else if (statement.type === 'UntilStatement') {
      const condition = this.interpreter.evaluateExpressionPublic(statement.condition);
      if (condition.value) {
        // Condition is true (until), skip the loop
        this.advanceCurrentContext();
        return this.getCurrentState();
      }
    } else if (statement.type === 'ForStatement') {
      // Evaluate the iterable
      const iterable = this.interpreter.evaluateExpressionPublic(statement.iterable);

      if (iterable.type.static.kind === 'range') {
        // Store the range in a special way for iteration
        // We'll handle this in stepInLoop
      } else if (iterable.type.static.kind === 'array') {
        // Arrays can be iterated
      } else {
        // Unknown iterable type, execute normally
        this.interpreter.evaluateStatement(statement);
        this.advanceCurrentContext();
        return this.getCurrentState();
      }
    }

    // Extract body statements
    let bodyStatements: Statement[];
    if (statement.body.type === 'BlockStatement') {
      bodyStatements = statement.body.statements;
    } else {
      bodyStatements = [statement.body];
    }

    // Push loop frame
    this.loopStack.push({
      loopStatement: statement,
      bodyStatements,
      bodyIndex: 0,
      iterationCount: 0,
    });

    return this.getCurrentState();
  }

  /**
   * Step through statements inside a loop
   */
  private stepInLoop(): StepState {
    const topLoop = this.loopStack[this.loopStack.length - 1];

    // Check if we've finished executing all statements in this iteration
    if (topLoop.bodyIndex >= topLoop.bodyStatements.length) {
      // Finished one iteration, check if we should continue
      topLoop.iterationCount++;
      topLoop.bodyIndex = 0;

      // Re-evaluate the loop condition
      const loopStmt = topLoop.loopStatement;
      let shouldContinue = false;

      if (loopStmt.type === 'WhileStatement') {
        const condition = this.interpreter.evaluateExpressionPublic(loopStmt.condition);
        shouldContinue = condition.value as boolean;
      } else if (loopStmt.type === 'UntilStatement') {
        const condition = this.interpreter.evaluateExpressionPublic(loopStmt.condition);
        shouldContinue = !condition.value;
      } else if (loopStmt.type === 'ForStatement') {
        // For loops: check if there are more elements to iterate
        // This is simplified - full implementation would track iterator state
        // For now, we'll execute the for loop body and let the interpreter handle it
        shouldContinue = false; // Simplified: exit after exploring body once
      }

      if (!shouldContinue) {
        // Exit the loop
        this.loopStack.pop();

        // Move to next statement in parent context
        this.advanceCurrentContext();

        return this.getCurrentState();
      }

      // Continue with next iteration
      return this.getCurrentState();
    }

    const statement = topLoop.bodyStatements[topLoop.bodyIndex];

    // Check if we are already inside this statement's branch (processing it)
    if (this.branchStack.length > 0) {
      const topBranch = this.branchStack[this.branchStack.length - 1];
      if (topBranch.ifStatement === statement) {
        return this.stepInBranch();
      }
    }

    // Check if this is a nested loop
    if (this.isLoopStatement(statement)) {
      return this.enterLoop(statement);
    }

    // Check if this is an if statement
    if (statement.type === 'IfStatement') {
      return this.enterBranch(statement);
    }

    // Check if this statement contains function calls that we should step into
    const result = this.tryStepIntoNestedCalls(statement);
    if (result) {
      return this.getCurrentState();
    }

    // Execute the statement
    try {
      this.interpreter.evaluateStatement(statement);
      topLoop.bodyIndex++;
    } catch (error: any) {
      if (error?.constructor?.name === 'ReturnException') {
        throw error;
      }

      // Handle errors in loop
      this.loopStack.pop();
      this.advanceCurrentContext();

      this.finished = true;
      throw error;
    }

    return this.getCurrentState();
  }

  /**
   * Get the current state without executing
   */
  public getCurrentState(): StepState {
    if (!this.program) {
      return {
        statementIndex: 0,
        statement: null,
        environment: new Map(),
        output: [],
        finished: false,
        line: 0,
        column: 0,
        callStack: [],
      };
    }

    // Determine current statement based on context (pending calls, loop, branch, function, or top-level)
    let statement: Statement | null = null;
    let line: number = 0;
    let column: number = 0;

    if (this.pendingCalls.length > 0) {
      // We're evaluating arguments for a pending call
      // But we check if we've successfully stepped into a nested function first
      const pending = this.pendingCalls[this.pendingCalls.length - 1];
      const isExecutingNested = this.callStack.length > pending.callStackLengthAtCreation;

      if (!isExecutingNested) {
        statement = pending.originalStatement;
        // Use original statement line/col as we don't track exact call location easily anymore
        line = statement?.line || 0;
        column = statement?.column || 0;
      } else {
        // Fall through to normal stack processing below
        // This allows executing the nested function body visibly
      }
    } 
    
    // Check main stacks - prioritize deepest/most local context
    // We only care about loops/branches created *within* the current function context
    const topFrame = this.callStack.length > 0 ? this.callStack[this.callStack.length - 1] : null;
    const effectiveLoopStackSize = topFrame ? this.loopStack.length - topFrame.initialLoopStackLength : this.loopStack.length;
    const effectiveBranchStackSize = topFrame ? this.branchStack.length - topFrame.initialBranchStackLength : this.branchStack.length;

    // Use a flag to avoid re-entering logic if we already handled pending call above
    const handledByPending = this.pendingCalls.length > 0 && !(this.pendingCalls[this.pendingCalls.length - 1].callStackLengthAtCreation < this.callStack.length);

    if (!handledByPending) {
        // Priority: branch > loop > function > top-level
        // Branches are most deeply nested, so check them first
        if (effectiveBranchStackSize > 0) {
        // We're inside a branch (if-else)
        const topBranch = this.branchStack[this.branchStack.length - 1];
        statement = topBranch.branchIndex < topBranch.branchStatements.length
            ? topBranch.branchStatements[topBranch.branchIndex]
            : topBranch.ifStatement;
        line = statement?.line || 0;
        column = statement?.column || 0;
        } else if (effectiveLoopStackSize > 0) {
        // We're inside a loop (but not in a branch within the loop)
        const topLoop = this.loopStack[this.loopStack.length - 1];
        statement = topLoop.bodyIndex < topLoop.bodyStatements.length
            ? topLoop.bodyStatements[topLoop.bodyIndex]
            : topLoop.loopStatement;
        line = statement?.line || 0;
        column = statement?.column || 0;
        } else if (this.callStack.length > 0) {
        // We're inside a function call
        const topFrame = this.callStack[this.callStack.length - 1];
        statement = topFrame.statementIndex < topFrame.statements.length
            ? topFrame.statements[topFrame.statementIndex]
            : null;
        line = statement?.line || topFrame.callSite.line;
        column = statement?.column || topFrame.callSite.column;
        } else {
        // We're at the top level
        statement = this.currentStatementIndex < this.program.body.length
            ? this.program.body[this.currentStatementIndex]
            : null;
        line = statement?.line || 0;
        column = statement?.column || 0;
        }
    }

    const isFinished = this.finished || (
      this.callStack.length === 0 &&
      this.loopStack.length === 0 &&
      this.branchStack.length === 0 &&
      this.pendingCalls.length === 0 &&
      this.currentStatementIndex >= this.program.body.length
    );

    return {
      statementIndex: this.currentStatementIndex,
      statement: statement,
      environment: this.serializeEnvironment(),
      output: this.interpreter.getOutput(),
      finished: isFinished,
      line: line,
      column: column,
      callStack: this.callStack.map(frame => ({
        functionName: frame.functionName,
        line: frame.callSite.line,
        column: frame.callSite.column,
      })),
    };
  }

  /**
   * Execute all remaining statements
   */
  public continue(): StepState {
    while (!this.getCurrentState().finished) {
      this.step();
    }
    return this.getCurrentState();
  }

  /**
   * Reset the interpreter to the beginning
   */
  public reset(): void {
    this.interpreter = new Interpreter();
    this.currentStatementIndex = 0;
    this.finished = false;
    this.callStack = [];
    this.loopStack = [];
    this.branchStack = [];
    this.pendingCalls = [];
  }

  /**
   * Serialize environment for display
   */
  private serializeEnvironment(): Map<string, any> {
    const env = this.interpreter.getEnvironment();
    const allBindings = env.getAllBindings();
    const serialized: Map<string, any> = new Map();

    for (const [name, binder] of allBindings.entries()) {
      serialized.set(name, this.serializeValue(binder));
    }

    return serialized;
  }

  /**
   * Serialize a runtime value for display
   */
  private serializeValue(binder: RuntimeTypedBinder): any {
    const value = binder.value;

    if (value === null || value === undefined) {
      return value;
    }

    // Handle built-in functions
    if (typeof value === 'object' && 'fn' in value) {
      return '<function>';
    }

    // Handle function declarations
    if (typeof value === 'object' && 'body' in value && 'parameters' in value) {
      return '<function>';
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item: any) =>
        typeof item === 'object' && 'value' in item ? this.serializeValue(item) : item
      );
    }

    // Handle data structures
    if (value.constructor && value.constructor.name !== 'Object') {
      return `<${value.constructor.name}>`;
    }

    // Handle plain objects
    try {
      const serialized: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'object' && val !== null && 'value' in val) {
          serialized[key] = this.serializeValue(val as RuntimeTypedBinder);
        } else {
          serialized[key] = val;
        }
      }
      return serialized;
    } catch {
      return '<complex object>';
    }
  }

  /**
   * Get the total number of statements
   */
  public getTotalStatements(): number {
    return this.program?.body.length || 0;
  }

  /**
   * Check if execution is finished
   */
  public isFinished(): boolean {
    return this.getCurrentState().finished;
  }
}
