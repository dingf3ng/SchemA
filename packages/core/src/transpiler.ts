import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { SchemAVisitor } from './generated/src/SchemAVisitor';
import {
  ProgramContext,
  StatementContext,
  FunctionDeclarationContext,
  VariableDeclarationContext,
  AssignmentStatementContext,
  IfStatementContext,
  WhileStatementContext,
  UntilStatementContext,
  ForStatementContext,
  ReturnStatementContext,
  BlockStatementContext,
  ExpressionStatementContext,
  ExpressionContext,
  LogicalOrContext,
  LogicalAndContext,
  EqualityContext,
  ComparisonContext,
  RangeContext,
  AdditionContext,
  MultiplicationContext,
  UnaryContext,
  PostfixContext,
  NumberLiteralContext,
  StringLiteralContext,
  TrueLiteralContext,
  FalseLiteralContext,
  IdentifierContext,
  ArrayLiteralExprContext,
  ParenExprContext,
  ArrayLiteralContext,
  ParameterContext,
  TypeAnnotationContext,
  UnionTypeContext,
  IntersectionTypeContext,
  PrimaryTypeContext,
  PostfixOpContext,
  CallOpContext,
  MemberOpContext,
  IndexOpContext,
  BlockContext,
  TypeOfExprContext,
  PolyTypeIdentifierContext,
  MetaStatementContext,
  InvariantStatementContext,
  AssertStatementContext,
} from './generated/src/SchemAParser';
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
  ExpressionStatement,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  IndexExpression,
  Identifier,
  IntegerLiteral,
  FloatLiteral,
  StringLiteral,
  BooleanLiteral,
  ArrayLiteral,
  TypeOfExpression,
  InvariantStatement,
  AssertStatement,
  TypeAnnotation as ASTTypeAnnotation,
  Parameter as ASTParameter,
} from './types';

export class ASTBuilder extends AbstractParseTreeVisitor<any> implements SchemAVisitor<any> {
  protected defaultResult(): any {
    return null;
  }

  visitProgram(ctx: ProgramContext): Program {
    const statements = ctx.statement().map(stmt => this.visit(stmt));
    return {
      type: 'Program',
      body: statements,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitStatement(ctx: StatementContext): Statement {
    if (ctx.functionDeclaration()) {
      return this.visit(ctx.functionDeclaration()!);
    }
    if (ctx.variableDeclaration()) {
      return this.visit(ctx.variableDeclaration()!);
    }
    if (ctx.assignmentStatement()) {
      return this.visit(ctx.assignmentStatement()!);
    }
    if (ctx.ifStatement()) {
      return this.visit(ctx.ifStatement()!);
    }
    if (ctx.whileStatement()) {
      return this.visit(ctx.whileStatement()!);
    }
    if (ctx.untilStatement()) {
      return this.visit(ctx.untilStatement()!);
    }
    if (ctx.forStatement()) {
      return this.visit(ctx.forStatement()!);
    }
    if (ctx.returnStatement()) {
      return this.visit(ctx.returnStatement()!);
    }
    if (ctx.blockStatement()) {
      return this.visit(ctx.blockStatement()!);
    }
    if (ctx.metaStatement()) {
      return this.visit(ctx.metaStatement()!);
    }
    if (ctx.expressionStatement()) {
      return this.visit(ctx.expressionStatement()!);
    }
    throw new Error('Unknown statement type');
  }

  visitFunctionDeclaration(ctx: FunctionDeclarationContext): FunctionDeclaration {
    const name = ctx.IDENTIFIER().text;
    const parameters: ASTParameter[] = ctx.parameterList()
      ? ctx.parameterList()!.parameter().map(p => this.visit(p))
      : [];
    const returnType = ctx.typeAnnotation() ? this.visit(ctx.typeAnnotation()!) : undefined;
    const body = this.visit(ctx.block());

    return {
      type: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitParameter(ctx: ParameterContext): ASTParameter {
    const name = ctx.IDENTIFIER().text;
    const typeAnnotation = ctx.typeAnnotation() ? this.visit(ctx.typeAnnotation()!) : undefined;
    return { name, typeAnnotation };
  }

  visitTypeAnnotation(ctx: TypeAnnotationContext): ASTTypeAnnotation {
    return this.visit(ctx.unionType());
  }

  visitUnionType(ctx: UnionTypeContext): ASTTypeAnnotation {
    const types = ctx.intersectionType().map(t => this.visit(t));
    if (types.length === 1) {
      return types[0];
    }
    return {
      type: 'TypeAnnotation',
      kind: 'union',
      types,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitIntersectionType(ctx: IntersectionTypeContext): ASTTypeAnnotation {
    const types = ctx.primaryType().map(t => this.visit(t));
    if (types.length === 1) {
      return types[0];
    }
    return {
      type: 'TypeAnnotation',
      kind: 'intersection',
      types,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitPrimaryType(ctx: PrimaryTypeContext): ASTTypeAnnotation {
    if (ctx.childCount === 3 && ctx.getChild(0).text === '(') {
       return this.visit(ctx.typeAnnotation(0));
    }

    const name = ctx.POLY_TYPE_ID() ? ctx.POLY_TYPE_ID()!.text : ctx.IDENTIFIER()!.text;
    const typeParameters = ctx.typeAnnotation().length > 0
      ? ctx.typeAnnotation().map(t => this.visit(t))
      : undefined;

    if (!typeParameters) {
      return {
        type: 'TypeAnnotation',
        kind: 'simple',
        name,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    } else {
      return {
        type: 'TypeAnnotation',
        kind: 'generic',
        name,
        typeParameters,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
  }

  visitVariableDeclaration(ctx: VariableDeclarationContext): VariableDeclaration {
    const declarators = ctx.variableDeclarator().map(declaratorCtx => this.visit(declaratorCtx));

    return {
      type: 'VariableDeclaration',
      declarations: declarators,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitVariableDeclarator(ctx: any): any {
    const name = ctx.IDENTIFIER().text;
    const typeAnnotation = ctx.typeAnnotation() ? this.visit(ctx.typeAnnotation()!) : undefined;
    const initializer = ctx.expression() ? this.visit(ctx.expression()!) : undefined;

    return {
      name,
      typeAnnotation,
      initializer,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitAssignmentStatement(ctx: AssignmentStatementContext): AssignmentStatement {
    const target = this.visit(ctx.assignmentTarget());
    const value = this.visit(ctx.expression());

    return {
      type: 'AssignmentStatement',
      target,
      value,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitIfStatement(ctx: IfStatementContext): IfStatement {
    const condition = this.visit(ctx.expression());
    const statements = ctx.statement();
    const thenBranch = this.visit(statements[0]);
    const elseBranch = statements.length > 1 ? this.visit(statements[1]) : undefined;

    return {
      type: 'IfStatement',
      condition,
      thenBranch,
      elseBranch,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitWhileStatement(ctx: WhileStatementContext): WhileStatement {
    const condition = this.visit(ctx.expression());
    const body = this.visit(ctx.statement());

    return {
      type: 'WhileStatement',
      condition,
      body,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitUntilStatement(ctx: UntilStatementContext): UntilStatement {
    const condition = this.visit(ctx.expression());
    const body = this.visit(ctx.statement());

    return {
      type: 'UntilStatement',
      condition,
      body,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitForStatement(ctx: ForStatementContext): ForStatement {
    const variable = ctx.IDENTIFIER().text;
    const iterable = this.visit(ctx.expression());
    const body = this.visit(ctx.statement());

    return {
      type: 'ForStatement',
      variable,
      iterable,
      body,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitReturnStatement(ctx: ReturnStatementContext): ReturnStatement {
    const value = ctx.expression() ? this.visit(ctx.expression()!) : undefined;

    return {
      type: 'ReturnStatement',
      value,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitBlockStatement(ctx: BlockStatementContext): BlockStatement {
    return this.visit(ctx.block());
  }

  visitBlock(ctx: BlockContext): BlockStatement {
    const statements = ctx.statement().map(stmt => this.visit(stmt));

    return {
      type: 'BlockStatement',
      statements,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitExpressionStatement(ctx: ExpressionStatementContext): ExpressionStatement {
    const expression = this.visit(ctx.expression());

    return {
      type: 'ExpressionStatement',
      expression,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitExpression(ctx: ExpressionContext): Expression {
    return this.visit(ctx.logicalOr());
  }

  visitLogicalOr(ctx: LogicalOrContext): Expression {
    const children = ctx.logicalAnd();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      expr = {
        type: 'BinaryExpression',
        operator: '||',
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitLogicalAnd(ctx: LogicalAndContext): Expression {
    const children = ctx.equality();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      expr = {
        type: 'BinaryExpression',
        operator: '&&',
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitEquality(ctx: EqualityContext): Expression {
    const children = ctx.comparison();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      const opIndex = i - 1;
      const operator = ctx.getChild(opIndex * 2 + 1).text;
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitComparison(ctx: ComparisonContext): Expression {
    const children = ctx.range();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      const opIndex = i - 1;
      const operator = ctx.getChild(opIndex * 2 + 1).text;
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitRange(ctx: RangeContext): Expression {
    const children = ctx.shift();
    
    // Check if we have an operator (childCount > 1 means we have at least start and operator)
    if (ctx.childCount > 1) {
        const start = this.visit(children[0]);
        const end = children.length > 1 ? this.visit(children[1]) : undefined;

        // Check which operator was used
        const operatorNode = ctx.getChild(1);
        const operatorText = operatorNode.text;
        const inclusive = operatorText === '...';

        return {
          type: 'RangeExpression',
          start,
          end,
          inclusive,
          line: ctx.start.line,
          column: ctx.start.charPositionInLine + 1,
        };
    }

    if (children.length === 1) {
      return this.visit(children[0]);
    }
    
    throw new Error('Invalid range expression');
  }

  visitShift(ctx: any): Expression {
    const children = ctx.addition();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      const opIndex = i - 1;
      const operator = ctx.getChild(opIndex * 2 + 1).text;
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitAddition(ctx: AdditionContext): Expression {
    const children = ctx.multiplication();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      const opIndex = i - 1;
      const operator = ctx.getChild(opIndex * 2 + 1).text;
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitMultiplication(ctx: MultiplicationContext): Expression {
    const children = ctx.unary();
    if (children.length === 1) {
      return this.visit(children[0]);
    }

    let expr = this.visit(children[0]);
    for (let i = 1; i < children.length; i++) {
      const opIndex = i - 1;
      const operator = ctx.getChild(opIndex * 2 + 1).text;
      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    return expr;
  }

  visitUnary(ctx: UnaryContext): Expression {
    // Delegate to the appropriate labeled alternative
    return this.visitChildren(ctx);
  }

  visitUnaryOp(ctx: any): Expression {
    // It's a unary operator followed by another unary expression
    const operator = ctx.getChild(0).text;
    // Get the nested unary expression
    const nestedUnary = ctx.unary();
    const operand = this.visit(nestedUnary);

    return {
      type: 'UnaryExpression',
      operator,
      operand,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitTypeOfExpr(ctx: TypeOfExprContext): Expression {
    // typeof followed by a unary expression
    const operand = this.visit(ctx.unary());

    return {
      type: 'TypeOfExpression',
      operand,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitPrefixRange(ctx: any): Expression {
    // Handle prefix range like ..3 or ...5
    const operator = ctx.getChild(0).text;
    const inclusive = operator === '...';
    const end = this.visit(ctx.shift());

    return {
      type: 'RangeExpression',
      start: undefined,  // No start means default to 0
      end,
      inclusive,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitPostfixExpr(ctx: any): Expression {
    return this.visit(ctx.postfix());
  }

  visitPostfix(ctx: PostfixContext): Expression {
    let expr = this.visit(ctx.primary());

    for (const op of ctx.postfixOp()) {
      if (op instanceof CallOpContext) {
        const args = op.argumentList()
          ? op.argumentList()!.expression().map(e => this.visit(e))
          : [];
        expr = {
          type: 'CallExpression',
          callee: expr,
          arguments: args,
          line: ctx.start.line,
          column: ctx.start.charPositionInLine + 1,
        };
      } else if (op instanceof MemberOpContext) {
        const property: Identifier = {
          type: 'Identifier',
          name: op.IDENTIFIER().text,
          line: op.start.line,
          column: op.start.charPositionInLine + 1,
        };
        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          line: ctx.start.line,
          column: ctx.start.charPositionInLine + 1,
        };
      } else if (op instanceof IndexOpContext) {
        const index = this.visit(op.expression());
        expr = {
          type: 'IndexExpression',
          object: expr,
          index,
          line: ctx.start.line,
          column: ctx.start.charPositionInLine + 1,
        };
      }
    }

    return expr;
  }

  visitNumberLiteral(ctx: NumberLiteralContext): IntegerLiteral | FloatLiteral {
    const value = parseFloat(ctx.NUMBER().text);
    if (Number.isInteger(value)) {
      return {
        type: 'IntegerLiteral',
        value,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    } else {
      return {
        type: 'FloatLiteral',
        value,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
  }

  visitStringLiteral(ctx: StringLiteralContext): StringLiteral {
    const text = ctx.STRING().text;
    // Remove quotes and handle escape sequences
    const value = this.unescapeString(text.slice(1, -1));
    return {
      type: 'StringLiteral',
      value,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  private unescapeString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }

  visitTrueLiteral(ctx: TrueLiteralContext): BooleanLiteral {
    return {
      type: 'BooleanLiteral',
      value: true,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitFalseLiteral(ctx: FalseLiteralContext): BooleanLiteral {
    return {
      type: 'BooleanLiteral',
      value: false,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitMetaStatement(ctx: MetaStatementContext): Statement {
    if (ctx.invariantStatement()) {
      return this.visit(ctx.invariantStatement()!);
    }
    if (ctx.assertStatement()) {
      return this.visit(ctx.assertStatement()!);
    }
    throw new Error('Unknown meta statement type');
  }

  visitInvariantStatement(ctx: InvariantStatementContext): InvariantStatement {
    // @invariant(condition) or @invariant(condition, message)
    const expressions = ctx.expression();
    const condition = this.visit(expressions[0]);
    const message = expressions.length > 1 ? this.visit(expressions[1]) : undefined;

    return {
      type: 'InvariantStatement',
      condition,
      message,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitAssertStatement(ctx: AssertStatementContext): AssertStatement {
    // @assert(condition) or @assert(condition, message)
    const expressions = ctx.expression();
    const condition = this.visit(expressions[0]);
    const message = expressions.length > 1 ? this.visit(expressions[1]) : undefined;

    return {
      type: 'AssertStatement',
      condition,
      message,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitIdentifier(ctx: IdentifierContext): Identifier {
    return {
      type: 'Identifier',
      name: ctx.IDENTIFIER().text,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitPolyTypeIdentifier(ctx: PolyTypeIdentifierContext): Identifier {
    return {
      type: 'Identifier',
      name: ctx.POLY_TYPE_ID().text,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitArrayLiteralExpr(ctx: ArrayLiteralExprContext): ArrayLiteral {
    return this.visit(ctx.arrayLiteral());
  }

  visitArrayLiteral(ctx: ArrayLiteralContext): ArrayLiteral {
    const elements = ctx.expression().map(e => this.visit(e));
    return {
      type: 'ArrayLiteral',
      elements,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitParenExpr(ctx: ParenExprContext): Expression {
    return this.visit(ctx.expression());
  }

  visitAssignmentTarget(ctx: any): Expression {
    // assignmentTarget can be IDENTIFIER, memberExpression, or indexExpression
    if (ctx.IDENTIFIER()) {
      return {
        type: 'Identifier',
        name: ctx.IDENTIFIER().text,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }
    if (ctx.memberExpression()) {
      return this.visit(ctx.memberExpression());
    }
    if (ctx.indexExpression()) {
      return this.visit(ctx.indexExpression());
    }
    throw new Error('Unknown assignment target type');
  }

  visitMemberExpression(ctx: any): MemberExpression {
    let object: Expression = this.visit(ctx.primary());
    const identifiers = ctx.IDENTIFIER();

    // Build nested member expressions for chained property access
    for (let i = 0; i < identifiers.length; i++) {
      const property: Identifier = {
        type: 'Identifier',
        name: identifiers[i].text,
        line: identifiers[i].symbol.line,
        column: identifiers[i].symbol.charPositionInLine + 1,
      };

      object = {
        type: 'MemberExpression',
        object,
        property,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }

    return object as MemberExpression;
  }

  visitIndexExpression(ctx: any): IndexExpression {
    const object = this.visit(ctx.primary());
    const index = this.visit(ctx.expression());

    return {
      type: 'IndexExpression',
      object,
      index,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }
}
