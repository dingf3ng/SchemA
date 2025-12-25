import { Program } from "../types";
import { TypeChecker } from "./type-checker";
import { TypeInferer } from "./type-inferer";
import { TypeRefiner } from "./type-refiner";
import { Type } from "./type-checker-utils";

export type FunEnv = Map<string, { parameters: Type[]; returnType: Type; variadic?: boolean } >;

export type TypeEnv = Map<string, Type>;

export function initializeBuiltins(): [ FunEnv, TypeEnv ] {
  // Built-in functions
  let functionEnv: FunEnv = new Map();
  let typeEnv: TypeEnv = new Map();
  functionEnv.set('print', {
    parameters: [{ kind: 'poly' }],
    returnType: { kind: 'void' },
    variadic: true,
  });

  // Polymorphic built-in data structures
  functionEnv.set('MinHeap', {
    parameters: [],
    returnType: { kind: 'heap', elementType: { kind: 'weak' } },
  });

  functionEnv.set('MaxHeap', {
    parameters: [],
    returnType: { kind: 'heap', elementType: { kind: 'weak' } },
  });

  functionEnv.set('MinHeapMap', {
    parameters: [],
    returnType: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } },
  });

  functionEnv.set('MaxHeapMap', {
    parameters: [],
    returnType: { kind: 'heapmap', keyType: { kind: 'weak' }, valueType: { kind: 'weak' } },
  });

  functionEnv.set('Graph', {
    parameters: [{ kind: 'boolean' }], // directed: boolean
    returnType: { kind: 'graph', nodeType: { kind: 'weak' } },
  });

  functionEnv.set('Map', {
    parameters: [],
    returnType: {
      kind: 'map',
      keyType: { kind: 'weak' },
      valueType: { kind: 'weak' },
    },
  });

  functionEnv.set('Set', {
    parameters: [],
    returnType: { kind: 'set', elementType: { kind: 'weak' } },
  });

  functionEnv.set('BinaryTree', {
    parameters: [],
    returnType: { kind: 'binarytree', elementType: { kind: 'weak' } },
  });

  functionEnv.set('AVLTree', {
    parameters: [],
    returnType: { kind: 'avltree', elementType: { kind: 'weak' } },
  });

  typeEnv.set('inf', { kind: 'intersection', types: [{ kind: 'int' }, { kind: 'float' }] });

  return [functionEnv, typeEnv];
}

/**
 * Main type checking function
 * @param program
 * @returns
 */
export function typeCheck(program: Program): void {
  [program]
    .map((prog) => new TypeInferer().infer(prog))
    .map((infered) => new TypeRefiner(infered).refine(program))
    .forEach((refined) => new TypeChecker(refined).check(program));
}

/**
 * For testing: typecheck and return the TypeChecker instance, for inspection
 * @param program 
 * @returns 
 */
export function typecheckAndReturn(program: Program): TypeChecker {
  const checkers = [program]
    .map((prog) => new TypeInferer().infer(prog))
    .map((infered) => new TypeRefiner(infered).refine(program))
    .map((refined) => {
      const typeChecker = new TypeChecker(refined);
      typeChecker.check(program);
      return typeChecker;
    });
  
  return checkers[0];
}
