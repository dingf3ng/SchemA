import {
  Statement,
  Expression,
  InvariantStatement,
  AssertStatement,
} from './types';
import { RuntimeTypedBinder, RuntimeTypedBinderToString } from './runtime/values';
import { Environment } from './runtime/environment';

/**
 * Analyzer class for checking @invariant and @assert statements
 * Sits on top of the interpreter and performs runtime verification
 */
export class Analyzer {
  // Track loop iteration count for better error messages
  private loopIterationCount: number = 0;

  /**
   * Check an @assert statement
   * Asserts are one-time checks that should pass or throw an error
   */
  checkAssert(
    stmt: AssertStatement,
    evaluateExpression: (expr: Expression) => RuntimeTypedBinder,
    environment: Environment
  ): void {
    const conditionResult = evaluateExpression(stmt.condition);

    if (typeof conditionResult.value !== 'boolean') {
      throw new Error(
        `@assert condition must evaluate to a boolean, got ${typeof conditionResult.value}. At ${stmt.line}, ${stmt.column}`
      );
    }

    if (!conditionResult.value) {
      let message = 'Assertion failed';

      if (stmt.message) {
        const messageResult = evaluateExpression(stmt.message);
        if (typeof messageResult.value === 'string') {
          message = messageResult.value;
        }
      }

      // Include current state in error message
      const state = this.captureEnvironmentState(environment);
      throw new Error(`${message}\nCurrent state:\n${state}`);
    }
  }

  /**
   * Check an @invariant statement
   * Invariants are continuous checks that must hold throughout execution
   */
  checkInvariant(
    stmt: InvariantStatement,
    evaluateExpression: (expr: Expression) => RuntimeTypedBinder,
    environment: Environment,
    context: 'loop' | 'function',
    iterationInfo?: { iteration: number }
  ): void {
    const conditionResult = evaluateExpression(stmt.condition);

    if (typeof conditionResult.value !== 'boolean') {
      throw new Error(
        `@invariant condition must evaluate to a boolean, got ${typeof conditionResult.value}. At ${stmt.line}, ${stmt.column}`
      );
    }

    if (!conditionResult.value) {
      let message = 'Invariant violated';

      if (stmt.message) {
        const messageResult = evaluateExpression(stmt.message);
        if (typeof messageResult.value === 'string') {
          message = messageResult.value;
        }
      }

      // Add iteration info for loop invariants
      if (context === 'loop' && iterationInfo) {
        message += ` (at iteration ${iterationInfo.iteration})`;
      }

      // Include current state in error message
      const state = this.captureEnvironmentState(environment);
      throw new Error(`${message}\nCurrent state:\n${state}`);
    }
  }

  /**
   * Capture the current environment state for error reporting
   */
  private captureEnvironmentState(env: Environment): string {
    const bindings: string[] = [];

    // Get all variable bindings from the environment
    const envBindings = this.getEnvironmentBindings(env);

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

  /**
   * Get all bindings from environment (including parent scopes)
   */
  private getEnvironmentBindings(env: Environment): Map<string, RuntimeTypedBinder> {
    const bindings = new Map<string, RuntimeTypedBinder>();

    // Walk up the environment chain
    let currentEnv: Environment | null = env;
    while (currentEnv) {
      const envBindings = (currentEnv as any).bindings;
      if (envBindings instanceof Map) {
        for (const [name, binding] of envBindings.entries()) {
          if (!bindings.has(name)) {
            bindings.set(name, binding);
          }
        }
      }
      currentEnv = (currentEnv as any).parent || null;
    }

    return bindings;
  }
}
