import { Program, Statement, Expression, TypeAnnotation } from './types';

export type Type =
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'void' }
  | { kind: 'array'; elementType: Type }
  | { kind: 'map'; keyType: Type; valueType: Type }
  | { kind: 'set'; elementType: Type }
  | { kind: 'heap'; elementType: Type }
  | { kind: 'graph'; nodeType: Type }
  | {
      kind: 'function';
      parameters: Type[];
      returnType: Type;
    };

export class TypeChecker {
  private typeEnv: Map<string, Type> = new Map();
  private functionEnv: Map<
    string,
    { parameters: Type[]; returnType: Type }
  > = new Map();

  constructor() {
    this.initializeBuiltins();
  }

  private initializeBuiltins(): void {
    // Built-in functions
    this.functionEnv.set('print', {
      parameters: [{ kind: 'string' }],
      returnType: { kind: 'void' },
    });

    this.functionEnv.set('MinHeap', {
      parameters: [],
      returnType: { kind: 'heap', elementType: { kind: 'number' } },
    });

    this.functionEnv.set('MaxHeap', {
      parameters: [],
      returnType: { kind: 'heap', elementType: { kind: 'number' } },
    });

    this.functionEnv.set('Graph', {
      parameters: [],
      returnType: { kind: 'graph', nodeType: { kind: 'number' } },
    });

    this.functionEnv.set('Map', {
      parameters: [],
      returnType: {
        kind: 'map',
        keyType: { kind: 'number' },
        valueType: { kind: 'number' },
      },
    });

    this.functionEnv.set('Set', {
      parameters: [],
      returnType: { kind: 'set', elementType: { kind: 'number' } },
    });
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
            : { kind: 'number' }
        );

        const returnType: Type = stmt.returnType
          ? this.resolveTypeAnnotation(stmt.returnType)
          : { kind: 'void' };

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
        let varType: Type;

        if (stmt.initializer) {
          varType = this.inferType(stmt.initializer);
        } else if (stmt.typeAnnotation) {
          varType = this.resolveTypeAnnotation(stmt.typeAnnotation);
        } else {
          throw new Error(
            `Variable ${stmt.name} must have either type annotation or initializer`
          );
        }

        this.typeEnv.set(stmt.name, varType);
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
          iterableType.kind !== 'map'
        ) {
          throw new Error(
            `Cannot iterate over non-iterable type ${iterableType.kind}`
          );
        }

        const savedEnv = new Map(this.typeEnv);

        if (iterableType.kind === 'array' || iterableType.kind === 'set') {
          this.typeEnv.set(stmt.variable, iterableType.elementType);
        } else {
          this.typeEnv.set(stmt.variable, iterableType.keyType);
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
        `Type mismatch: expected ${this.typeToString(expectedType)}, got ${this.typeToString(actualType)}`
      );
    }
  }

  private inferType(expr: Expression): Type {
    switch (expr.type) {
      case 'NumberLiteral':
        return { kind: 'number' };

      case 'StringLiteral':
        return { kind: 'string' };

      case 'BooleanLiteral':
        return { kind: 'boolean' };

      case 'ArrayLiteral':
        if (expr.elements.length === 0) {
          return { kind: 'array', elementType: { kind: 'number' } };
        }
        const elementType = this.inferType(expr.elements[0]);
        return { kind: 'array', elementType };

      case 'Identifier': {
        const type = this.typeEnv.get(expr.name);
        if (!type) {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        return type;
      }

      case 'BinaryExpression': {
        const leftType = this.inferType(expr.left);
        const rightType = this.inferType(expr.right);

        if (
          ['+', '-', '*', '/', '%'].includes(expr.operator) &&
          leftType.kind === 'number' &&
          rightType.kind === 'number'
        ) {
          return { kind: 'number' };
        }

        if (
          expr.operator === '+' &&
          leftType.kind === 'string' &&
          rightType.kind === 'string'
        ) {
          return { kind: 'string' };
        }

        if (
          ['==', '!=', '<', '<=', '>', '>='].includes(expr.operator) &&
          this.typesEqual(leftType, rightType)
        ) {
          return { kind: 'boolean' };
        }

        if (
          ['&&', '||'].includes(expr.operator) &&
          leftType.kind === 'boolean' &&
          rightType.kind === 'boolean'
        ) {
          return { kind: 'boolean' };
        }

        throw new Error(
          `Invalid binary operation: ${this.typeToString(leftType)} ${expr.operator} ${this.typeToString(rightType)}`
        );
      }

      case 'UnaryExpression': {
        const operandType = this.inferType(expr.operand);

        if (expr.operator === '-' && operandType.kind === 'number') {
          return { kind: 'number' };
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
        if (callee.type === 'Identifier') {
          const funcType = this.functionEnv.get(callee.name);
          if (!funcType) {
            throw new Error(`Undefined function: ${callee.name}`);
          }

          if (expr.arguments.length !== funcType.parameters.length) {
            throw new Error(
              `Function ${callee.name} expects ${funcType.parameters.length} arguments, got ${expr.arguments.length}`
            );
          }

          for (let i = 0; i < expr.arguments.length; i++) {
            this.checkExpression(expr.arguments[i], funcType.parameters[i]);
          }

          return funcType.returnType;
        }
        throw new Error('Only identifier call expressions are supported');
      }

      case 'MemberExpression': {
        const objectType = this.inferType(expr.object);

        if (objectType.kind === 'array') {
          if (expr.property.name === 'length') {
            return { kind: 'number' };
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
            return { kind: 'number' };
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
        }

        throw new Error(
          `Property ${expr.property.name} does not exist on type ${this.typeToString(objectType)}`
        );
      }

      case 'IndexExpression': {
        const objectType = this.inferType(expr.object);
        const indexType = this.inferType(expr.index);

        if (objectType.kind === 'array' && indexType.kind === 'number') {
          return objectType.elementType;
        }

        if (objectType.kind === 'map') {
          this.checkExpression(expr.index, objectType.keyType);
          return objectType.valueType;
        }

        throw new Error(
          `Cannot index type ${this.typeToString(objectType)} with ${this.typeToString(indexType)}`
        );
      }

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private resolveTypeAnnotation(annotation: TypeAnnotation): Type {
    switch (annotation.name) {
      case 'int':
      case 'number':
        return { kind: 'number' };
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
          throw new Error('Array type requires exactly one type parameter');
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
          throw new Error('Map type requires exactly two type parameters');
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
          throw new Error('Set type requires exactly one type parameter');
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
          return { kind: 'heap', elementType: { kind: 'number' } };
        }
        return {
          kind: 'heap',
          elementType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      case 'Graph':
        if (
          !annotation.typeParameters ||
          annotation.typeParameters.length !== 1
        ) {
          return { kind: 'graph', nodeType: { kind: 'number' } };
        }
        return {
          kind: 'graph',
          nodeType: this.resolveTypeAnnotation(annotation.typeParameters[0]),
        };

      default:
        throw new Error(`Unknown type: ${annotation.name}`);
    }
  }

  private typesEqual(t1: Type, t2: Type): boolean {
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

    if (t1.kind === 'graph' && t2.kind === 'graph') {
      return this.typesEqual(t1.nodeType, t2.nodeType);
    }

    return true;
  }

  private typeToString(type: Type): string {
    switch (type.kind) {
      case 'number':
        return 'number';
      case 'string':
        return 'string';
      case 'boolean':
        return 'boolean';
      case 'void':
        return 'void';
      case 'array':
        return `Array<${this.typeToString(type.elementType)}>`;
      case 'map':
        return `Map<${this.typeToString(type.keyType)}, ${this.typeToString(type.valueType)}>`;
      case 'set':
        return `Set<${this.typeToString(type.elementType)}>`;
      case 'heap':
        return `Heap<${this.typeToString(type.elementType)}>`;
      case 'graph':
        return `Graph<${this.typeToString(type.nodeType)}>`;
      case 'function':
        return `(${type.parameters.map((p) => this.typeToString(p)).join(', ')}) -> ${this.typeToString(type.returnType)}`;
    }
  }
}
