import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  VariableDeclaration,
  AssignmentStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
  BlockStatement,
  ExpressionStatement,
} from './types';
import { RuntimeValue, runtimeValueToString, isTruthy } from './runtime/values';
import {
  SchemaArray,
  SchemaMap,
  SchemaSet,
  MinHeap,
  MaxHeap,
  Graph,
  LazyRange,
} from './runtime/data-structures';

class ReturnException {
  constructor(public value: RuntimeValue) {}
}

class Environment {
  private bindings: Map<string, RuntimeValue> = new Map();
  private parent: Environment | null = null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  define(name: string, value: RuntimeValue): void {
    this.bindings.set(name, value);
  }

  get(name: string): RuntimeValue {
    if (this.bindings.has(name)) {
      return this.bindings.get(name)!;
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    throw new Error(`Undefined variable: ${name}`);
  }

  set(name: string, value: RuntimeValue): void {
    if (this.bindings.has(name)) {
      this.bindings.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new Error(`Cannot assign to undeclared variable: ${name}`);
  }

  has(name: string): boolean {
    if (this.bindings.has(name)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(name);
    }
    return false;
  }

  // For compatibility with existing code that uses Map methods
  entries(): IterableIterator<[string, RuntimeValue]> {
    const allEntries = new Map<string, RuntimeValue>();
    this.collectAllBindings(allEntries);
    return allEntries.entries();
  }

  private collectAllBindings(result: Map<string, RuntimeValue>): void {
    if (this.parent) {
      this.parent.collectAllBindings(result);
    }
    for (const [key, value] of this.bindings.entries()) {
      result.set(key, value);
    }
  }
}

export class Interpreter {
  private globalEnv: Environment = new Environment();
  private currentEnv: Environment;
  private output: string[] = [];

  constructor() {
    this.currentEnv = this.globalEnv;
    this.initializeBuiltins();
  }

  private initializeBuiltins(): void {
    this.globalEnv.define('print', {
      type: 'native-function',
      fn: (...args: RuntimeValue[]) => {
        const output = args.map(runtimeValueToString).join(' ');
        this.output.push(output);
        return { type: 'null', value: null };
      },
    });

    this.globalEnv.define('MinHeap', {
      type: 'native-function',
      fn: () => {
        return { type: 'minheap', value: new MinHeap<number>() };
      },
    });

    this.globalEnv.define('MaxHeap', {
      type: 'native-function',
      fn: () => {
        return { type: 'maxheap', value: new MaxHeap<number>() };
      },
    });

    this.globalEnv.define('Graph', {
      type: 'native-function',
      fn: (directed?: RuntimeValue) => {
        const isDirected =
          directed && directed.type === 'boolean' ? directed.value : false;
        return { type: 'graph', value: new Graph<any>(isDirected) };
      },
    });

    this.globalEnv.define('Map', {
      type: 'native-function',
      fn: () => {
        return { type: 'map', value: new SchemaMap<any, RuntimeValue>() };
      },
    });

    this.globalEnv.define('Set', {
      type: 'native-function',
      fn: () => {
        return { type: 'set', value: new SchemaSet<any>() };
      },
    });

    this.globalEnv.define('Inf', {
      type: 'float',
      value: Infinity,
    });
  }

  public evaluate(program: Program): string[] {
    this.output = [];

    for (const statement of program.body) {
      this.evaluateStatement(statement);
    }

    return this.output;
  }

  public getOutput(): string[] {
    return this.output;
  }

  private evaluateStatement(stmt: Statement): void {
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
          this.evaluateExpression(stmt.expression);
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
    const funcValue: RuntimeValue = {
      type: 'function',
      parameters: stmt.parameters,
      body: stmt.body,
      closure: this.captureEnvironment(),
    };

    this.currentEnv.define(stmt.name, funcValue);

    // Add function to its own closure for recursion
    funcValue.closure.set(stmt.name, funcValue);
  }

  private evaluateVariableDeclaration(stmt: VariableDeclaration): void {
    for (const declarator of stmt.declarations) {
      let value: RuntimeValue = { type: 'null', value: null };

      if (declarator.initializer) {
        value = this.evaluateExpression(declarator.initializer);
      }

      // Skip binding if the variable name is '_' (unnamed variable)
      if (declarator.name !== '_') {
        this.currentEnv.define(declarator.name, value);
      }
    }
  }

  private captureEnvironment(): Map<string, RuntimeValue> {
    const captured = new Map<string, RuntimeValue>();
    for (const [key, value] of this.currentEnv.entries()) {
      captured.set(key, value);
    }
    return captured;
  }

  private evaluateAssignmentStatement(stmt: AssignmentStatement): void {
    const value = this.evaluateExpression(stmt.value);

    // Handle simple identifier assignment
    if (stmt.target.type === 'Identifier') {
      // Cannot assign to underscore
      if (stmt.target.name === '_') {
        throw new Error('Cannot assign to underscore (_)');
      }
      // Check if variable exists (will throw if undefined during lookup)
      try {
        this.evaluateExpression(stmt.target); // This will throw if variable doesn't exist
      } catch (e) {
        throw new Error(`Cannot assign to undeclared variable: ${stmt.target.name}`);
      }
      // Update the variable in the current environment
      this.currentEnv.set(stmt.target.name, value);
      return;
    }

    // Handle member expression assignment (e.g., obj.prop = value)
    if (stmt.target.type === 'MemberExpression') {
      const object = this.evaluateExpression(stmt.target.object);
      const propertyName = stmt.target.property.name;

      if (object.type === 'map') {
        object.value.set(propertyName, value);
        return;
      }

      throw new Error(`Cannot assign to property ${propertyName}`);
    }

    // Handle index expression assignment (e.g., arr[0] = value)
    if (stmt.target.type === 'IndexExpression') {
      const object = this.evaluateExpression(stmt.target.object);
      const index = this.evaluateExpression(stmt.target.index);

      if (object.type === 'array' && index.type === 'int') {
        object.value.set(index.value, value);
        return;
      }

      if (object.type === 'map') {
        const key = this.runtimeValueToKey(index);
        object.value.set(key, value);
        return;
      }

      throw new Error('Invalid assignment target');
    }

    throw new Error('Invalid assignment target');
  }

  private evaluateIfStatement(stmt: IfStatement): void {
    const condition = this.evaluateExpression(stmt.condition);

    if (isTruthy(condition)) {
      this.evaluateStatement(stmt.thenBranch);
    } else if (stmt.elseBranch) {
      this.evaluateStatement(stmt.elseBranch);
    }
  }

  private evaluateWhileStatement(stmt: WhileStatement): void {
    while (isTruthy(this.evaluateExpression(stmt.condition))) {
      this.evaluateStatement(stmt.body);
    }
  }

  private evaluateForStatement(stmt: ForStatement): void {
    const iterable = this.evaluateExpression(stmt.iterable);

    const savedEnv = this.currentEnv;
    this.currentEnv = new Environment(savedEnv);

    if (iterable.type === 'array') {
      iterable.value.forEach((item) => {
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, item);
        }
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type === 'set') {
      iterable.value.forEach((item) => {
        let runtimeItem: RuntimeValue;
        if (typeof item === 'number') {
          runtimeItem = Number.isInteger(item)
            ? { type: 'int', value: item }
            : { type: 'float', value: item };
        } else if (typeof item === 'string') {
          runtimeItem = { type: 'string', value: item };
        } else if (typeof item === 'boolean') {
          runtimeItem = { type: 'boolean', value: item };
        } else if (typeof item === 'object' && item !== null && 'type' in item) {
          runtimeItem = item as RuntimeValue;
        } else {
          runtimeItem = { type: 'null', value: null };
        }
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, runtimeItem);
        }
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type === 'map') {
      iterable.value.forEach((value, key) => {
        let runtimeKey: RuntimeValue;
        if (typeof key === 'number') {
          runtimeKey = Number.isInteger(key)
            ? { type: 'int', value: key }
            : { type: 'float', value: key };
        } else if (typeof key === 'string') {
          runtimeKey = { type: 'string', value: key };
        } else if (typeof key === 'boolean') {
          runtimeKey = { type: 'boolean', value: key };
        } else if (typeof key === 'object' && key !== null && 'type' in key) {
          runtimeKey = key as RuntimeValue;
        } else {
          runtimeKey = { type: 'null', value: null };
        }
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, runtimeKey);
        }
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type === 'range') {
      iterable.value.generate();
      // Support for infinite ranges - use the generator
      const limit = 1000; // Safety limit for infinite ranges
      for (const value of iterable.value.generate()) {
        const runtimeValue: RuntimeValue = { type: 'int', value };
        // Skip binding if the variable name is '_' (unnamed variable)
        if (stmt.variable !== '_') {
          this.currentEnv.define(stmt.variable, runtimeValue);
        }
        this.evaluateStatement(stmt.body);
      }
    }

    this.currentEnv = savedEnv;
  }

  private evaluateReturnStatement(stmt: ReturnStatement): void {
    const value = stmt.value
      ? this.evaluateExpression(stmt.value)
      : { type: 'null' as const, value: null };
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

  private evaluateExpression(expr: Expression): RuntimeValue {
    switch (expr.type) {
      case 'NumberLiteral':
        // Check if the number is an integer or float
        if (Number.isInteger(expr.value)) {
          return { type: 'int', value: expr.value };
        } else {
          return { type: 'float', value: expr.value };
        }

      case 'StringLiteral':
        return { type: 'string', value: expr.value };

      case 'BooleanLiteral':
        return { type: 'boolean', value: expr.value };

      case 'ArrayLiteral': {
        const elements = expr.elements.map((e) => this.evaluateExpression(e));
        return { type: 'array', value: new SchemaArray(elements) };
      }

      case 'Identifier': {
        // Underscore cannot be used as a value
        if (expr.name === '_') {
          throw new Error('Underscore (_) cannot be used as a value');
        }
        const value = this.currentEnv.get(expr.name);
        if (value === undefined) {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        return value;
      }

      case 'BinaryExpression':
        return this.evaluateBinaryExpression(expr);

      case 'UnaryExpression': {
        const operand = this.evaluateExpression(expr.operand);

        if (expr.operator === '-') {
          if (operand.type === 'int') {
            return { type: 'int', value: -operand.value };
          } else if (operand.type === 'float') {
            return { type: 'float', value: -operand.value };
          } else {
            throw new Error('Unary minus requires int or float operand');
          }
        }

        if (expr.operator === '!') {
          return { type: 'boolean', value: !isTruthy(operand) };
        }

        throw new Error(`Unknown unary operator: ${expr.operator}`);
      }

      case 'CallExpression':
        return this.evaluateCallExpression(expr);

      case 'MemberExpression': {
        const object = this.evaluateExpression(expr.object);
        const propertyName = expr.property.name;

        if (object.type === 'array') {
          if (propertyName === 'length') {
            return {
              type: 'native-function',
              fn: () => {
                return { type: 'int', value: object.value.length }
              }
             };
          }
          if (propertyName === 'push') {
            return {
              type: 'native-function',
              fn: (item: RuntimeValue) => {
                object.value.push(item);
                return { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'pop') {
            return {
              type: 'native-function',
              fn: () => {
                return object.value.pop() || { type: 'null', value: null };
              },
            };
          }
        }

        if (object.type === 'map') {
          if (propertyName === 'size') {
            return {
              type: 'native-function',
              fn: () => {
                return { type: 'int', value: object.value.size };
              },
            };
          }
          if (propertyName === 'get') {
            return {
              type: 'native-function',
              fn: (key: RuntimeValue) => {
                const k = this.runtimeValueToKey(key);
                return object.value.get(k) || { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'set') {
            return {
              type: 'native-function',
              fn: (key: RuntimeValue, value: RuntimeValue) => {
                const k = this.runtimeValueToKey(key);
                object.value.set(k, value);
                return { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'has') {
            return {
              type: 'native-function',
              fn: (key: RuntimeValue) => {
                const k = this.runtimeValueToKey(key);
                return { type: 'boolean', value: object.value.has(k) };
              },
            };
          }
        }

        if (object.type === 'set') {
          if (propertyName === 'size') {
            return {
              type: 'native-function',
              fn: () => {
                return { type: 'int', value: object.value.size };
              },
            };
          }
          if (propertyName === 'add') {
            return {
              type: 'native-function',
              fn: (item: RuntimeValue) => {
                const k = this.runtimeValueToKey(item);
                object.value.add(k);
                return { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'has') {
            return {
              type: 'native-function',
              fn: (item: RuntimeValue) => {
                const k = this.runtimeValueToKey(item);
                return { type: 'boolean', value: object.value.has(k) };
              },
            };
          }
        }

        if (object.type === 'minheap' || object.type === 'maxheap') {
          if (propertyName === 'size') {
            return {
              type: 'native-function',
              fn: () => {
                return { type: 'int', value: object.value.size };
              },
            };
          }
          if (propertyName === 'push') {
            return {
              type: 'native-function',
              fn: (item: RuntimeValue) => {
                const k = this.runtimeValueToKey(item);
                object.value.push(k);
                return { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'pop') {
            return {
              type: 'native-function',
              fn: () => {
                const val = object.value.pop();
                return val !== undefined
                  ? Number.isInteger(val)
                    ? { type: 'int', value: val }
                    : { type: 'float', value: val }
                  : { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'peek') {
            return {
              type: 'native-function',
              fn: () => {
                const val = object.value.peek();
                return val !== undefined
                  ? Number.isInteger(val)
                    ? { type: 'int', value: val }
                    : { type: 'float', value: val }
                  : { type: 'null', value: null };
              },
            };
          }
        }

        if (object.type === 'graph') {
          if (propertyName === 'addVertex') {
            return {
              type: 'native-function',
              fn: (vertex: RuntimeValue) => {
                const v = this.runtimeValueToKey(vertex);
                object.value.addVertex(v);
                return { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'addEdge') {
            return {
              type: 'native-function',
              fn: (
                from: RuntimeValue,
                to: RuntimeValue,
                weight?: RuntimeValue
              ) => {
                const f = this.runtimeValueToKey(from);
                const t = this.runtimeValueToKey(to);
                const w =
                  weight && (weight.type === 'int' || weight.type === 'float') ? weight.value : 1;
                object.value.addEdge(f, t, w);
                return { type: 'null', value: null };
              },
            };
          }
          if (propertyName === 'getNeighbors') {
            return {
              type: 'native-function',
              fn: (vertex: RuntimeValue) => {
                const v = this.runtimeValueToKey(vertex);
                const neighbors = object.value.getNeighbors(v);
                const arr = new SchemaArray<RuntimeValue>();
                neighbors.forEach((edge) => {
                  const obj = new SchemaMap<any, RuntimeValue>();
                  obj.set('to', { type: 'int', value: edge.to as number });
                  obj.set('weight', { type: 'int', value: edge.weight });
                  arr.push({ type: 'map', value: obj });
                });
                return { type: 'array', value: arr };
              },
            };
          }
        }

        throw new Error(`Property ${propertyName} does not exist`);
      }

      case 'IndexExpression': {
        const object = this.evaluateExpression(expr.object);
        const index = this.evaluateExpression(expr.index);

        if (object.type === 'array' && index.type === 'int') {
          return (
            object.value.get(index.value) || { type: 'null', value: null }
          );
        }

        if (object.type === 'map') {
          const key = this.runtimeValueToKey(index);
          return object.value.get(key) || { type: 'null', value: null };
        }

        throw new Error('Invalid index expression');
      }

      case 'RangeExpression': {
        const inclusive = expr.inclusive;
        
        // Handle string range expressions like "aa".."bb", "a".."z"
        if (expr.start) {
          const startVal = this.evaluateExpression(expr.start);
          if (startVal.type === 'string') {
            return this.evaluateStringRange(startVal.value, expr.end, inclusive);
          }
        }
        
        // Handle integer range expressions like 1..3, 1...3, ..3, 0..
        let start: number // There must be a start (possibly default)
        let end: number | undefined;

        if (expr.start) {
          const startVal = this.evaluateExpression(expr.start);
          if (startVal.type === 'int') {
            start = startVal.value;
          } else {
            throw new Error('Range start must be an integer or string');
          }
        } else {
          start = 0; // Default start for integer ranges
        }
        // Evaluate start (default to 0 if not provided)

        // Evaluate end (undefined for infinite ranges)
        if (expr.end) {
          const endVal = this.evaluateExpression(expr.end);
          if (endVal.type === 'int') {
            end = endVal.value;
          } else {
            throw new Error('Range end must be an integer');
          }
        } else {
          end = undefined; // Infinite range
        }

        // Create and return the range
        const range = new LazyRange(start, end, inclusive);

        // If it's a finite range, convert to array for immediate use
        // Otherwise, return the range object for lazy evaluation
        if (!range.isInfinite) {
          const elements = range.toArray().map(val => ({ type: 'int' as const, value: val }));
          return { type: 'array', value: new SchemaArray(elements) };
        } else {
          return { type: 'range', value: range };
        }
      }

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private evaluateStringRange(start: string, endExpr: Expression | undefined, inclusive: boolean): RuntimeValue {
    if (!endExpr) {
      throw new Error('String ranges must have both start and end');
    }

    const endVal = this.evaluateExpression(endExpr);
    if (endVal.type !== 'string') {
      throw new Error('String range end must be a string');
    }

    const end = endVal.value;

    // Generate string range
    const result: RuntimeValue[] = [];

    // Simple implementation for same-length strings
    if (start.length !== end.length) {
      throw new Error('String range start and end must have the same length');
    }

    if (start.length === 1) {
      // Single character range like 'a'..'z'
      const startCode = start.charCodeAt(0);
      const endCode = end.charCodeAt(0);
      const finalCode = inclusive ? endCode : endCode - 1;

      for (let code = startCode; code <= finalCode; code++) {
        result.push({ type: 'string', value: String.fromCharCode(code) });
      }
    } else {
      // Multi-character range like "aa".."bb"
      const current = start.split('');
      const endChars = end.split('');
      const maxIterations = 10000; // Safety limit
      let iterations = 0;

      while (iterations < maxIterations) {
        result.push({ type: 'string', value: current.join('') });

        if (current.join('') === end) {
          if (!inclusive) {
            result.pop(); // Remove the end if not inclusive
          }
          break;
        }

        if (inclusive && current.join('') === end) {
          break;
        }

        // Increment the string (rightmost character first)
        let carry = true;
        for (let i = current.length - 1; i >= 0 && carry; i--) {
          const charCode = current[i].charCodeAt(0);
          if (charCode < endChars[i].charCodeAt(0) || (i > 0 && charCode < 122)) {
            current[i] = String.fromCharCode(charCode + 1);
            carry = false;
          } else if (i > 0) {
            current[i] = 'a';
          } else {
            carry = false;
            break;
          }
        }

        iterations++;
      }
    }

    return { type: 'array', value: new SchemaArray(result) };
  }

  private evaluateBinaryExpression(expr: any): RuntimeValue {
    const left = this.evaluateExpression(expr.left);
    const right = this.evaluateExpression(expr.right);

    // Arithmetic: +, -, *, % (work on int and float)
    if (expr.operator === '+') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: left.value + right.value };
      }
      if (left.type === 'float' && right.type === 'float') {
        return { type: 'float', value: left.value + right.value };
      }
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'float', value: left.value + right.value };
      }
      if (left.type === 'string' && right.type === 'string') {
        return { type: 'string', value: left.value + right.value };
      }
      throw new Error(`Cannot add ${left.type} and ${right.type}`);
    }

    if (expr.operator === '-') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: left.value - right.value };
      }
      if (left.type === 'float' && right.type === 'float') {
        return { type: 'float', value: left.value - right.value };
      }
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'float', value: left.value - right.value };
      }
      throw new Error(`Cannot subtract ${right.type} from ${left.type}`);
    }

    if (expr.operator === '*') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: left.value * right.value };
      }
      if (left.type === 'float' && right.type === 'float') {
        return { type: 'float', value: left.value * right.value };
      }
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'float', value: left.value * right.value };
      }
      throw new Error(`Cannot multiply ${left.type} and ${right.type}`);
    }

    // Integer division: / (requires both operands to be int, returns int)
    if (expr.operator === '/') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: Math.floor(left.value / right.value) };
      }
      throw new Error(`Integer division requires both operands to be int`);
    }

    // Float division: /. (works on int or float, returns float)
    if (expr.operator === '/.') {
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'float', value: left.value / right.value };
      }
      throw new Error(`Float division requires numeric operands`);
    }

    if (expr.operator === '%') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: left.value % right.value };
      }
      if (left.type === 'float' && right.type === 'float') {
        return { type: 'float', value: left.value % right.value };
      }
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'float', value: left.value % right.value };
      }
      throw new Error(`Modulo requires numeric operands`);
    }

    // Bitwise shift operators: << and >> (require both operands to be int)
    if (expr.operator === '<<') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: left.value << right.value };
      }
      throw new Error(`Left shift requires both operands to be int`);
    }

    if (expr.operator === '>>') {
      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: left.value >> right.value };
      }
      throw new Error(`Right shift requires both operands to be int`);
    }

    // Comparison operators: work on int or float
    if (expr.operator === '<') {
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'boolean', value: left.value < right.value };
      }
      throw new Error(`Cannot compare ${left.type} < ${right.type}`);
    }

    if (expr.operator === '<=') {
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'boolean', value: left.value <= right.value };
      }
      throw new Error(`Cannot compare ${left.type} <= ${right.type}`);
    }

    if (expr.operator === '>') {
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'boolean', value: left.value > right.value };
      }
      throw new Error(`Cannot compare ${left.type} > ${right.type}`);
    }

    if (expr.operator === '>=') {
      if ((left.type === 'int' || left.type === 'float') &&
          (right.type === 'int' || right.type === 'float')) {
        return { type: 'boolean', value: left.value >= right.value };
      }
      throw new Error(`Cannot compare ${left.type} >= ${right.type}`);
    }

    // Equality operators
    if (expr.operator === '==') {
      return { type: 'boolean', value: this.valuesEqual(left, right) };
    }

    if (expr.operator === '!=') {
      return { type: 'boolean', value: !this.valuesEqual(left, right) };
    }

    // Logical operators
    if (expr.operator === '&&') {
      return { type: 'boolean', value: isTruthy(left) && isTruthy(right) };
    }

    if (expr.operator === '||') {
      return { type: 'boolean', value: isTruthy(left) || isTruthy(right) };
    }

    throw new Error(`Unknown binary operator: ${expr.operator}`);
  }

  private evaluateCallExpression(expr: any): RuntimeValue {
    const callee = this.evaluateExpression(expr.callee);

    if (callee.type === 'native-function') {
      const args = expr.arguments.map((arg: Expression) =>
        this.evaluateExpression(arg)
      );
      return callee.fn(...args);
    }

    if (callee.type === 'function') {
      const args = expr.arguments.map((arg: Expression) =>
        this.evaluateExpression(arg)
      );

      const savedEnv = this.currentEnv;
      // Create a new environment from the closure
      const closureEnv = new Environment();
      for (const [key, value] of callee.closure.entries()) {
        closureEnv.define(key, value);
      }
      this.currentEnv = closureEnv;

      for (let i = 0; i < callee.parameters.length; i++) {
        this.currentEnv.define(callee.parameters[i].name, args[i]);
      }

      try {
        this.evaluateStatement(callee.body);
        this.currentEnv = savedEnv;
        return { type: 'null', value: null };
      } catch (e) {
        if (e instanceof ReturnException) {
          this.currentEnv = savedEnv;
          return e.value;
        }
        throw e;
      }
    }

    throw new Error('Not a function');
  }

  private valuesEqual(left: RuntimeValue, right: RuntimeValue): boolean {
    if (left.type !== right.type) return false;

    if (left.type === 'int' && right.type === 'int') {
      return left.value === right.value;
    }

    if (left.type === 'float' && right.type === 'float') {
      return left.value === right.value;
    }

    if (left.type === 'string' && right.type === 'string') {
      return left.value === right.value;
    }

    if (left.type === 'boolean' && right.type === 'boolean') {
      return left.value === right.value;
    }

    if (left.type === 'null' && right.type === 'null') {
      return true;
    }

    return false;
  }

  private runtimeValueToKey(value: RuntimeValue): any {
    if (value.type === 'int' || value.type === 'float') return value.value;
    if (value.type === 'string') return value.value;
    if (value.type === 'boolean') return value.value;
    return value;
  }
}
