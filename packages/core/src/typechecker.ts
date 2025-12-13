import { Program, Statement, Expression, TypeAnnotation } from './types';

export type Type =
  | { kind: 'any' }
  | { kind: 'int' }
  | { kind: 'float' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'void' }
  | { kind: 'array'; elementType: Type }
  | { kind: 'map'; keyType: Type; valueType: Type }
  | { kind: 'set'; elementType: Type }
  | { kind: 'heap'; elementType: Type }
  | { kind: 'heapMap'; keyType: Type; valueType: Type }
  | { kind: 'binarytree'; elementType: Type }
  | { kind: 'avltree'; elementType: Type }
  | { kind: 'graph'; nodeType: Type }
  | { kind: 'range' }
  | { kind: 'record'; keyType: Type; fields: Map<string, Type> }
  | { kind: 'tuple'; elements: Type[] }
  | { kind: 'union'; types: Type[] }
  | {
    kind: 'function';
    parameters: Type[];
    returnType: Type;
    variadic?: boolean;
  };

export class TypeChecker {
  private typeEnv: Map<string, Type> = new Map();
  private functionEnv: Map<
    string,
    { parameters: Type[]; returnType: Type; variadic?: boolean }
  > = new Map();

  constructor() {
    this.initializeBuiltins();
  }

  private initializeBuiltins(): void {
    // Built-in functions
    this.functionEnv.set('print', {
      parameters: [{ kind: 'any' }],
      returnType: { kind: 'void' },
      variadic: true,
    });

    // Polymorphic built-in data structures
    this.functionEnv.set('MinHeap', {
      parameters: [],
      returnType: { kind: 'heap', elementType: { kind: 'any' } },
    });

    this.functionEnv.set('MaxHeap', {
      parameters: [],
      returnType: { kind: 'heap', elementType: { kind: 'any' } },
    });

    this.functionEnv.set('MinHeapMap', {
      parameters: [],
      returnType: { kind: 'heapMap', keyType: { kind: 'any' }, valueType: { kind: 'any' } },
    });

    this.functionEnv.set('MaxHeapMap', {
      parameters: [],
      returnType: { kind: 'heapMap', keyType: { kind: 'any' }, valueType: { kind: 'any' } },
    });

    this.functionEnv.set('Graph', {
      parameters: [{ kind: 'boolean' }],
      returnType: { kind: 'graph', nodeType: { kind: 'any' } },
    });

    this.functionEnv.set('Map', {
      parameters: [],
      returnType: {
        kind: 'map',
        keyType: { kind: 'any' },
        valueType: { kind: 'any' },
      },
    });

    this.functionEnv.set('Set', {
      parameters: [],
      returnType: { kind: 'set', elementType: { kind: 'any' } },
    });

    this.functionEnv.set('BinaryTree', {
      parameters: [],
      returnType: { kind: 'binarytree', elementType: { kind: 'any' } },
    });

    this.functionEnv.set('AVLTree', {
      parameters: [],
      returnType: { kind: 'avltree', elementType: { kind: 'any' } },
    });

    this.typeEnv.set('Inf', { kind: 'float' });
  }

  public check(program: Program): void {
    for (const statement of program.body) {
      this.checkStatement(statement);
    }
  }

  private checkStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration': {
        const paramTypes: Type[] = stmt.parameters.map((p) =>
          p.typeAnnotation
            ? this.resolveTypeAnnotation(p.typeAnnotation)
            : { kind: 'any' }
        );

        const returnType: Type = stmt.returnType
          ? this.resolveTypeAnnotation(stmt.returnType)
          : { kind: 'any' };

        this.functionEnv.set(stmt.name, {
          parameters: paramTypes,
          returnType,
        });

        const savedEnv = new Map(this.typeEnv);

        for (let i = 0; i < stmt.parameters.length; i++) {
          this.typeEnv.set(stmt.parameters[i].name, paramTypes[i]);
        }

        this.checkStatement(stmt.body);

        this.typeEnv = savedEnv;
        break;
      }

      case 'VariableDeclaration': {
        for (const declarator of stmt.declarations) {
          let varType: Type;

          if (declarator.initializer) {
            varType = this.inferType(declarator.initializer);
          } else if (declarator.typeAnnotation) {
            varType = this.resolveTypeAnnotation(declarator.typeAnnotation);
          } else {
            throw new Error(
              `Variable ${declarator.name} must have either type annotation or initializer, at ${declarator.line}, ${declarator.column}`
            );
          }

          this.typeEnv.set(declarator.name, varType);
        }
        break;
      }

      case 'IfStatement':
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        this.checkStatement(stmt.thenBranch);
        if (stmt.elseBranch) {
          this.checkStatement(stmt.elseBranch);
        }
        break;

      case 'WhileStatement':
        this.checkExpression(stmt.condition, { kind: 'boolean' });
        this.checkStatement(stmt.body);
        break;

      case 'ForStatement':
        const iterableType = this.inferType(stmt.iterable);
        if (
          iterableType.kind !== 'array' &&
          iterableType.kind !== 'set' &&
          iterableType.kind !== 'map' &&
          iterableType.kind !== 'range' &&
          iterableType.kind !== 'any'
        ) {
          throw new Error(
            `Cannot iterate over non-iterable type ${iterableType.kind}, at ${stmt.iterable.line}, ${stmt.iterable.column}`
          );
        }

        const savedEnv = new Map(this.typeEnv);

        // Skip binding if variable name is '_'
        if (stmt.variable !== '_') {
          if (iterableType.kind === 'array' || iterableType.kind === 'set') {
            this.typeEnv.set(stmt.variable, iterableType.elementType);
          } else if (iterableType.kind === 'map') {
            this.typeEnv.set(stmt.variable, iterableType.keyType);
          } else if (iterableType.kind === 'range') {
            this.typeEnv.set(stmt.variable, { kind: 'int' });
          } else if (iterableType.kind === 'any') {
            this.typeEnv.set(stmt.variable, { kind: 'any' });
          }
        }

        this.checkStatement(stmt.body);
        this.typeEnv = savedEnv;
        break;

      case 'ReturnStatement':
        if (stmt.value) {
          this.inferType(stmt.value);
        }
        break;

      case 'BlockStatement':
        for (const s of stmt.statements) {
          this.checkStatement(s);
        }
        break;

      case 'ExpressionStatement':
        this.inferType(stmt.expression);
        break;
    }
  }

  private checkExpression(expr: Expression, expectedType: Type): void {
    const actualType = this.inferType(expr);
    if (!this.typesEqual(actualType, expectedType)) {
      throw new Error(
        `Type mismatch: expected ${this.typeToString(expectedType)}, got ${this.typeToString(actualType)}, at ${expr.line}, ${expr.column}`
      );
    }
  }

  private inferType(expr: Expression): Type {
    switch (expr.type) {
      case 'IntegerLiteral':
        return { kind: 'int' };

      case 'FloatLiteral':
        return { kind: 'float' };

      case 'StringLiteral':
        return { kind: 'string' };

      case 'BooleanLiteral':
        return { kind: 'boolean' };

      case 'ArrayLiteral':
        if (expr.elements.length === 0) {
          return { kind: 'array', elementType: { kind: 'any' } };
        }
        const elementType = this.inferType(expr.elements[0]);
        return { kind: 'array', elementType };

      case 'Identifier': {
        // Underscore cannot be used as a value
        if (expr.name === '_') {
          throw new Error(`Underscore (_) cannot be used as a value, at ${expr.line}, ${expr.column}`);
        }
        const type = this.typeEnv.get(expr.name);
        if (!type) {
          throw new Error(`Undefined variable: ${expr.name}, at ${expr.line}, ${expr.column}`);
        }
        return type;
      }

      case 'RangeExpression': {
        // Range expressions can be int..int or string..string
        if (expr.start) {
          const startType = this.inferType(expr.start);
          if (expr.end) {
            const endType = this.inferType(expr.end);
            // Both must be the same type
            if (startType.kind === 'int' && endType.kind === 'int') {
              // Finite integer range returns an array of integers
              return { kind: 'array', elementType: { kind: 'int' } };
            } else if (startType.kind === 'string' && endType.kind === 'string') {
              // String range returns an array of strings
              return { kind: 'array', elementType: { kind: 'string' } };
            } else if (startType.kind === 'any' || endType.kind === 'any') {
              return { kind: 'array', elementType: { kind: 'any' } };
            } else {
              throw new Error(`Range start and end must be the same type (int or string), at ${expr.line}, ${expr.column}`);
            }
          } else {
            // Infinite range (e.g., 0..)
            if (startType.kind === 'int' || startType.kind === 'any') {
              return { kind: 'range' };
            } else {
              throw new Error(`Infinite ranges are only supported for integers, at ${expr.line}, ${expr.column}`);
            }
          }
        } else {
          // Start defaults to 0
          if (expr.end) {
            const endType = this.inferType(expr.end);
            if (endType.kind === 'int' || endType.kind === 'any') {
              return { kind: 'array', elementType: { kind: 'int' } };
            } else {
              throw new Error(`Range with default start (0) requires integer end, at ${expr.line}, ${expr.column}`);
            }
          } else {
            // Both start and end are missing - should not happen
            throw new Error(`Range must have at least a start or end, at ${expr.line}, ${expr.column}`);
          }
        }
      }

      case 'BinaryExpression': {
        const leftType = this.inferType(expr.left);
        const rightType = this.inferType(expr.right);

        if (leftType.kind === 'any' || rightType.kind === 'any') {
          if (['<', '<=', '>', '>=', '==', '!=', '&&', '||'].includes(expr.operator)) {
            return { kind: 'boolean' };
          }
          return { kind: 'any' };
        }

        // Arithmetic operators: +, -, *, % (work on int and float)
        if (['+', '-', '*', '%'].includes(expr.operator)) {
          // int op int = int
          if (leftType.kind === 'int' && rightType.kind === 'int') {
            return { kind: 'int' };
          }
          // float op float = float
          if (leftType.kind === 'float' && rightType.kind === 'float') {
            return { kind: 'float' };
          }
          // int op float = float or float op int = float
          if ((leftType.kind === 'int' || leftType.kind === 'float') &&
            (rightType.kind === 'int' || rightType.kind === 'float')) {
            return { kind: 'float' };
          }
        }

        // Integer division operator: / (requires both operands to be int, returns int)
        if (
          expr.operator === '/' &&
          leftType.kind === 'int' &&
          rightType.kind === 'int'
        ) {
          return { kind: 'int' };
        }

        // Float division operator: /. (works on int or float, returns float)
        if (
          expr.operator === '/.' &&
          (leftType.kind === 'int' || leftType.kind === 'float') &&
          (rightType.kind === 'int' || rightType.kind === 'float')
        ) {
          return { kind: 'float' };
        }

        // Bitwise shift operators: << and >> (require both operands to be int)
        if (
          ['<<', '>>'].includes(expr.operator) &&
          leftType.kind === 'int' &&
          rightType.kind === 'int'
        ) {
          return { kind: 'int' };
        }

        // String concatenation
        if (
          expr.operator === '+' &&
          leftType.kind === 'string' &&
          rightType.kind === 'string'
        ) {
          return { kind: 'string' };
        }

        // Comparison operators (work on int or float)
        if (
          ['<', '<=', '>', '>='].includes(expr.operator) &&
          (leftType.kind === 'int' || leftType.kind === 'float') &&
          (rightType.kind === 'int' || rightType.kind === 'float')
        ) {
          return { kind: 'boolean' };
        }

        // Equality operators
        if (
          ['==', '!='].includes(expr.operator) &&
          this.typesEqual(leftType, rightType)
        ) {
          return { kind: 'boolean' };
        }

        // Logical operators
        if (
          ['&&', '||'].includes(expr.operator) &&
          leftType.kind === 'boolean' &&
          rightType.kind === 'boolean'
        ) {
          return { kind: 'boolean' };
        }

        throw new Error(
          `Invalid binary operation: ${this.typeToString(leftType)} ${expr.operator} ${this.typeToString(rightType)}, at ${expr.line}, ${expr.column}`
        );
      }

      case 'UnaryExpression': {
        const operandType = this.inferType(expr.operand);

        if (operandType.kind === 'any') {
          if (expr.operator === '!') return { kind: 'boolean' };
          return { kind: 'any' };
        }

        if (expr.operator === '-') {
          if (operandType.kind === 'int') {
            return { kind: 'int' };
          } else if (operandType.kind === 'float') {
            return { kind: 'float' };
          }
        }

        if (expr.operator === '!' && operandType.kind === 'boolean') {
          return { kind: 'boolean' };
        }

        throw new Error(
          `Invalid unary operation: ${expr.operator} ${this.typeToString(operandType)}`
        );
      }

      case 'CallExpression': {
        const callee = expr.callee;
        let funcType: Type;

        if (callee.type === 'Identifier') {
          const envType = this.functionEnv.get(callee.name);
          if (envType) {
            funcType = {
              kind: 'function',
              parameters: envType.parameters,
              returnType: envType.returnType,
              variadic: envType.variadic
            };
          } else {
            try {
              // infer for error reporting
              funcType = this.inferType(callee);
            } catch (e) {
              throw new Error(`Undefined function: ${callee.name}, at ${callee.line}, ${callee.column}`);
            }
          }
        } else {
          // infer for error reporting
          funcType = this.inferType(callee);
        }

        if (funcType.kind === 'any') {
          return { kind: 'any' };
        }

        if (funcType.kind !== 'function') {
          throw new Error(`Cannot call non-function type: ${this.typeToString(funcType)}, at ${expr.line}, ${expr.column}`);
        }

        if (funcType.variadic) {
          for (let i = 0; i < expr.arguments.length; i++) {
            if (i < funcType.parameters.length) {
              this.checkExpression(expr.arguments[i], funcType.parameters[i]);
            } else if (funcType.parameters.length > 0) {
              this.checkExpression(expr.arguments[i], funcType.parameters[funcType.parameters.length - 1]);
            } else {
              throw new Error(`Variadic function must have at least one parameter type, at ${expr.line}, ${expr.column}`);
            }
          }
        } else {
          if (expr.arguments.length !== funcType.parameters.length) {
            throw new Error(
              `Function expects ${funcType.parameters.length} arguments, got ${expr.arguments.length}, at ${expr.line}, ${expr.column}`
            );
          }

          for (let i = 0; i < expr.arguments.length; i++) {
            this.checkExpression(expr.arguments[i], funcType.parameters[i]);
          }
        }

        return funcType.returnType;
      }

      case 'MemberExpression': {
        const objectType = this.inferType(expr.object);

        if (objectType.kind === 'any') {
          return { kind: 'any' };
        }

        if (objectType.kind === 'array') {
          if (expr.property.name === 'length') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'push') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
        }

        if (objectType.kind === 'map') {
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'get') {
            return {
              kind: 'function',
              parameters: [objectType.keyType],
              returnType: objectType.valueType,
            };
          }
          if (expr.property.name === 'set') {
            return {
              kind: 'function',
              parameters: [objectType.keyType, objectType.valueType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'keys') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'array', elementType: objectType.keyType },
            };
          }
          if (expr.property.name === 'values') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'array', elementType: objectType.valueType },
            };
          }
          if (expr.property.name === 'entries') {
            // Returns Array<(keyType, valueType)>
            return {
              kind: 'function',
              parameters: [],
              returnType: {
                kind: 'array',
                elementType: {
                  kind: 'tuple',
                  elements: [objectType.keyType, objectType.valueType],
                },
              },
            };
          }
        }

        if (objectType.kind === 'set') {
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'add') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'has') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'delete') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
        }

        if (objectType.kind === 'heap') {
          if (expr.property.name === 'push') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'pop') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.elementType,
            };
          }
          if (expr.property.name === 'peek') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.elementType,
            };
          }
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' }
            };
          }
        }

        if (objectType.kind === 'heapMap') {
          if (expr.property.name === 'push') {
            return {
              kind: 'function',
              parameters: [objectType.keyType, objectType.valueType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'pop') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.keyType,
            };
          }
          if (expr.property.name === 'peek') {
            return {
              kind: 'function',
              parameters: [],
              returnType: objectType.keyType,
            };
          }
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' }
            };
          }
        }

        if (objectType.kind === 'binarytree' || objectType.kind === 'avltree') {
          if (expr.property.name === 'insert') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'search') {
            return {
              kind: 'function',
              parameters: [objectType.elementType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'getHeight') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
        }

        if (objectType.kind === 'graph') {
          if (expr.property.name === 'addVertex') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'addEdge') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType, objectType.nodeType, { kind: 'int' }],
              returnType: { kind: 'void' },
            };
          }
          if (expr.property.name === 'getNeighbors') {
            // Returns Array<{ to: nodeType, weight: int }>
            const edgeRecordType: Type = {
              kind: 'record',
              keyType: { kind: 'string' },
              fields: new Map([
                ['to', objectType.nodeType],
                ['weight', { kind: 'int' }],
              ]),
            };
            return {
              kind: 'function',
              parameters: [objectType.nodeType],
              returnType: {
                kind: 'array',
                elementType: edgeRecordType,
              },
            };
          }
          if (expr.property.name === 'hasVertex') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'hasEdge') {
            return {
              kind: 'function',
              parameters: [objectType.nodeType, objectType.nodeType],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'size') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'int' },
            };
          }
          if (expr.property.name === 'isDirected') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'boolean' },
            };
          }
          if (expr.property.name === 'getEdges') {
            // Returns Array<{ from: nodeType, to: nodeType, weight: int }>
            const edgeWithFromRecordType: Type = {
              kind: 'record',
              keyType: { kind: 'string' },
              fields: new Map([
                ['from', objectType.nodeType],
                ['to', objectType.nodeType],
                ['weight', { kind: 'int' }],
              ]),
            };
            return {
              kind: 'function',
              parameters: [],
              returnType: {
                kind: 'array',
                elementType: edgeWithFromRecordType,
              },
            };
          }
          if (expr.property.name === 'getVertices') {
            return {
              kind: 'function',
              parameters: [],
              returnType: { kind: 'array', elementType: objectType.nodeType },
            };
          }
        }

        throw new Error(
          `Property ${expr.property.name} does not exist on type ${this.typeToString(objectType)}, at ${expr.line}, ${expr.column}`
        );
      }

      case 'IndexExpression': {
        const objectType = this.inferType(expr.object);
        const indexType = this.inferType(expr.index);

        if (objectType.kind === 'any') {
          return { kind: 'any' };
        }

        if (objectType.kind === 'array' && indexType.kind === 'int') {
          return objectType.elementType;
        }

        if (objectType.kind === 'map') {
          this.checkExpression(expr.index, objectType.keyType);
          return objectType.valueType;
        }

        if (objectType.kind === 'tuple') {
          // Tuples are indexed by integers
          if (indexType.kind !== 'int') {
            throw new Error(
              `Cannot index tuple with non-integer type ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
            );
          }

          // For literal integer indices, return the specific element type
          if (expr.index.type === 'IntegerLiteral') {
            const idx = expr.index.value;
            if (idx >= 0 && idx < objectType.elements.length) {
              return objectType.elements[idx];
            }
            throw new Error(
              `Tuple index ${idx} out of bounds (length: ${objectType.elements.length}), at ${expr.line}, ${expr.column}`,
            );
          }

          // For dynamic indexing, return a union of all element types
          if (objectType.elements.length === 0) {
            return { kind: 'any' };
          }
          if (objectType.elements.length === 1) {
            return objectType.elements[0];
          }
          // Check if all elements have the same type
          const firstType = objectType.elements[0];
          const allSame = objectType.elements.every(t => this.typesEqual(t, firstType));
          if (allSame) {
            return firstType;
          }
          return { kind: 'union', types: objectType.elements };
        }

        if (objectType.kind === 'record') {
          // Check that the index type matches the record's key type
          if (!this.typesEqual(indexType, objectType.keyType)) {
            throw new Error(
              `Cannot index record with key type ${this.typeToString(objectType.keyType)} using index type ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
            );
          }

          // For literal keys (string, int, etc.), try to look up the specific field
          if (expr.index.type === 'StringLiteral' && objectType.keyType.kind === 'string') {
            const fieldName = expr.index.value;
            const fieldType = objectType.fields.get(fieldName);
            if (fieldType) {
              return fieldType;
            }
            throw new Error(
              `Field '${fieldName}' does not exist on record type ${this.typeToString(objectType)}, at ${expr.line}, ${expr.column}`,
            );
          }

          // For dynamic indexing, return a union of all possible field types
          const fieldTypes = Array.from(objectType.fields.values());
          if (fieldTypes.length === 0) {
            return { kind: 'any' };
          }
          if (fieldTypes.length === 1) {
            return fieldTypes[0];
          }
          return { kind: 'union', types: fieldTypes };
        }

        throw new Error(
          `Cannot index type ${this.typeToString(objectType)} with ${this.typeToString(indexType)}, at ${expr.line}, ${expr.column}`,
        );
      }

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}, at ${expr.line}, ${expr.column}`);
    }
  }

  private resolveTypeAnnotation(annotation: TypeAnnotation): Type {
    switch (annotation.name) {
      case 'any':
        return { kind: 'any' };
      case 'int':
      case 'number':
        return { kind: 'int' };
      case 'float':
        return { kind: 'float' };
      case 'string':
        return { kind: 'string' };
      case 'bool':
      case 'boolean':
        return { kind: 'boolean' };
      case 'void':
        return { kind: 'void' };

      case 'Array':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          throw new Error(`Array type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
        }
        return {
          kind: 'array',
          elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      case 'Map':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 2
        ) {
          throw new Error(`Map type requires exactly two type parameters, at ${annotation.line}, ${annotation.column}`);
        }
        return {
          kind: 'map',
          keyType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
          valueType: this.resolveTypeAnnotation(annotation.typeParameters[1]),
        };

      case 'Set':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          throw new Error(`Set type requires exactly one type parameter, at ${annotation.line}, ${annotation.column}`);
        }
        return {
          kind: 'set',
          elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      case 'MinHeap':
      case 'MaxHeap':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          return { kind: 'heap', elementType: { kind: 'int' } };
        }
        return {
          kind: 'heap',
          elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      case 'MinHeapMap':
      case 'MaxHeapMap':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 2
        ) {
          return { kind: 'heapMap', keyType: { kind: 'any' }, valueType: { kind: 'any' } };
        }
        return {
          kind: 'heapMap',
          keyType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
          valueType: this.resolveTypeAnnotation(annotation.typeParameters[1]),
        };

      case 'Graph':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          return { kind: 'graph', nodeType: { kind: 'int' } };
        }
        return {
          kind: 'graph',
          nodeType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      case 'BinaryTree':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          return { kind: 'binarytree', elementType: { kind: 'any' } };
        }
        return {
          kind: 'binarytree',
          elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      case 'AVLTree':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          return { kind: 'avltree', elementType: { kind: 'any' } };
        }
        return {
          kind: 'avltree',
          elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      default:
        throw new Error(`Unknown type: ${annotation.name}`);
    }
  }

  private typesEqual(t1: Type, t2: Type): boolean {
    if (t1.kind === 'any' || t2.kind === 'any') return true;
    if (t1.kind !== t2.kind) return false;

    if (t1.kind === 'array' && t2.kind === 'array') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'map' && t2.kind === 'map') {
      return (
        this.typesEqual(t1.keyType, t2.keyType) &&
        this.typesEqual(t1.valueType, t2.valueType)
      );
    }

    if (t1.kind === 'set' && t2.kind === 'set') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'heap' && t2.kind === 'heap') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'heapMap' && t2.kind === 'heapMap') {
      return (
        this.typesEqual(t1.keyType, t2.keyType) &&
        this.typesEqual(t1.valueType, t2.valueType)
      );
    }

    if (t1.kind === 'graph' && t2.kind === 'graph') {
      return this.typesEqual(t1.nodeType, t2.nodeType);
    }

    if (t1.kind === 'binarytree' && t2.kind === 'binarytree') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'avltree' && t2.kind === 'avltree') {
      return this.typesEqual(t1.elementType, t2.elementType);
    }

    if (t1.kind === 'record' && t2.kind === 'record') {
      if (!this.typesEqual(t1.keyType, t2.keyType)) return false;
      if (t1.fields.size !== t2.fields.size) return false;
      for (const [name, type1] of t1.fields.entries()) {
        const type2 = t2.fields.get(name);
        if (!type2 || !this.typesEqual(type1, type2)) return false;
      }
      return true;
    }

    if (t1.kind === 'tuple' && t2.kind === 'tuple') {
      if (t1.elements.length !== t2.elements.length) return false;
      return t1.elements.every((type1, i) => this.typesEqual(type1, t2.elements[i]));
    }

    if (t1.kind === 'union' && t2.kind === 'union') {
      if (t1.types.length !== t2.types.length) return false;
      // For simplicity, check if all types in t1 are in t2 (order independent)
      return t1.types.every((type1) =>
        t2.types.some((type2) => this.typesEqual(type1, type2))
      );
    }

    return true;
  }

  private typeToString(type: Type): string {
    switch (type.kind) {
      case 'any':
        return 'any';
      case 'int':
        return 'int';
      case 'float':
        return 'float';
      case 'string':
        return 'string';
      case 'boolean':
        return 'boolean';
      case 'void':
        return 'void';
      case 'range':
        return 'Range';
      case 'array':
        return `Array<${this.typeToString(type.elementType)}>`;
      case 'map':
        return `Map<${this.typeToString(type.keyType)}, ${this.typeToString(type.valueType)}>`;
      case 'set':
        return `Set<${this.typeToString(type.elementType)}>`;
      case 'binarytree':
        return `BinaryTree<${this.typeToString(type.elementType)}>`;
      case 'avltree':
        return `AVLTree<${this.typeToString(type.elementType)}>`;
      case 'heap':
        return `Heap<${this.typeToString(type.elementType)}>`;
      case 'heapMap':
        return `HeapMap<${this.typeToString(type.keyType)}, ${this.typeToString(type.valueType)}>`;
      case 'graph':
        return `Graph<${this.typeToString(type.nodeType)}>`;
      case 'record': {
        const fields = Array.from(type.fields.entries())
          .map(([name, fieldType]) => `${name}: ${this.typeToString(fieldType)}`)
          .join(', ');
        return `{ ${fields} }`;
      }
      case 'tuple':
        return `(${type.elements.map((t) => this.typeToString(t)).join(', ')})`;
      case 'union':
        return type.types.map((t) => this.typeToString(t)).join(' | ');
      case 'function':
        return `(${type.parameters.map((p) => this.typeToString(p)).join(', ')}) -> ${this.typeToString(type.returnType)}`;
    }
  }
}
