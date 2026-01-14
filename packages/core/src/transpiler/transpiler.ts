import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { SchemAVisitor } from '../generated/src/SchemAVisitor';
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
  MapLiteralContext,
  MapLiteralExprContext,
  MapEntryContext,
  SetLiteralContext,
  SetLiteralExprContext,
  TupleLiteralContext,
  TupleLiteralExprContext,
  RecordLiteralContext,
  RecordLiteralExprContext,
  RecordEntryContext,
  ParenExprContext,
  ArrayLiteralContext,
  ParameterContext,
  TypeAnnotationContext,
  PrimaryTypeContext,
  CallOpContext,
  MemberOpContext,
  IndexOpContext,
  BlockContext,
  TypeOfExprContext,
  PolyTypeIdentifierContext,
  MetaStatementContext,
  InvariantStatementContext,
  AssertStatementContext,
  MetaIdentifierContext,
} from '../generated/src/SchemAParser';
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
  MemberExpression,
  IndexExpression,
  Identifier,
  IntegerLiteral,
  FloatLiteral,
  StringLiteral,
  BooleanLiteral,
  ArrayLiteral,
  InvariantStatement,
  AssertStatement,
  TypeAnnotation as ASTTypeAnnotation,
  Parameter as ASTParameter,
  MetaIdentifier,
  SetLiteral,
  MapLiteral,
  TupleLiteral,
  RecordLiteral,
} from './ast-types';

class ASTBuilder extends AbstractParseTreeVisitor<any> implements SchemAVisitor<any> {
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
    return this.visit(ctx.primaryType());
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
    let value = this.visit(ctx.expression());

    const assignmentOp = ctx.assignmentOperator();

    // Handle >>= which is parsed as GT GTE
    if (assignmentOp.GT() && assignmentOp.GTE()) {
      value = {
        type: 'BinaryExpression',
        operator: '>>',
        left: target,
        right: value,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    } else {
      const binaryOp = assignmentOp.binaryOperator();

      if (binaryOp) {
        let operator = binaryOp.text;
        // Normalize >> (GT GT)
        if (operator.replace(/\s/g, '') === '>>') {
          operator = '>>';
        }

        value = {
          type: 'BinaryExpression',
          operator,
          left: target,
          right: value,
          line: ctx.start.line,
          column: ctx.start.charPositionInLine + 1,
        };
      }
    }

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
    return this.visit(ctx.predicateCheck());
  }

  visitPredicateCheck(ctx: any): Expression {
    const subject = this.visit(ctx.logicalOr());

    // Check if there's a turnstile operator
    if (ctx.META_IDENTIFIER && ctx.META_IDENTIFIER()) {
      const predicateName = ctx.META_IDENTIFIER().text;
      let predicateArgs: Expression[] | undefined;

      // Check if there are arguments
      if (ctx.argumentList && ctx.argumentList()) {
        const argList = ctx.argumentList();
        predicateArgs = argList.expression().map((e: any) => this.visit(e));
      }

      return {
        type: 'PredicateCheckExpression',
        subject,
        predicateName,
        predicateArgs,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    }

    return subject;
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
    let currentChildIndex = 1;

    for (let i = 1; i < children.length; i++) {
      let operator = ctx.getChild(currentChildIndex).text;

      if (operator === '>') {
        const next = ctx.getChild(currentChildIndex + 1).text;
        if (next === '>') {
          operator = '>>';
          currentChildIndex += 2;
        } else {
          currentChildIndex++;
        }
      } else {
        currentChildIndex++;
      }

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right: this.visit(children[i]),
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };

      // Skip the right operand
      currentChildIndex++;
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
    const text = ctx.NUMBER().text;
    const value = parseFloat(text);
    // Check if the literal text contains a decimal point to distinguish float from int
    // This ensures "10.0" is parsed as FloatLiteral, not IntegerLiteral
    if (text.includes('.')) {
      return {
        type: 'FloatLiteral',
        value,
        line: ctx.start.line,
        column: ctx.start.charPositionInLine + 1,
      };
    } else {
      return {
        type: 'IntegerLiteral',
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

  visitMetaIdentifier(ctx: MetaIdentifierContext): MetaIdentifier {
    return {
      type: 'MetaIdentifier',
      name: ctx.META_IDENTIFIER().text,
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

  visitSetLiteralExpr(ctx: SetLiteralExprContext): SetLiteral {
    return this.visit(ctx.setLiteral());
  }

  visitSetLiteral(ctx: SetLiteralContext): SetLiteral {
    const elements = ctx.expression().map(e => this.visit(e));
    return {
      type: 'SetLiteral',
      elements,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitMapLiteralExpr(ctx: MapLiteralExprContext): MapLiteral {
    return this.visit(ctx.mapLiteral());
  }

  visitMapLiteral(ctx: MapLiteralContext): MapLiteral {
    const entries = ctx.mapEntry().map(entryCtx => this.visit(entryCtx));
    return {
      type: 'MapLiteral',
      entries,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitMapEntry(ctx: MapEntryContext): { key: Expression; value: Expression } {
    const key = this.visit(ctx.expression(0));
    const value = this.visit(ctx.expression(1));
    return { key, value };
  }

  visitTupleLiteralExpr(ctx: TupleLiteralExprContext): TupleLiteral {
    return this.visit(ctx.tupleLiteral());
  }

  visitTupleLiteral(ctx: TupleLiteralContext): TupleLiteral {
    const elements = ctx.expression().map(e => this.visit(e));
    return {
      type: 'TupleLiteral',
      elements,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitRecordLiteralExpr(ctx: RecordLiteralExprContext): RecordLiteral {
    return this.visit(ctx.recordLiteral());
  }

  visitRecordLiteral(ctx: RecordLiteralContext): RecordLiteral {
    const entries = ctx.recordEntry().map(entryCtx => this.visit(entryCtx));
    return {
      type: 'RecordLiteral',
      entries,
      line: ctx.start.line,
      column: ctx.start.charPositionInLine + 1,
    };
  }

  visitRecordEntry(ctx: RecordEntryContext): { key: string; value: Expression } {
    const rawKey = ctx.STRING().text;
    const key = rawKey.slice(1, -1);  // Strip surrounding quotes
    const value = this.visit(ctx.expression());
    return { key, value };
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
/**
 * Author's note: Maybe when writing OOP programs, we should never export the classes directly.
 * Instead, we should use a function that do what the class's main function do, and export that function.
 * This way, we can change the internal implementation without affecting any external code.
 * Like this:
 */
export function transpile(programCtx: ProgramContext): Program {
  const astBuilder = new ASTBuilder();
  return astBuilder.visit(programCtx);
}
