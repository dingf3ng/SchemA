import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { TypeChecker } from './type-checker';

export { Lexer } from './lexer';
export { Parser } from './parser';
export { Interpreter } from './interpreter';
export { TypeChecker } from './type-checker';
export * from './types';
export * from './runtime/values';
export * from './runtime/data-structures';

export function run(code: string): string[] {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  const ast = parser.parse();

  const typeChecker = new TypeChecker();
  typeChecker.check(ast);

  const interpreter = new Interpreter();
  return interpreter.evaluate(ast);
}

export function runWithoutTypeCheck(code: string): string[] {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  const ast = parser.parse();

  const interpreter = new Interpreter();
  return interpreter.evaluate(ast);
}
