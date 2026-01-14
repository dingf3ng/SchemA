import { Program, Statement } from '../transpiler/ast-types';
import { Machine } from './machine';
import { RuntimeTypedBinder } from './runtime-utils';
import { Environment } from './environment';
import { MachineState } from './machine-utils';

/**
 * Stepper provides step-by-step execution capabilities using the abstract machine.
 * This is useful for debugging and educational purposes.
 * 
 * The stepper is now a thin wrapper around the Machine, which is naturally stepwise.
 */

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
  private machine: Machine;
  private program: Program | null = null;
  private stepCount: number = 0;

  constructor() {
    this.machine = new Machine();
  }

  /**
   * Initialize with a program
   */
  public initialize(program: Program): void {
    this.program = program;
    this.stepCount = 0;
    this.machine = new Machine();
    this.machine.initialize(program);
  }

  /**
   * Execute the next step
   */
  public step(): StepState {
    if (!this.program) {
      throw new Error('Program not initialized. Call initialize() first.');
    }

    if (!this.machine.isFinished()) {
      this.machine.step();
      this.stepCount++;
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

    const machineState = this.machine.getState();
    
    return {
      statementIndex: this.getStatementIndex(machineState),
      statement: this.getCurrentStatement(machineState),
      environment: this.serializeEnvironment(machineState.environment),
      output: machineState.output,
      finished: machineState.finished,
      line: machineState.line,
      column: machineState.column,
      callStack: this.extractCallStack(machineState),
    };
  }

  /**
   * Execute all remaining statements
   */
  public continue(): StepState {
    if (!this.program) {
      throw new Error('Program not initialized. Call initialize() first.');
    }

    while (!this.machine.isFinished()) {
      this.machine.step();
      this.stepCount++;
    }

    return this.getCurrentState();
  }

  /**
   * Reset the stepper to the beginning
   */
  public reset(): void {
    if (this.program) {
      this.initialize(this.program);
    } else {
      this.machine = new Machine();
      this.stepCount = 0;
    }
  }

  /**
   * Check if execution is finished
   */
  public isFinished(): boolean {
    return this.machine.isFinished();
  }

  /**
   * Get the total number of statements in the program
   */
  public getTotalStatements(): number {
    return this.program?.body.length || 0;
  }

  /**
   * Extract the current statement index from machine state
   */
  private getStatementIndex(state: MachineState): number {
    // Find the stmt-seq continuation to determine statement index
    for (const cont of state.kontinuation) {
      if (cont.kind === 'stmt-seq') {
        return cont.index;
      }
    }
    // If no stmt-seq, we're either at the first statement or finished
    if (state.finished) {
      return this.program?.body.length || 0;
    }
    return 0;
  }

  /**
   * Get the current statement being executed
   */
  private getCurrentStatement(state: MachineState): Statement | null {
    if (state.focus.kind === 'stmt') {
      return state.focus.stmt;
    }
    
    // If focus is on an expression or value, try to find the enclosing statement
    // from the kontinuation stack
    for (const cont of [...state.kontinuation].reverse()) {
      if (cont.kind === 'stmt-seq' && cont.index > 0) {
        // The current statement is the one before the index
        return cont.statements[cont.index - 1] || null;
      }
    }

    // If we're evaluating an expression, look for the statement context
    if (state.focus.kind === 'expr' || state.focus.kind === 'value') {
      // Check for statement-related continuations
      for (const cont of [...state.kontinuation].reverse()) {
        if (cont.kind === 'stmt-seq' && cont.statements.length > 0) {
          const idx = Math.max(0, cont.index - 1);
          return cont.statements[idx] || null;
        }
      }
    }

    // Default: return the first statement if available
    if (this.program && this.program.body.length > 0) {
      return this.program.body[0];
    }

    return null;
  }

  /**
   * Extract call stack information from machine state
   */
  private extractCallStack(state: MachineState): Array<{ functionName: string; line: number; column: number }> {
    const callStack: Array<{ functionName: string; line: number; column: number }> = [];
    
    // Look for call-apply continuations in the stack
    for (const cont of state.kontinuation) {
      if (cont.kind === 'call-apply') {
        // Try to get function name from callee
        const callee = cont.callee;
        let functionName = '<anonymous>';
        
        if (callee.value && typeof callee.value === 'object') {
          const calleeValue = callee.value as any;
          if (calleeValue.name) {
            functionName = calleeValue.name;
          }
        }
        
        callStack.push({
          functionName,
          line: 0, // Line info not readily available in continuation
          column: 0,
        });
      }
    }
    
    return callStack;
  }

  /**
   * Serialize environment for display
   */
  private serializeEnvironment(env: Environment): Map<string, RuntimeTypedBinder> {
    const allBindings = env.getAllBindings();
    const serialized: Map<string, RuntimeTypedBinder> = new Map();

    for (const [name, binder] of allBindings.entries()) {
      // Skip internal/temporary variables
      if (name.startsWith('$')) {
        continue;
      }
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
      return binder;
    }

    // Handle built-in functions
    if (typeof value === 'object' && 'fn' in value) {
      return { ...binder, value: '<function>' };
    }

    // Handle function declarations
    if (typeof value === 'object' && 'body' in value && 'parameters' in value) {
      return { ...binder, value: '<function>' };
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return binder;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return {
        ...binder,
        value: value.map((item: any) =>
          typeof item === 'object' && 'value' in item ? this.serializeValue(item) : item
        )
      };
    }

    // Handle data structures
    if (value.constructor && value.constructor.name !== 'Object') {
      return { ...binder, value: `<${value.constructor.name}>` };
    }

    // Return as-is for other objects
    return binder;
  }
}
