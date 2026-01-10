import { parse } from './transpiler/parser';
import { interpret, interpretWithFinalEnv, runMachine as runMachineInternal } from './runtime/runtime-main';
import { typeCheck } from './type-checker/type-checker-main';
import { Interpreter } from './runtime/interpreter';
import { Machine } from './runtime/machine';

export { parse } from './transpiler/parser';
export { interpret, interpretWithFinalEnv } from './runtime/runtime-main';
export { typeCheck } from './type-checker/type-checker-main';
export * from './transpiler/ast-types';
export * from './runtime/runtime-utils';
export * from './builtins/data-structures';
export { Stepper } from './runtime/stepper';
export type { StepState } from './runtime/stepper';


export function run(code: string): string[] {
  const ast = parse(code);
  typeCheck(ast);
  const interpreter = new Interpreter();
  return interpret(ast, interpreter);
}

// Run using abstract machine (for stepping)
export function runMachine(code: string): string[] {
  const ast = parse(code);
  typeCheck(ast);
  return runMachineInternal(ast, new Machine());
}

// Run and return environment for testing/debugging
export function runWithEnv(code: string) {
  const ast = parse(code);
  typeCheck(ast);
  const interpreter = new Interpreter();
  return interpretWithFinalEnv(ast, interpreter);
}
