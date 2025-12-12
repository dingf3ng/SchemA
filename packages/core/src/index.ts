import { AntlrParser } from './parser';
import { Interpreter } from './interpreter';
import { TypeChecker } from './typechecker';

export { AntlrParser } from './parser';
export { Interpreter } from './interpreter';
export { TypeChecker } from './typechecker';
export * from './types';
export * from './runtime/values';
export * from './runtime/data-structures';

// New ANTLR-based API (recommended)
export function run(code: string): string[] {
  const parser = new AntlrParser();
  const ast = parser.parse(code);

  const typeChecker = new TypeChecker();
  typeChecker.check(ast);

  const interpreter = new Interpreter();
  return interpreter.evaluate(ast);
}
