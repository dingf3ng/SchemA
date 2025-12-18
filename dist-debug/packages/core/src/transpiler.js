"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTBuilder = void 0;
const AbstractParseTreeVisitor_1 = require("antlr4ts/tree/AbstractParseTreeVisitor");
const SchemAParser_1 = require("./generated/src/SchemAParser");
class ASTBuilder extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    defaultResult() {
        return null;
    }
    visitProgram(ctx) {
        const statements = ctx.statement().map(stmt => this.visit(stmt));
        return {
            type: 'Program',
            body: statements,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitStatement(ctx) {
        if (ctx.functionDeclaration()) {
            return this.visit(ctx.functionDeclaration());
        }
        if (ctx.variableDeclaration()) {
            return this.visit(ctx.variableDeclaration());
        }
        if (ctx.assignmentStatement()) {
            return this.visit(ctx.assignmentStatement());
        }
        if (ctx.ifStatement()) {
            return this.visit(ctx.ifStatement());
        }
        if (ctx.whileStatement()) {
            return this.visit(ctx.whileStatement());
        }
        if (ctx.untilStatement()) {
            return this.visit(ctx.untilStatement());
        }
        if (ctx.forStatement()) {
            return this.visit(ctx.forStatement());
        }
        if (ctx.returnStatement()) {
            return this.visit(ctx.returnStatement());
        }
        if (ctx.blockStatement()) {
            return this.visit(ctx.blockStatement());
        }
        if (ctx.expressionStatement()) {
            return this.visit(ctx.expressionStatement());
        }
        throw new Error('Unknown statement type');
    }
    visitFunctionDeclaration(ctx) {
        const name = ctx.IDENTIFIER().text;
        const parameters = ctx.parameterList()
            ? ctx.parameterList().parameter().map(p => this.visit(p))
            : [];
        const returnType = ctx.typeAnnotation() ? this.visit(ctx.typeAnnotation()) : undefined;
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
    visitParameter(ctx) {
        const name = ctx.IDENTIFIER().text;
        const typeAnnotation = ctx.typeAnnotation() ? this.visit(ctx.typeAnnotation()) : undefined;
        return { name, typeAnnotation };
    }
    visitTypeAnnotation(ctx) {
        return this.visit(ctx.unionType());
    }
    visitUnionType(ctx) {
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
    visitIntersectionType(ctx) {
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
    visitPrimaryType(ctx) {
        if (ctx.childCount === 3 && ctx.getChild(0).text === '(') {
            return this.visit(ctx.typeAnnotation(0));
        }
        const name = ctx.POLY_TYPE_ID() ? ctx.POLY_TYPE_ID().text : ctx.IDENTIFIER().text;
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
        }
        else {
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
    visitVariableDeclaration(ctx) {
        const declarators = ctx.variableDeclarator().map(declaratorCtx => this.visit(declaratorCtx));
        return {
            type: 'VariableDeclaration',
            declarations: declarators,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitVariableDeclarator(ctx) {
        const name = ctx.IDENTIFIER().text;
        const typeAnnotation = ctx.typeAnnotation() ? this.visit(ctx.typeAnnotation()) : undefined;
        const initializer = ctx.expression() ? this.visit(ctx.expression()) : undefined;
        return {
            name,
            typeAnnotation,
            initializer,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitAssignmentStatement(ctx) {
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
    visitIfStatement(ctx) {
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
    visitWhileStatement(ctx) {
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
    visitUntilStatement(ctx) {
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
    visitForStatement(ctx) {
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
    visitReturnStatement(ctx) {
        const value = ctx.expression() ? this.visit(ctx.expression()) : undefined;
        return {
            type: 'ReturnStatement',
            value,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitBlockStatement(ctx) {
        return this.visit(ctx.block());
    }
    visitBlock(ctx) {
        const statements = ctx.statement().map(stmt => this.visit(stmt));
        return {
            type: 'BlockStatement',
            statements,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitExpressionStatement(ctx) {
        const expression = this.visit(ctx.expression());
        return {
            type: 'ExpressionStatement',
            expression,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitExpression(ctx) {
        return this.visit(ctx.logicalOr());
    }
    visitLogicalOr(ctx) {
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
    visitLogicalAnd(ctx) {
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
    visitEquality(ctx) {
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
    visitComparison(ctx) {
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
    visitRange(ctx) {
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
    visitShift(ctx) {
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
    visitAddition(ctx) {
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
    visitMultiplication(ctx) {
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
    visitUnary(ctx) {
        // Delegate to the appropriate labeled alternative
        return this.visitChildren(ctx);
    }
    visitUnaryOp(ctx) {
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
    visitTypeOfExpr(ctx) {
        // typeof followed by a unary expression
        const operand = this.visit(ctx.unary());
        return {
            type: 'TypeOfExpression',
            operand,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitPrefixRange(ctx) {
        // Handle prefix range like ..3 or ...5
        const operator = ctx.getChild(0).text;
        const inclusive = operator === '...';
        const end = this.visit(ctx.shift());
        return {
            type: 'RangeExpression',
            start: undefined, // No start means default to 0
            end,
            inclusive,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitPostfixExpr(ctx) {
        return this.visit(ctx.postfix());
    }
    visitPostfix(ctx) {
        let expr = this.visit(ctx.primary());
        for (const op of ctx.postfixOp()) {
            if (op instanceof SchemAParser_1.CallOpContext) {
                const args = op.argumentList()
                    ? op.argumentList().expression().map(e => this.visit(e))
                    : [];
                expr = {
                    type: 'CallExpression',
                    callee: expr,
                    arguments: args,
                    line: ctx.start.line,
                    column: ctx.start.charPositionInLine + 1,
                };
            }
            else if (op instanceof SchemAParser_1.MemberOpContext) {
                const property = {
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
            }
            else if (op instanceof SchemAParser_1.IndexOpContext) {
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
    visitNumberLiteral(ctx) {
        const value = parseFloat(ctx.NUMBER().text);
        if (Number.isInteger(value)) {
            return {
                type: 'IntegerLiteral',
                value,
                line: ctx.start.line,
                column: ctx.start.charPositionInLine + 1,
            };
        }
        else {
            return {
                type: 'FloatLiteral',
                value,
                line: ctx.start.line,
                column: ctx.start.charPositionInLine + 1,
            };
        }
    }
    visitStringLiteral(ctx) {
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
    unescapeString(str) {
        return str
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
    }
    visitTrueLiteral(ctx) {
        return {
            type: 'BooleanLiteral',
            value: true,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitFalseLiteral(ctx) {
        return {
            type: 'BooleanLiteral',
            value: false,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitAssertExpr(ctx) {
        // assert(condition, message)
        const expressions = ctx.expression();
        const condition = this.visit(expressions[0]);
        const message = this.visit(expressions[1]);
        return {
            type: 'AssertExpression',
            condition,
            message,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitIdentifier(ctx) {
        return {
            type: 'Identifier',
            name: ctx.IDENTIFIER().text,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitPolyTypeIdentifier(ctx) {
        return {
            type: 'Identifier',
            name: ctx.POLY_TYPE_ID().text,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitArrayLiteralExpr(ctx) {
        return this.visit(ctx.arrayLiteral());
    }
    visitArrayLiteral(ctx) {
        const elements = ctx.expression().map(e => this.visit(e));
        return {
            type: 'ArrayLiteral',
            elements,
            line: ctx.start.line,
            column: ctx.start.charPositionInLine + 1,
        };
    }
    visitParenExpr(ctx) {
        return this.visit(ctx.expression());
    }
    visitAssignmentTarget(ctx) {
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
    visitMemberExpression(ctx) {
        let object = this.visit(ctx.primary());
        const identifiers = ctx.IDENTIFIER();
        // Build nested member expressions for chained property access
        for (let i = 0; i < identifiers.length; i++) {
            const property = {
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
        return object;
    }
    visitIndexExpression(ctx) {
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
exports.ASTBuilder = ASTBuilder;
