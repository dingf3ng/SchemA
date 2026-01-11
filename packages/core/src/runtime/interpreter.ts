import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  VariableDeclaration,
  AssignmentStatement,
  IfStatement,
  WhileStatement,
  UntilStatement,
  ForStatement,
  ReturnStatement,
  BlockStatement,
  InvariantStatement,
  AssertStatement,
} from '../transpiler/ast-types';
import {
  SchemaArray,
  SchemaMap,
  SchemaSet,
  LazyRange,
} from '../builtins/data-structures';
import {
  hasDynamicTypes,
  resolveTypeAnnotation,
  runtimeTypedBinderToKey,
  RuntimeTypedBinder,
  checkLoopInvariants,
  extractInvariants,
  Sole
} from './runtime-utils';
import { Analyzer } from '../analyzer/analyzer';
import { InvariantTracker } from '../analyzer/synthesizer';
import { Environment } from './environment';
import { initializeBuiltins } from './init-builtins';
import { Evaluator, EvaluatorContext, ReturnException } from './evaluator';

export class Interpreter implements EvaluatorContext {
  private globalEnv: Environment = new Environment();
  private currentEnv: Environment;
  private output: string[] = [];
  private analyzer: Analyzer = new Analyzer();
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
   * Get the current environment (for testing/debugging)
   */
  public getEnvironment(): Environment {
    return this.currentEnv;
  }

  /**
   * Set the current environment (for stepper)
   */
  public setEnvironment(env: Environment): void {
    this.currentEnv = env;
  }

  /**
   * Get the global environment (for testing/debugging)
   */
  public getGlobalEnvironment(): Environment {
    return this.globalEnv;
  }

  /**
   *
   */
  public getEnvironmentStack(): Environment[] {
    const envs: Environment[] = [];
    let env: Environment | null = this.currentEnv;
    while (env) {
      envs.push(env);
      env = env['parent'];
    }
    return envs;
  }

  /**
   * Public wrapper for evaluateExpression (for stepper)
   */
  public evaluateExpressionPublic(expr: Expression): RuntimeTypedBinder {
    return this.evaluator.evaluateExpression(expr);
  }

  public evaluate(program: Program): string[] {
    this.output.length = 0;
    for (const statement of program.body) {
      this.evaluateStatement(statement);
    }
    return this.output;
  }

  public getOutput(): string[] {
    return this.output;
  }

  public evaluateStatement(stmt: Statement): void {
    try {
      switch (stmt.type) {
        case 'FunctionDeclaration':
          this.evaluateFunctionDeclaration(stmt);
          break;
        case 'VariableDeclaration':
          this.evaluateVariableDeclaration(stmt);
          break;
        case 'AssignmentStatement':
          this.evaluateAssignmentStatement(stmt);
          break;
        case 'IfStatement':
          this.evaluateIfStatement(stmt);
          break;
        case 'WhileStatement':
          this.evaluateWhileStatement(stmt);
          break;
        case 'UntilStatement':
          this.evaluateUntilStatement(stmt);
          break;
        case 'ForStatement':
          this.evaluateForStatement(stmt);
          break;
        case 'ReturnStatement':
          this.evaluateReturnStatement(stmt);
          break;
        case 'BlockStatement':
          this.evaluateBlockStatement(stmt);
          break;
        case 'ExpressionStatement':
          this.evaluator.evaluateExpression(stmt.expression);
          break;
        case 'InvariantStatement':
          this.evaluateInvariantStatement(stmt);
          break;
        case 'AssertStatement':
          this.evaluateAssertStatement(stmt);
          break;
      }
    } catch (e) {
      if (e instanceof ReturnException) {
        throw e;
      }
      throw e;
    }
  }

  private evaluateFunctionDeclaration(stmt: FunctionDeclaration): void {
    const paramTypes = stmt.parameters.map(p => resolveTypeAnnotation(p.typeAnnotation));
    const returnType = resolveTypeAnnotation(stmt.returnType);

    const funcValue: RuntimeTypedBinder = {
      value: {
        parameters: stmt.parameters,
        body: stmt.body,
        closure: this.captureEnvironment(),
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

  private evaluateVariableDeclaration(stmt: VariableDeclaration): void {
    for (const declarator of stmt.declarations) {
      
      let value: RuntimeTypedBinder;
      if (declarator.initializer) {
        value = this.evaluator.evaluateExpression(declarator.initializer);

        // If there's a type annotation (either explicit or inferred/refined),
        // use it to override the runtime type, but only if it's a concrete type
        if (declarator.typeAnnotation) {
          const declaredType = resolveTypeAnnotation(declarator.typeAnnotation);
          // Only override runtime type if the declared type is concrete (not weak or dynamic)
          // - weak: Type is unknown due to lack of usage (true polymorphism)
          // - dynamic: Type depends on runtime values (e.g., union type operations)
          // In both cases, we trust the runtime-determined concrete type
          if (declaredType && declaredType.kind !== 'weak') {
            value.type.static = declaredType;
          } else if (!declaredType) {
            throw new Error(`Type should be annotated for variable '${declarator.name}'.`);
          }
          // If declaredType is weak or dynamic, keep the runtime-determined type
        }
      } else {
        throw new Error(`Variable '${declarator.name}' must be initialized.`);
      }

      // Skip binding if the variable name is '_' (unnamed variable)
      if (declarator.name !== '_') {
        this.currentEnv.define(declarator.name, value);
      }
    }
  }

  private captureEnvironment(): Environment {
    return this.currentEnv;
  }

  private evaluateAssignmentStatement(stmt: AssignmentStatement): void {
    const value = this.evaluator.evaluateExpression(stmt.value);

    // Handle simple identifier assignment
    if (stmt.target.type === 'Identifier') {
      // Cannot assign to underscore
      if (stmt.target.name === '_') {
        throw new Error('Cannot assign to underscore (_)');
      }
      // Check if variable exists (will throw if undefined during lookup)
      try {
        this.evaluator.evaluateExpression(stmt.target); // This will throw if variable doesn't exist
      } catch (e) {
        throw new Error(`Cannot assign to undeclared variable: ${stmt.target.name}`);
      }
      // Update the variable in the current environment
      this.currentEnv.set(stmt.target.name, value);
      return;
    }

    // Handle member expression assignment (e.g., obj.prop = value)
    if (stmt.target.type === 'MemberExpression') {
      const object = this.evaluator.evaluateExpression(stmt.target.object);
      const propertyName = stmt.target.property.name;

      if (object.type.static.kind === 'map') {
        (object.value as SchemaMap<any, RuntimeTypedBinder>).set(propertyName, value);
        return;
      }

      throw new Error(`Cannot assign to property ${propertyName}`);
    }

    // Handle index expression assignment (e.g., arr[0] = value)
    if (stmt.target.type === 'IndexExpression') {
      const object = this.evaluator.evaluateExpression(stmt.target.object);
      const index = this.evaluator.evaluateExpression(stmt.target.index);

      if (object.type.static.kind === 'array' && index.type.static.kind === 'int') {
        (object.value as SchemaArray<RuntimeTypedBinder>).set(index.value as number, value);
        return;
      }

      if (object.type.static.kind === 'map') {
        const key = runtimeTypedBinderToKey(index);
        (object.value as SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>).set(key, value);
        return;
      }

      throw new Error('Invalid assignment target');
    }

    throw new Error('Invalid assignment target');
  }

  private evaluateIfStatement(stmt: IfStatement): void {
    const condition = this.evaluator.evaluateExpression(stmt.condition);

    if (condition.type.static.kind !== 'boolean') {
      throw new Error('If condition must be boolean');
    }
    if (condition.value as boolean) {
      this.evaluateStatement(stmt.thenBranch);
    } else if (stmt.elseBranch) {
      this.evaluateStatement(stmt.elseBranch);
    }
  }

  private evaluateWhileStatement(stmt: WhileStatement): void {
    const invariants = extractInvariants(stmt.body);
    let iteration = 0;

    // Initialize invariant tracker for automatic synthesis
    const tracker = new InvariantTracker();
    this.trackerStack.push(tracker);

    // Record initial state before any iterations
    tracker.recordState(this.currentEnv, 0);

    try {
      while (true) {
        const condition = this.evaluator.evaluateExpression(stmt.condition);
        if (condition.type.static.kind !== 'boolean') {
          throw new Error('While condition must be boolean');
        }
        if (!(condition.value as boolean)) break;

        // Check invariants before iteration
        checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

        try {
          this.evaluateStatement(stmt.body);
        } catch (e) {
          // If early return, check invariants before exiting
          if (e instanceof ReturnException) {
            checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          }
          throw e;
        }

        // Check invariants after iteration
        // Record state after iteration
        tracker.recordState(this.currentEnv, iteration);

        checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
        // Record state after iteration (to capture final values)
        // Moved to after iteration

        iteration++;
      }
    } finally {
      this.trackerStack.pop();
    }

    // Record final state after loop exits
    // Moved to after iteration

    // Synthesize and attach invariants to variables
    const synthesizedInvariants = tracker.synthesize();
    for (const [varName, predicates] of synthesizedInvariants) {
      if (this.currentEnv.has(varName)) {
        const binding = this.currentEnv.get(varName);
        // Merge with existing refinements
        const existingRefinements = binding.type.refinements;
        const newRefinements = [...existingRefinements, ...predicates];
        binding.type.refinements = newRefinements;
      }
    }
  }

  private evaluateUntilStatement(stmt: UntilStatement): void {
    const invariants = extractInvariants(stmt.body);
    let iteration = 0;

    // Initialize invariant tracker for automatic synthesis
    const tracker = new InvariantTracker();
    this.trackerStack.push(tracker);

    // Record initial state before any iterations
    tracker.recordState(this.currentEnv, 0);

    try {
      while (true) {
        const condition = this.evaluator.evaluateExpression(stmt.condition);
        if (condition.type.static.kind !== 'boolean') {
          throw new Error('Until condition must be boolean');
        }
        if (condition.value as boolean) break;

        // Check invariants before iteration
        checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

        try {
          this.evaluateStatement(stmt.body);
        } catch (e) {
          // If early return, check invariants before exiting
          if (e instanceof ReturnException) {
            checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          }
          throw e;
        }

        // Check invariants after iteration
        // Record state after iteration
        tracker.recordState(this.currentEnv, iteration);

        checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
        // Record state after iteration (to capture final values)
        // Moved to after iteration

        iteration++;
      }
    } finally {
      this.trackerStack.pop();
    }

    // Record final state after loop exits
    // Moved to after iteration

    // Synthesize and attach invariants to variables
    const synthesizedInvariants = tracker.synthesize();
    for (const [varName, predicates] of synthesizedInvariants) {
      if (this.currentEnv.has(varName)) {
        const binding = this.currentEnv.get(varName);
        // Merge with existing refinements
        const existingRefinements = binding.type.refinements;
        const newRefinements = [...existingRefinements, ...predicates];
        binding.type.refinements = newRefinements;
      }
    }
  }

  private evaluateForStatement(stmt: ForStatement): void {
    const iterable = this.evaluator.evaluateExpression(stmt.iterable);
    const invariants = extractInvariants(stmt.body);

    const savedEnv = this.currentEnv;
    this.currentEnv = new Environment(savedEnv);

    let iteration = 0;

    // Initialize invariant tracker for automatic synthesis
    const tracker = new InvariantTracker();
    this.trackerStack.push(tracker);

    // Record initial state before loop starts
    tracker.recordState(this.currentEnv, 0);

    try {
      if (iterable.type.static.kind === 'array') {
        (iterable.value as SchemaArray<RuntimeTypedBinder>).forEach((item) => {
          // Skip binding if the variable name is '_' (unnamed variable)
          if (stmt.variable !== '_') {
            this.currentEnv.define(stmt.variable, item);
          }

          // Check invariants before iteration
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
            }
            throw e;
          }

          // Check invariants after iteration
          // Record state after iteration
          tracker.recordState(this.currentEnv, iteration);

          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

          // Record state after iteration
          // Moved to after iteration

          iteration++;
        });
      } else if (iterable.type.static.kind === 'set') {
        (iterable.value as SchemaSet<RuntimeTypedBinder>).forEach((item) => {
          // Items in sets are already RuntimeTypedBinders
          const runtimeItem = item as RuntimeTypedBinder;
          // Skip binding if the variable name is '_' (unnamed variable)
          if (stmt.variable !== '_') {
            this.currentEnv.define(stmt.variable, runtimeItem);
          }

          // Check invariants before iteration
          // Moved to after iteration

          // Check invariants before iteration
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
            }
            throw e;
          }

          // Check invariants after iteration
          // Record state after iteration
          tracker.recordState(this.currentEnv, iteration);

          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

          iteration++;
        });
      } else if (iterable.type.static.kind === 'map') {
        (iterable.value as SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>).forEach((value, key) => {
          // Keys in maps are already RuntimeTypedBinders
          const runtimeKey = key as RuntimeTypedBinder;
          // Skip binding if the variable name is '_' (unnamed variable)
          if (stmt.variable !== '_') {
            this.currentEnv.define(stmt.variable, runtimeKey);
          }

          // Check invariants before iteration
          // Moved to after iteration

          // Check invariants before iteration
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
            }
            throw e;
          }

          // Check invariants after iteration
          // Record state after iteration
          tracker.recordState(this.currentEnv, iteration);
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          iteration++;
        });
      } else if (iterable.type.static.kind === 'range') {
        (iterable.value as LazyRange).generate();
        // Support for infinite ranges - use the generator
        for (const value of (iterable.value as LazyRange).generate()) {
          const runtimeValue: RuntimeTypedBinder = { value, type: { static: { kind: 'int' }, refinements: [] } };
          // Skip binding if the variable name is '_' (unnamed variable)
          if (stmt.variable !== '_') {
            this.currentEnv.define(stmt.variable, runtimeValue);
          }

          // Check invariants before iteration
          // Moved to after iteration

          // Check invariants before iteration
          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));

          try {
            this.evaluateStatement(stmt.body);
          } catch (e) {
            // If early return, check invariants before exiting
            if (e instanceof ReturnException) {
              checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
            }
            throw e;
          }

          // Check invariants after iteration
          // Record state after iteration
          tracker.recordState(this.currentEnv, iteration);

          checkLoopInvariants(invariants, iteration, this.analyzer, this.currentEnv, (expr) => this.evaluator.evaluateExpression(expr));
          iteration++;
        }
      }
    } finally {
      this.trackerStack.pop();
    }

    // Synthesize and attach invariants to variables
    const synthesizedInvariants = tracker.synthesize();
    for (const [varName, predicates] of synthesizedInvariants) {
      if (this.currentEnv.has(varName)) {
        const binding = this.currentEnv.get(varName);
        // Merge with existing refinements
        const existingRefinements = binding.type.refinements;
        const newRefinements = [...existingRefinements, ...predicates];
        binding.type.refinements = newRefinements;
      }
    }

    this.currentEnv = savedEnv;
  }

  private evaluateReturnStatement(stmt: ReturnStatement): void {
    const value = stmt.value
      ? this.evaluator.evaluateExpression(stmt.value)
      : { type: { static: { kind: 'void' as const }, refinements: [] }, value: new Sole() };
    throw new ReturnException(value);
  }

  private evaluateBlockStatement(stmt: BlockStatement): void {
    const savedEnv = this.currentEnv;
    this.currentEnv = new Environment(savedEnv);

    for (const statement of stmt.statements) {
      this.evaluateStatement(statement);
    }

    this.currentEnv = savedEnv;
  }

  private evaluateInvariantStatement(stmt: InvariantStatement): void {
    this.analyzer.checkInvariant(
      stmt,
      (expr) => this.evaluator.evaluateExpression(expr),
      this.currentEnv,
      { kind: 'function' } // Default to function context, will be overridden in loops
    );
  }

  private evaluateAssertStatement(stmt: AssertStatement): void {
    this.analyzer.checkAssert(
      stmt,
      (expr) => this.evaluator.evaluateExpression(expr),
      this.currentEnv
    );
  }
}
