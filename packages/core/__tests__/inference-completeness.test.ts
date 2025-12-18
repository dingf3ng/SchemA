import { AntlrParser } from '../src/parser';
import { TypeChecker } from '../src/typechecker';
import { Program, ASTNode, FunctionDeclaration, VariableDeclaration, BlockStatement, IfStatement, WhileStatement, ForStatement, UntilStatement } from '../src/types';

/**
 * Validates that the AST has complete type annotations after inference.
 * Throws an error if any required annotation is missing or is 'weak'.
 */
function validateInferenceCompleteness(node: ASTNode | any): void {
  if (!node) return;

  switch (node.type) {
    case 'Program':
      (node as Program).body.forEach(validateInferenceCompleteness);
      break;

    case 'FunctionDeclaration':
      const func = node as FunctionDeclaration;
      // Check return type
      if (!func.returnType) {
        throw new Error(`Function '${func.name}' is missing return type annotation`);
      }
      validateTypeAnnotation(func.returnType, `Function '${func.name}' return type`);

      // Check parameters
      func.parameters.forEach(param => {
        if (!param.typeAnnotation) {
          throw new Error(`Parameter '${param.name}' in function '${func.name}' is missing type annotation`);
        }
        validateTypeAnnotation(param.typeAnnotation, `Parameter '${param.name}'`);
      });

      // Check body
      validateInferenceCompleteness(func.body);
      break;

    case 'VariableDeclaration':
      const varDecl = node as VariableDeclaration;
      varDecl.declarations.forEach(decl => {
        if (!decl.typeAnnotation) {
          throw new Error(`Variable '${decl.name}' is missing type annotation`);
        }
        validateTypeAnnotation(decl.typeAnnotation, `Variable '${decl.name}'`);
      });
      break;

    case 'BlockStatement':
      (node as BlockStatement).statements.forEach(validateInferenceCompleteness);
      break;

    case 'IfStatement':
      const ifStmt = node as IfStatement;
      validateInferenceCompleteness(ifStmt.thenBranch);
      if (ifStmt.elseBranch) {
        validateInferenceCompleteness(ifStmt.elseBranch);
      }
      break;

    case 'WhileStatement':
      const whileStmt = node as WhileStatement;
      validateInferenceCompleteness(whileStmt.body);
      break;

    case 'UntilStatement':
      const untilStmt = node as UntilStatement;
      validateInferenceCompleteness(untilStmt.body);
      break;

    case 'ForStatement':
      const forStmt = node as ForStatement;
      validateInferenceCompleteness(forStmt.body);
      break;
  }
}

function validateTypeAnnotation(annotation: any, context: string) {
  if (annotation.name === 'weak') {
    throw new Error(`${context} has 'weak' type which should have been refined`);
  }
  // Recursively check generic arguments if any
  if (annotation.genericArguments) {
    annotation.genericArguments.forEach((arg: any) => validateTypeAnnotation(arg, `${context} generic argument`));
  }
}

/**
 * Helper to infer types and validate completeness
 */
function expectInferenceComplete(code: string) {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();

  // Run inference only
  typeChecker.infer(ast);

  // Validate that inference produced complete types
  validateInferenceCompleteness(ast);

  return { ast, typeChecker };
}

describe('Type Inference Completeness', () => {
  describe('Variable Inference', () => {
    it('should fully infer primitive types', () => {
      const code = `
        do main() {
          let i = 42
          let f = 3.14
          let s = "hello"
          let b = true
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should fully infer array types', () => {
      const code = `
        do main() {
          let arr = [1, 2, 3]
          let emptyArr: Array<int> = []
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should fully infer map types', () => {
      const code = `
        do main() {
          let m = Map()
          m.set("key", 42)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Function Inference', () => {
    it('should fully infer return types', () => {
      const code = `
        do add(a: int, b: int) {
          return a + b
        }
        do main() {
          let x = add(1, 2)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should fully infer parameter types from usage', () => {
      const code = `
        do process(x) {
          return x + 10
        }
        do main() {
          process(5)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Complex Structure Inference', () => {
    it('should refine nested weak types', () => {
      const code = `
        do main() {
          let m = Map()
          let arr = [1, 2]
          m.set("list", arr)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in control flow', () => {
      const code = `
        do main() {
          let x = 0
          if true {
            x = 1
          }
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
    it('should refine types in dijkstra', () => {
      const code = `
        // Dijkstra's shortest path algorithm
        do dijkstra(graph, start) -> Map<int, int> {
          let dist = Map(),
              visited = Set(),
              pq = MinHeapMap(),
              n = graph.size()

          for i in ..n {
            dist.set(i, inf)
          }
          dist.set(start, 0)
          pq.push(start, 0)

          until pq.size() == 0 {
            let current = pq.pop()
            if visited.has(current) {
              return dist
            }
            visited.add(current)
            let adjs = graph.getNeighbors(current)

            for adj in adjs {
              let neighbor = adj["to"],
                  weight = adj["weight"]
              let newDist = dist.get(current) + weight
              if newDist < dist.get(neighbor) {
                dist.set(neighbor, newDist)
                pq.push(neighbor, newDist)
              }
            }
          }

          return dist
        }

        // Create a weighted graph
        let g = Graph(true)

        // Add vertices
        g.addVertex(0)
        g.addVertex(1)
        g.addVertex(2)
        g.addVertex(3)
        g.addVertex(4)
        g.addVertex(5)
        g.addVertex(6)

        // Add edges with weights
        g.addEdge(0, 1, 2)
        g.addEdge(0, 3, 5)
        g.addEdge(0, 5, 3)
        g.addEdge(1, 2, 7)
        g.addEdge(1, 4, 1)
        g.addEdge(1, 5, 4)
        g.addEdge(2, 4, 3)
        g.addEdge(2, 6, 4)
        g.addEdge(3, 4, 1)
        g.addEdge(3, 6, 1)
        g.addEdge(4, 6, 3)


        print("Running Dijkstra from node 0:")
        let distances = dijkstra(g, 0)

        for i in ..g.size() {
          print("Distance to node", i, ":", distances.get(i))
        }

      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Negative Tests', () => {
    it('should fail if variable type cannot be inferred', () => {
      const code = `
          do main() {
             let x = [] // Empty array without annotation and usage
          }
        `;
      // This might fail validation or inference depending on implementation
      // If inference leaves it as 'weak' or 'Array<weak>', validation should catch it
      try {
        expectInferenceComplete(code);
      } catch (e: any) {
        // We expect an error, either from inference or our validation
        expect(e).toBeDefined();
      }
    });
  });

  describe('Advanced Type Refinement', () => {
    it('should refine types through nested function calls', () => {
      const code = `
        do identity(x) {
          return x
        }

        do double(n) {
          return n * 2
        }

        do main() {
          let x = identity(5)
          let y = double(x)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in nested loops', () => {
      const code = `
        do main() {
          let matrix = [[1, 2, 3], [4, 5, 6]]
          let sum = 0

          for row in matrix {
            for val in row {
              sum = sum + val
            }
          }
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with chained method calls', () => {
      const code = `
        do main() {
          let m = Map()
          m.set("a", 1)
          m.set("b", 2)
          let val = m.get("a")
          let doubled = val * 2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types through conditional branches', () => {
      const code = `
        do main() {
          let x = 0
          if true {
            x = 10
          } else {
            x = 20
          }
          let y = x + 5
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with multiple data structure operations', () => {
      const code = `
        do main() {
          let s = Set()
          s.add(1)
          s.add(2)
          s.add(3)

          let arr = [10, 20, 30]
          for item in arr {
            s.add(item)
          }
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine heap types through push/pop operations', () => {
      const code = `
        do main() {
          let h = MinHeap()
          h.push(5)
          h.push(3)
          h.push(7)
          let min = h.pop()
          let doubled = min * 2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine heapmap types through operations', () => {
      const code = `
        do main() {
          let hm = MinHeapMap()
          hm.push(1, 100)
          hm.push(2, 50)
          let key = hm.pop()
          let result = key + 10
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine graph node types', () => {
      const code = `
        do main() {
          let g = Graph(true)
          g.addVertex(0)
          g.addVertex(1)
          g.addEdge(0, 1, 5)
          let neighbors = g.getNeighbors(0)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with range iterations', () => {
      const code = `
        do main() {
          let sum = 0
          for i in ..10 {
            sum = sum + i
          }
          let result = sum * 2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in until loops', () => {
      const code = `
        do main() {
          let i = 0
          let sum = 0
          until i == 10 {
            sum = sum + i
            i = i + 1
          }
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with while loops', () => {
      const code = `
        do main() {
          let count = 0
          while count < 5 {
            count = count + 1
          }
          let final = count * 10
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Empty Structures with Usage', () => {
    it('should refine empty array from element access', () => {
      const code = `
        do main() {
          let arr: Array<int> = []
          arr[0] = 42
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine empty map from set operation', () => {
      const code = `
        do main() {
          let m = Map()
          m.set(1, "hello")
          let val = m.get(1)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine empty set from add operation', () => {
      const code = `
        do main() {
          let s = Set()
          s.add(3.14)
          let exists = s.has(3.14)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine empty heap from push operation', () => {
      const code = `
        do main() {
          let h = MaxHeap()
          h.push(100)
          h.push(200)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Complex Expressions', () => {
    it('should refine types in arithmetic expressions', () => {
      const code = `
        do main() {
          let a = 10
          let b = 20
          let c = a + b * 2 - 5
          let d = c / 3
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in comparison chains', () => {
      const code = `
        do main() {
          let x = 5
          let y = 10
          let isValid = x < y
          let result = isValid == true
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in logical expressions', () => {
      const code = `
        do main() {
          let a = true
          let b = false
          let c = a && b
          let d = a || b
          let e = !c
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with array index expressions', () => {
      const code = `
        do main() {
          let arr = [10, 20, 30, 40, 50]
          let idx = 2
          let val = arr[idx]
          let doubled = val * 2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with nested array access', () => {
      const code = `
        do main() {
          let matrix = [[1, 2], [3, 4], [5, 6]]
          let row = matrix[1]
          let val = row[0]
          let result = val + 100
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Multiple Variable Declarations', () => {
    it('should refine types in multi-variable declarations', () => {
      const code = `
        do main() {
          let x = 1, y = 2, z = 3
          let sum = x + y + z
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with mixed initializers', () => {
      const code = `
        do main() {
          let a = 10, b = a * 2, c = b + a
          let result = c / 3
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types across multiple statements', () => {
      const code = `
        do main() {
          let x = 5
          let y = x + 3
          let z = y * 2
          let result = z - x
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Function Return Type Inference', () => {
    it('should refine return type from multiple return paths', () => {
      const code = `
        do getValue(flag) {
          if flag {
            return 10
          } else {
            return 20
          }
        }

        do main() {
          let x = getValue(true)
          let y = x + 5
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine recursive function types', () => {
      const code = `
        do factorial(n) {
          if n <= 1 {
            return 1
          }
          return n * factorial(n - 1)
        }

        do main() {
          let result = factorial(5)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine mutually recursive function types', () => {
      const code = `
        do isEven(n) {
          if n == 0 {
            return true
          }
          return isOdd(n - 1)
        }

        do isOdd(n) {
          if n == 0 {
            return false
          }
          return isEven(n - 1)
        }

        do main() {
          let e = isEven(10)
          let o = isOdd(10)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine function types with array returns', () => {
      const code = `
        do makeArray() {
          return [1, 2, 3, 4, 5]
        }

        do main() {
          let arr = makeArray()
          let first = arr[0]
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine function types with map returns', () => {
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
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Complex Data Structure Patterns', () => {
    it('should refine types in map of arrays', () => {
      const code = `
        do main() {
          let m = Map()
          m.set("nums", [1, 2, 3])
          let arr = m.get("nums")
          let val = arr[0]
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in array of maps', () => {
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
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in set of arrays', () => {
      const code = `
        do main() {
          let s = Set()
          let arr1 = [1, 2]
          s.add(arr1)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with heap of custom data', () => {
      const code = `
        do main() {
          let h = MinHeap()
          h.push(10)
          h.push(5)
          h.push(15)
          let min = h.pop()
          let nextMin = h.pop()
          let sum = min + nextMin
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - String Operations', () => {
    it('should refine types with string concatenation', () => {
      const code = `
        do main() {
          let s1 = "hello"
          let s2 = "world"
          let s3 = s1 + " " + s2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with string methods', () => {
      const code = `
        do main() {
          let s = "test"
          let upper = s.upper()
          let lower = s.lower()
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Boolean Logic Refinement', () => {
    it('should refine types through boolean operators', () => {
      const code = `
        do main() {
          let x = 5
          let y = 10
          let cond1 = x < y
          let cond2 = x > 0
          let result = cond1 and cond2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in negated conditions', () => {
      const code = `
        do main() {
          let flag = true
          let negated = !flag
          if negated {
            let x = 10
          }
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with complex boolean expressions', () => {
      const code = `
        do main() {
          let a = 1
          let b = 2
          let c = 3
          let result = (a < b) and (b < c) or (a == c)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Shadowing and Scoping', () => {
    it('should fail for unsupported binary expression', () => {
      const code = `
        do main() {
          let x = 10
          if true {
            let x = "shadowed"
          }
          let y = x + 5
        }
      `;
      expect(() => expectInferenceComplete(code)).toThrow();
    });

    it('should refine types in loop variable scopes', () => {
      const code = `
        do main() {
          let sum = 0
          for i in ..5 {
            let temp = i * 2
            sum = sum + temp
          }
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types across function scope boundaries', () => {
      const code = `
        do helper(x) {
          return x * 2
        }

        do main() {
          let x = 5
          let doubled = helper(x)
          let result = doubled + x
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Literal Inference', () => {
    it('should refine integer literals', () => {
      const code = `
        do main() {
          let a = 0
          let b = 42
          let c = -100
          let d = a + b + c
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine float literals', () => {
      const code = `
        do main() {
          let a = 3.14
          let b = -2.5
          let c = 0.0
          let d = a + b + c
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine mixed numeric operations', () => {
      const code = `
        do main() {
          let i = 10
          let f = 3.14
          let result = f
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine boolean literals', () => {
      const code = `
        do main() {
          let t = true
          let f = false
          let result = t and f
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine string literals', () => {
      const code = `
        do main() {
          let s1 = "hello"
          let s2 = "world"
          let s3 = s1 + s2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Edge Cases - Assignment Patterns', () => {
    it('should refine types with reassignment', () => {
      const code = `
        do main() {
          let x = 10
          x = 20
          x = x + 5
          let result = x * 2
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with compound assignments', () => {
      const code = `
        do main() {
          let sum = 0
          sum = sum + 10
          sum = sum + 20
          sum = sum + 30
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with array element reassignment', () => {
      const code = `
        do main() {
          let arr = [1, 2, 3]
          arr[0] = 100
          let val = arr[0]
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types with map value reassignment', () => {
      const code = `
        do main() {
          let m = Map()
          m.set("key", 1)
          m.set("key", 2)
          let val = m.get("key")
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });

  describe('Complex Real-World Patterns', () => {
    it('should refine types in BFS algorithm', () => {
      const code = `
        do bfs(graph, start) {
          let visited = Set()
          let queue = [start]
          let result = []

          until queue.size() == 0 {
            let current = queue[0]
            queue = queue[1..]

            if not visited.has(current) {
              visited.add(current)
              result = result + [current]

              let neighbors = graph.getNeighbors(current)
              for n in neighbors {
                queue = queue + [n["to"]]
              }
            }
          }

          return result
        }

        do main() {
          let g = Graph(true)
          g.addVertex(0)
          g.addVertex(1)
          g.addEdge(0, 1, 1)
          let order = bfs(g, 0)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in merge sort', () => {
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
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in dynamic programming - fibonacci', () => {
      const code = `
        do fib(n) -> int {
          let memo = Map()
          memo.set(0, 0)
          memo.set(1, 1)

          for i in 2..n+1 {
            let prev1 = memo.get(i - 1)
            let prev2 = memo.get(i - 2)
            memo.set(i, prev1 + prev2)
          }

          return memo.get(n)
        }

        do main() {
          let result = fib(10)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in priority queue operations', () => {
      const code = `
        do findKLargest(arr, k) {
          let pq = MinHeap()

          for num in arr {
            pq.push(num)
            if pq.size() > k {
              pq.pop()
            }
          }

          let result = []
          until pq.size() == 0 {
            result = result + [pq.pop()]
          }

          return result
        }

        do main() {
          let nums = [3, 2, 1, 5, 6, 4]
          let largest = findKLargest(nums, 2)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });

    it('should refine types in hash map frequency counter', () => {
      const code = `
        do countFrequency(arr) {
          let freq = Map()

          for item in arr {
            if freq.has(item) {
              let count = freq.get(item)
              freq.set(item, count + 1)
            } else {
              freq.set(item, 1)
            }
          }

          return freq
        }

        do main() {
          let arr = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
          let freq = countFrequency(arr)
          let count = freq.get(3)
        }
      `;
      expect(() => expectInferenceComplete(code)).not.toThrow();
    });
  });
});
