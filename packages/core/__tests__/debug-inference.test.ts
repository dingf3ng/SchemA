import { AntlrParser } from '../src/parser';
import { TypeChecker } from '../src/typechecker';

function debugInference(code: string) {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();

  typeChecker.infer(ast);

  const result: any = {};

  // Collect all types
  for (const stmt of ast.body) {
    if (stmt.type === 'FunctionDeclaration') {
      result[stmt.name] = {
        returnType: stmt.returnType,
        parameters: stmt.parameters.map(p => ({
          name: p.name,
          type: p.typeAnnotation
        })),
        variables: []
      };

      // Collect variables
      if (stmt.body.type === 'BlockStatement') {
        for (const s of stmt.body.statements) {
          if (s.type === 'VariableDeclaration') {
            for (const decl of s.declarations) {
              result[stmt.name].variables.push({
                name: decl.name,
                type: decl.typeAnnotation
              });
            }
          }
        }
      }
    }
  }

  return result;
}

describe('Debug Inference', () => {
  it('debug map returns', () => {
    const code = `
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

    const result = debugInference(code);
    console.log('makeMap return type:', JSON.stringify(result.makeMap.returnType, null, 2));
    console.log('makeMap variables:', JSON.stringify(result.makeMap.variables, null, 2));
    console.log('main variables:', JSON.stringify(result.main.variables, null, 2));
  });

  it('debug array of maps', () => {
    const code = `
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

    const result = debugInference(code);
    console.log('main variables:', JSON.stringify(result.main.variables, null, 2));
  });

  it('debug merge sort', () => {
    const code = `
      do merge(left, right) {
        let result = []
        let i = 0
        let j = 0

        until i >= left.size() or j >= right.size() {
          if i >= left.size() {
            result = result.push(right[j])
            j = j + 1
          } else if j >= right.size() {
            result = result.push(left[i])
            i = i + 1
          } else if left[i] < right[j] {
            result = result.push(left[i])
            i = i + 1
          } else {
            result = result.push(right[j])
            j = j + 1
          }
        }

        return result
      }

      do mergeSort(arr) {
        if arr.size() <= 1 {
          return arr
        }

        let mid = arr.size() / 2
        let left = arr[..mid]
        let right = arr[mid..]

        return merge(mergeSort(left), mergeSort(right))
      }

      do main() {
        let arr = [3, 1, 4, 1, 5, 9, 2, 6]
        let sorted = mergeSort(arr)
      }
    `;

    const result = debugInference(code);
    console.log('mergeSort:', JSON.stringify(result.mergeSort, null, 2));
  });
});
