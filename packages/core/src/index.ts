import { parse } from './transpiler/parser';
import { interpret, interpretWithFinalEnv } from './runtime/interpreter';
import { typeCheck } from './type-checker/type-checker-main';

export { parse } from './transpiler/parser';
export { interpret } from './runtime/interpreter';
export { typeCheck } from './type-checker/type-checker-main';
export * from './transpiler/ast-types';
export * from './runtime/runtime-utils';
export * from './builtins/data-structures';

// New ANTLR-based API (recommended)
export function run(code: string): string[] {
  const ast = parse(code);
  typeCheck(ast);
  return interpret(ast);
}

// Run and return environment for testing/debugging
export function runWithEnv(code: string) {
  const ast = parse(code);
  typeCheck(ast);
  return interpretWithFinalEnv(ast);
}
