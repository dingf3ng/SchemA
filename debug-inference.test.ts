import { AntlrParser } from './packages/core/src/parser';
import { TypeChecker } from './packages/core/src/typechecker';

function debugInference(code: string, testName: string) {
  console.log(`\n========== ${testName} ==========`);
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();

  try {
    typeChecker.infer(ast);

    // Print all function declarations with their types
    for (const stmt of ast.body) {
      if (stmt.type === 'FunctionDeclaration') {
        console.log(`\nFunction: ${stmt.name}`);
        console.log(`  Return type: ${JSON.stringify(stmt.returnType)}`);
        for (const param of stmt.parameters) {
          console.log(`  Param ${param.name}: ${JSON.stringify(param.typeAnnotation)}`);
        }

        // Print variable declarations
        if (stmt.body.type === 'BlockStatement') {
          for (const s of stmt.body.statements) {
            if (s.type === 'VariableDeclaration') {
              for (const decl of s.declarations) {
                console.log(`  Var ${decl.name}: ${JSON.stringify(decl.typeAnnotation)}`);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test 1: Map returns
const test1 = `
  do makeMap() {
    let m = Map()
    m.set("key", 42)
    return m
  }

  do main() {
    let m = makeMap()
    let val = m.get("key")
  }
`;
debugInference(test1, "Map returns");

// Test 2: Array of maps
const test2 = `
  do main() {
    let m1 = Map()
    m1.set("a", 1)
    let m2 = Map()
    m2.set("b", 2)
    let arr = [m1, m2]
    let firstMap = arr[0]
    let val = firstMap.get("a")
  }
`;
debugInference(test2, "Array of maps");
