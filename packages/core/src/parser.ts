import { Token, TokenType } from './types';
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
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  IndexExpression,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ArrayLiteral,
  MapLiteral,
  SetLiteral,
  TypeAnnotation,
  Parameter,
} from './types';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(`${message} at ${token.line}:${token.column}`);
  }

  public parse(): Program {
    const statements: Statement[] = [];

    while (!this.isAtEnd()) {
      statements.push(this.declaration());
    }

    return {
      type: 'Program',
      body: statements,
      line: 1,
      column: 1,
    };
  }

  private declaration(): Statement {
    if (this.match('FN')) return this.functionDeclaration();
    if (this.match('LET')) return this.variableDeclaration();
    return this.statement();
  }

  private functionDeclaration(): FunctionDeclaration {
    const token = this.previous();
    const name = this.consume('IDENTIFIER', 'Expected function name').value;

    this.consume('LPAREN', "Expected '(' after function name");

    const parameters: Parameter[] = [];
    if (!this.check('RPAREN')) {
      do {
        const paramName = this.consume('IDENTIFIER', 'Expected parameter name')
          .value;
        let typeAnnotation: TypeAnnotation | undefined;

        if (this.match('COLON')) {
          typeAnnotation = this.typeAnnotation();
        }

        parameters.push({ name: paramName, typeAnnotation });
      } while (this.match('COMMA'));
    }

    this.consume('RPAREN', "Expected ')' after parameters");

    let returnType: TypeAnnotation | undefined;
    if (this.match('ARROW')) {
      returnType = this.typeAnnotation();
    }

    this.consume('LBRACE', "Expected '{' before function body");
    const body = this.blockStatement();

    return {
      type: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body,
      line: token.line,
      column: token.column,
    };
  }

  private variableDeclaration(): VariableDeclaration {
    const token = this.previous();
    const name = this.consume('IDENTIFIER', 'Expected variable name').value;

    let typeAnnotation: TypeAnnotation | undefined;
    if (this.match('COLON')) {
      typeAnnotation = this.typeAnnotation();
    }

    let initializer: Expression | undefined;
    if (this.match('EQ')) {
      initializer = this.expression();
    }

    return {
      type: 'VariableDeclaration',
      name,
      typeAnnotation,
      initializer,
      line: token.line,
      column: token.column,
    };
  }

  private typeAnnotation(): TypeAnnotation {
    const token = this.consume('IDENTIFIER', 'Expected type name');
    const typeParameters: TypeAnnotation[] = [];

    if (this.match('LESS')) {
      do {
        typeParameters.push(this.typeAnnotation());
      } while (this.match('COMMA'));
      this.consume('GREATER', "Expected '>' after type parameters");
    }

    return {
      type: 'TypeAnnotation',
      name: token.value,
      typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
      line: token.line,
      column: token.column,
    };
  }

  private statement(): Statement {
    if (this.match('IF')) return this.ifStatement();
    if (this.match('WHILE')) return this.whileStatement();
    if (this.match('FOR')) return this.forStatement();
    if (this.match('RETURN')) return this.returnStatement();
    if (this.match('LBRACE')) return this.blockStatement();
    return this.expressionStatement();
  }

  private ifStatement(): IfStatement {
    const token = this.previous();
    const condition = this.expression();
    const thenBranch = this.statement();
    let elseBranch: Statement | undefined;

    if (this.match('ELSE')) {
      elseBranch = this.statement();
    }

    return {
      type: 'IfStatement',
      condition,
      thenBranch,
      elseBranch,
      line: token.line,
      column: token.column,
    };
  }

  private whileStatement(): WhileStatement {
    const token = this.previous();
    const condition = this.expression();
    const body = this.statement();

    return {
      type: 'WhileStatement',
      condition,
      body,
      line: token.line,
      column: token.column,
    };
  }

  private forStatement(): ForStatement {
    const token = this.previous();
    const variable = this.consume('IDENTIFIER', 'Expected variable name').value;
    this.consume('IN', "Expected 'in' after variable");
    const iterable = this.expression();
    const body = this.statement();

    return {
      type: 'ForStatement',
      variable,
      iterable,
      body,
      line: token.line,
      column: token.column,
    };
  }

  private returnStatement(): ReturnStatement {
    const token = this.previous();
    let value: Expression | undefined;

    if (!this.check('RBRACE') && !this.isAtEnd()) {
      value = this.expression();
    }

    return {
      type: 'ReturnStatement',
      value,
      line: token.line,
      column: token.column,
    };
  }

  private blockStatement(): BlockStatement {
    const token = this.previous();
    const statements: Statement[] = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      statements.push(this.declaration());
    }

    this.consume('RBRACE', "Expected '}' after block");

    return {
      type: 'BlockStatement',
      statements,
      line: token.line,
      column: token.column,
    };
  }

  private expressionStatement(): Statement {
    const expr = this.expression();

    // Check if this is an assignment
    if (this.match('EQ')) {
      const value = this.expression();
      return {
        type: 'AssignmentStatement',
        target: expr,
        value,
        line: expr.line,
        column: expr.column,
      };
    }

    return {
      type: 'ExpressionStatement',
      expression: expr,
      line: expr.line,
      column: expr.column,
    };
  }

  private expression(): Expression {
    return this.logicalOr();
  }

  private logicalOr(): Expression {
    let expr = this.logicalAnd();

    while (this.match('OR')) {
      const operator = this.previous();
      const right = this.logicalAnd();
      expr = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expr,
        right,
        line: operator.line,
        column: operator.column,
      };
    }

    return expr;
  }

  private logicalAnd(): Expression {
    let expr = this.equality();

    while (this.match('AND')) {
      const operator = this.previous();
      const right = this.equality();
      expr = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expr,
        right,
        line: operator.line,
        column: operator.column,
      };
    }

    return expr;
  }

  private equality(): Expression {
    let expr = this.comparison();

    while (this.match('EQEQ', 'NEQ')) {
      const operator = this.previous();
      const right = this.comparison();
      expr = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expr,
        right,
        line: operator.line,
        column: operator.column,
      };
    }

    return expr;
  }

  private comparison(): Expression {
    let expr = this.addition();

    while (this.match('LT', 'LTE', 'GT', 'GTE')) {
      const operator = this.previous();
      const right = this.addition();
      expr = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expr,
        right,
        line: operator.line,
        column: operator.column,
      };
    }

    return expr;
  }

  private addition(): Expression {
    let expr = this.multiplication();

    while (this.match('PLUS', 'MINUS')) {
      const operator = this.previous();
      const right = this.multiplication();
      expr = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expr,
        right,
        line: operator.line,
        column: operator.column,
      };
    }

    return expr;
  }

  private multiplication(): Expression {
    let expr = this.unary();

    while (this.match('STAR', 'SLASH', 'PERCENT')) {
      const operator = this.previous();
      const right = this.unary();
      expr = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expr,
        right,
        line: operator.line,
        column: operator.column,
      };
    }

    return expr;
  }

  private unary(): Expression {
    if (this.match('NOT', 'MINUS')) {
      const operator = this.previous();
      const operand = this.unary();
      return {
        type: 'UnaryExpression',
        operator: operator.value,
        operand,
        line: operator.line,
        column: operator.column,
      };
    }

    return this.postfix();
  }

  private postfix(): Expression {
    let expr = this.primary();

    while (true) {
      if (this.match('LPAREN')) {
        expr = this.finishCall(expr);
      } else if (this.match('DOT')) {
        const property = this.consume('IDENTIFIER', 'Expected property name');
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: {
            type: 'Identifier',
            name: property.value,
            line: property.line,
            column: property.column,
          },
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match('LBRACKET')) {
        const index = this.expression();
        this.consume('RBRACKET', "Expected ']' after index");
        expr = {
          type: 'IndexExpression',
          object: expr,
          index,
          line: expr.line,
          column: expr.column,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: Expression): CallExpression {
    const args: Expression[] = [];

    if (!this.check('RPAREN')) {
      do {
        args.push(this.expression());
      } while (this.match('COMMA'));
    }

    this.consume('RPAREN', "Expected ')' after arguments");

    return {
      type: 'CallExpression',
      callee,
      arguments: args,
      line: callee.line,
      column: callee.column,
    };
  }

  private primary(): Expression {
    if (this.match('TRUE')) {
      const token = this.previous();
      return {
        type: 'BooleanLiteral',
        value: true,
        line: token.line,
        column: token.column,
      };
    }

    if (this.match('FALSE')) {
      const token = this.previous();
      return {
        type: 'BooleanLiteral',
        value: false,
        line: token.line,
        column: token.column,
      };
    }

    if (this.match('NUMBER')) {
      const token = this.previous();
      return {
        type: 'NumberLiteral',
        value: parseFloat(token.value),
        line: token.line,
        column: token.column,
      };
    }

    if (this.match('STRING')) {
      const token = this.previous();
      return {
        type: 'StringLiteral',
        value: token.value,
        line: token.line,
        column: token.column,
      };
    }

    if (this.match('IDENTIFIER')) {
      const token = this.previous();
      return {
        type: 'Identifier',
        name: token.value,
        line: token.line,
        column: token.column,
      };
    }

    if (this.match('LBRACKET')) {
      return this.arrayLiteral();
    }

    if (this.match('LPAREN')) {
      const expr = this.expression();
      this.consume('RPAREN', "Expected ')' after expression");
      return expr;
    }

    const token = this.peek();
    throw new Error(
      `Unexpected token '${token.value}' at ${token.line}:${token.column}`
    );
  }

  private arrayLiteral(): ArrayLiteral {
    const token = this.previous();
    const elements: Expression[] = [];

    if (!this.check('RBRACKET')) {
      do {
        elements.push(this.expression());
      } while (this.match('COMMA'));
    }

    this.consume('RBRACKET', "Expected ']' after array elements");

    return {
      type: 'ArrayLiteral',
      elements,
      line: token.line,
      column: token.column,
    };
  }
}
