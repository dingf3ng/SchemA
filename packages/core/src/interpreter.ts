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
        console.log(output);
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

    this.globalEnv.define('Infinity', {
      type: 'number',
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
    let value: RuntimeValue = { type: 'null', value: null };

    if (stmt.initializer) {
      value = this.evaluateExpression(stmt.initializer);
    }

    this.currentEnv.define(stmt.name, value);
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

      if (object.type === 'array' && index.type === 'number') {
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
        this.currentEnv.define(stmt.variable, item);
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type === 'set') {
      iterable.value.forEach((item) => {
        const runtimeItem =
          typeof item === 'number'
            ? { type: 'number' as const, value: item }
            : typeof item === 'string'
              ? { type: 'string' as const, value: item }
              : { type: 'null' as const, value: null };
        this.currentEnv.define(stmt.variable, runtimeItem);
        this.evaluateStatement(stmt.body);
      });
    } else if (iterable.type === 'map') {
      iterable.value.forEach((value, key) => {
        const runtimeKey =
          typeof key === 'number'
            ? { type: 'number' as const, value: key }
            : typeof key === 'string'
              ? { type: 'string' as const, value: key }
              : { type: 'null' as const, value: null };
        this.currentEnv.define(stmt.variable, runtimeKey);
        this.evaluateStatement(stmt.body);
      });
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
        return { type: 'number', value: expr.value };

      case 'StringLiteral':
        return { type: 'string', value: expr.value };

      case 'BooleanLiteral':
        return { type: 'boolean', value: expr.value };

      case 'ArrayLiteral': {
        const elements = expr.elements.map((e) => this.evaluateExpression(e));
        return { type: 'array', value: new SchemaArray(elements) };
      }

      case 'Identifier': {
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
          if (operand.type !== 'number') {
            throw new Error('Unary minus requires number operand');
          }
          return { type: 'number', value: -operand.value };
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
                return { type: 'number', value: object.value.length }
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
                return { type: 'number', value: object.value.size };
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
                return { type: 'number', value: object.value.size };
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
                return { type: 'number', value: object.value.size };
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
                  ? { type: 'number', value: val }
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
                  ? { type: 'number', value: val }
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
                  weight && weight.type === 'number' ? weight.value : 1;
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
                  obj.set('to', { type: 'number', value: edge.to as number });
                  obj.set('weight', { type: 'number', value: edge.weight });
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

        if (object.type === 'array' && index.type === 'number') {
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

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private evaluateBinaryExpression(expr: any): RuntimeValue {
    const left = this.evaluateExpression(expr.left);
    const right = this.evaluateExpression(expr.right);

    if (expr.operator === '+') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value + right.value };
      }
      if (left.type === 'string' && right.type === 'string') {
        return { type: 'string', value: left.value + right.value };
      }
    }

    if (expr.operator === '-') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value - right.value };
      }
    }

    if (expr.operator === '*') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value * right.value };
      }
    }

    if (expr.operator === '/') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value / right.value };
      }
    }

    if (expr.operator === '%') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value % right.value };
      }
    }

    if (expr.operator === '==') {
      return { type: 'boolean', value: this.valuesEqual(left, right) };
    }

    if (expr.operator === '!=') {
      return { type: 'boolean', value: !this.valuesEqual(left, right) };
    }

    if (expr.operator === '<') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'boolean', value: left.value < right.value };
      }
      throw new Error(`Cannot compare ${left.type} < ${right.type}`);
    }

    if (expr.operator === '<=') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'boolean', value: left.value <= right.value };
      }
    }

    if (expr.operator === '>') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'boolean', value: left.value > right.value };
      }
    }

    if (expr.operator === '>=') {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'boolean', value: left.value >= right.value };
      }
    }

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

    if (left.type === 'number' && right.type === 'number') {
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
    if (value.type === 'number') return value.value;
    if (value.type === 'string') return value.value;
    if (value.type === 'boolean') return value.value;
    throw new Error('Invalid key type');
  }
}
