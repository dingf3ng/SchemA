"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const antlr4ts_1 = require("antlr4ts");
const SchemALexer_1 = require("./packages/core/src/generated/src/SchemALexer");
const SchemAParser_1 = require("./packages/core/src/generated/src/SchemAParser");
const code = `
do main() {
  let dist: Map<string, int> = Map()
}
`;
const chars = antlr4ts_1.CharStreams.fromString(code);
const lexer = new SchemALexer_1.SchemALexer(chars);
const tokens = new antlr4ts_1.CommonTokenStream(lexer);
tokens.fill();
console.log('Tokens:');
tokens.getTokens().forEach(token => {
    console.log(`Type: ${token.type}, Text: '${token.text}'`);
});
const parser = new SchemAParser_1.SchemAParser(tokens);
parser.removeErrorListeners();
parser.addErrorListener({
    syntaxError: (recognizer, offendingSymbol, line, charPositionInLine, msg, e) => {
        console.error(`Syntax Error at ${line}:${charPositionInLine}: ${msg}`);
    }
});
const tree = parser.program();
console.log('Parse tree:', tree.toStringTree(parser));
