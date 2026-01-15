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
  environment: Record<string, SerializedVariable>;
  output: string[];
  finished: boolean;
  line: number;
  column: number;
  callStack: Array<{ functionName: string; line: number; column: number }>;
}

export interface SerializedVariable {
  name: string;
  value: unknown;
  type: string;
  isInternal: boolean;
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
        environment: {},
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
   * Returns a plain object (not Map) for JSON serialization compatibility with postMessage
   */
  private serializeEnvironment(env: Environment): Record<string, SerializedVariable> {
    const allBindings = env.getAllBindings();
    const serialized: Record<string, SerializedVariable> = {};

    for (const [name, binder] of allBindings.entries()) {
      // Mark internal/temporary variables (starting with $) but still include them
      const isInternal = name.startsWith('$');
      serialized[name] = this.serializeValue(name, binder, isInternal);
    }

    return serialized;
  }

  /**
   * Convert RuntimeType to a string representation
   */
  private typeToString(runtimeType: { static: { kind: string } }): string {
    if (!runtimeType || !runtimeType.static) return 'unknown';
    return runtimeType.static.kind;
  }

  /**
   * Serialize a runtime value for display
   */
  private serializeValue(name: string, binder: RuntimeTypedBinder, isInternal: boolean): SerializedVariable {
    const value = binder.value;
    const type = this.typeToString(binder.type);

    // Handle null/undefined
    if (value === null || value === undefined) {
      return { name, value, type, isInternal };
    }

    // Handle built-in functions
    if (typeof value === 'object' && 'fn' in value) {
      return { name, value: '<builtin function>', type: 'function', isInternal };
    }

    // Handle function declarations (user-defined functions)
    if (typeof value === 'object' && 'body' in value && 'parameters' in value) {
      const funcValue = value as { parameters?: Array<{ name: string }> };
      const params = funcValue.parameters || [];
      const paramNames = params.map(p => p.name).join(', ');
      // The variable name IS the function name for user-defined functions
      return { name, value: `<function(${paramNames})>`, type: 'function', isInternal };
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return { name, value, type, isInternal };
    }

    // Handle arrays - serialize array contents
    if (Array.isArray(value)) {
      const serializedArray = value.map((item: unknown, idx: number) => {
        if (typeof item === 'object' && item !== null && 'value' in item) {
          const itemBinder = item as RuntimeTypedBinder;
          return this.serializeValue(`${name}[${idx}]`, itemBinder, isInternal).value;
        }
        return item;
      });
      return { name, value: serializedArray, type: 'array', isInternal };
    }

    // Handle data structures (MinHeap, MaxHeap, Graph, etc.)
    if (value.constructor && value.constructor.name !== 'Object') {
      const className = value.constructor.name;
      // Try to get size/length info if available
      const sizeInfo = this.getStructureInfo(value);
      return { name, value: `<${className}${sizeInfo}>`, type: className, isInternal };
    }

    // Handle plain objects - serialize recursively
    if (typeof value === 'object') {
      try {
        // Attempt to create a serializable representation
        const serialized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          if (typeof val === 'object' && val !== null && 'value' in val) {
            serialized[key] = this.serializeValue(key, val as RuntimeTypedBinder, isInternal).value;
          } else {
            serialized[key] = val;
          }
        }
        return { name, value: serialized, type: 'object', isInternal };
      } catch {
        return { name, value: '<object>', type: 'object', isInternal };
      }
    }

    return { name, value: String(value), type: 'unknown', isInternal };
  }

  /**
   * Get size/length info for data structures
   */
  private getStructureInfo(value: unknown): string {
    if (value === null || typeof value !== 'object') return '';

    const obj = value as Record<string, unknown>;

    // Check for common size properties
    if ('size' in obj && typeof obj.size === 'number') {
      return ` size=${obj.size}`;
    }
    if ('length' in obj && typeof obj.length === 'number') {
      return ` length=${obj.length}`;
    }
    if ('count' in obj && typeof obj.count === 'number') {
      return ` count=${obj.count}`;
    }

    return '';
  }
}
