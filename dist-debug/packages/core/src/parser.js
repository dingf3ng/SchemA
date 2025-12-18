"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntlrParser = void 0;
const antlr4ts_1 = require("antlr4ts");
const SchemALexer_1 = require("./generated/src/SchemALexer");
const SchemAParser_1 = require("./generated/src/SchemAParser");
const transpiler_1 = require("./transpiler");
class AntlrParser {
    parse(code) {
        // Create the lexer
        const inputStream = new antlr4ts_1.ANTLRInputStream(code);
        const lexer = new SchemALexer_1.SchemALexer(inputStream);
        // Create the token stream
        const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
        // Create the parser
        const parser = new SchemAParser_1.SchemAParser(tokenStream);
        // Parse the program
        const tree = parser.program();
        // Build the AST
        const astBuilder = new transpiler_1.ASTBuilder();
        const ast = astBuilder.visit(tree);
        return ast;
    }
}
exports.AntlrParser = AntlrParser;
