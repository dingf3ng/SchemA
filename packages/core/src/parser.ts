import { ANTLRInputStream, CommonTokenStream } from 'antlr4ts';
import { SchemALexer } from './generated/src/SchemALexer';
import { SchemAParser } from './generated/src/SchemAParser';
import { ASTBuilder } from './transpiler';
import { Program } from './types';

export class AntlrParser {
  parse(code: string): Program {
    // Create the lexer
    const inputStream = new ANTLRInputStream(code);
    const lexer = new SchemALexer(inputStream);

    // Create the token stream
    const tokenStream = new CommonTokenStream(lexer);

    // Create the parser
    const parser = new SchemAParser(tokenStream);

    // Parse the program
    const tree = parser.program();

    // Build the AST
    const astBuilder = new ASTBuilder();
    const ast = astBuilder.visit(tree);

    return ast;
  }
}
