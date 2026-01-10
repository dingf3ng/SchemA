import { Program } from "../transpiler/ast-types";
import { Environment } from "./environment";
import { Interpreter } from "./interpreter";
import { Machine } from "./machine";

export function interpret(program: Program, interpreter: Interpreter): string[] {
    return interpreter.evaluate(program);
}

export function interpretWithFinalEnv(program: Program, interpreter: Interpreter): { output: string[]; env: Environment } {
    const output = interpreter.evaluate(program);
    return { output, env: interpreter.getEnvironment() };
}

/**
 * Run a program using the abstract machine
 */
export function runMachine(program: Program, machine: Machine): string[] {
    machine.initialize(program);
    return machine.run();
}
