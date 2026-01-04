import { ANTLRInputStream, CommonTokenStream } from 'antlr4ts';
import { SchemALexer } from '../generated/src/SchemALexer';
import { SchemAParser } from '../generated/src/SchemAParser';
import { transpile } from './transpiler';
import { Program } from './ast-types';

class AntlrParser {
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
    // Build our AST
    const ast = transpile(tree);
    return ast;
  }
}

export function parse(code: string): Program {
  const parser = new AntlrParser();
  return parser.parse(code);
}
