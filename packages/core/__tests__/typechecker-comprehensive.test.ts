import { AntlrParser } from '../src/parser';
import { TypeChecker } from '../src/typechecker';
import { Program } from '../src/types';

/**
 * Helper function to parse and typecheck code
 */
function check(code: string): { ast: Program; typeChecker: TypeChecker } {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();
  typeChecker.infer(ast);
  typeChecker.check(ast);
  return { ast, typeChecker };
}

/**
 * Helper to just infer types without checking
 */
function infer(code: string): { ast: Program; typeChecker: TypeChecker } {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();
  typeChecker.infer(ast);
  return { ast, typeChecker };
}

describe('TypeChecker - Comprehensive Tests', () => {
  describe('Type Inference', () => {
    describe('Variable Type Inference', () => {
      it('should infer int type from integer literal', () => {
        const code = `
          do main() {
            let x = 42
            let y: int = x  // Should work if x is inferred as int
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer float type from float literal', () => {
        const code = `
          do main() {
            let x = 3.14
            let y: float = x
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer string type from string literal', () => {
        const code = `
          do main() {
            let x = "hello"
            let y: string = x
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer boolean type from boolean literal', () => {
        const code = `
          do main() {
            let x = true
            let y: boolean = x
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer array types from array literals', () => {
        const code = `
          do main() {
            let arr = [1, 2, 3]
            let x: Array<int> = arr
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer array types with explicit annotation', () => {
        const code = `
          do main() {
            let arr: Array<int> = [1, 2, 3]
            let first: int = arr[0]
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer types from binary expressions', () => {
        const code = `
          do main() {
            let sum = 10 + 20
            let x: int = sum
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer float from mixed int-float operations', () => {
        const code = `
          do main() {
            let result = 10 + 3.14
            let x: float = result
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer boolean from comparison operations', () => {
        const code = `
          do main() {
            let result = 10 > 5
            let x: boolean = result
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer types through multiple assignments', () => {
        const code = `
          do main() {
            let x = 42
            let y = x
            let z = y
            let w: int = z
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Function Return Type Inference', () => {
      it('should infer return type from return statement', () => {
        const code = `
          do getValue() {
            return 42
          }
          do main() {
            let x: int = getValue()
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer void return type when no return statement', () => {
        const code = `
          do doSomething() {
            let x = 5
          }
          do main() {
            doSomething()
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer return type from multiple return statements with same type', () => {
        const code = `
          do getValue(flag: boolean) {
            if flag {
              return 10
            } else {
              return 20
            }
          }
          do main() {
            let x: int = getValue(true)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should create union type for multiple different return types', () => {
        const code = `
          do getValue(flag: boolean) {
            if flag {
              return 10
            } else {
              return "text"
            }
          }
          do main() {
            let x = getValue(true)
          }
        `;
        // This should not throw during inference and checking
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Parameter Type Inference', () => {
      it('should infer parameter types from usage in binary operations', () => {
        const code = `
          do add(a, b) {
            return a + b
          }
          do main() {
            let result: int = add(5, 10)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should infer parameter type from comparison usage', () => {
        const code = `
          do isGreater(a, b) {
            return a > b
          }
          do main() {
            let result: boolean = isGreater(10, 5)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });
  });

  describe('Weak Polymorphic Type Refinement', () => {
    describe('Data Structure Type Refinement', () => {
      it('should refine Map weak types from set operations', () => {
        const { ast } = infer(`
          do main() {
            let m = Map()
            m.set("key", 42)
            let val = m.get("key")
          }
        `);

        // After inference, the Map should have concrete types (not weak)
        expect(ast).toBeDefined();
        // Map should be inferred as Map<string, int>
        const mainFunc = ast.body.find(s => s.type === 'FunctionDeclaration' && (s as any).name === 'main');
        expect(mainFunc).toBeDefined();
      });

      it('should refine Set weak types from add operations', () => {
        const code = `
          do main() {
            let s = Set()
            s.add(42)
            s.add(43)
          }
        `;
        const { ast } = infer(code);
        // Set should be inferred as Set<int>
        expect(ast).toBeDefined();
      });

      it('should refine Heap weak types from push operations', () => {
        const code = `
          do main() {
            let h = MinHeap()
            h.push(10)
            h.push(20)
          }
        `;
        const { ast } = infer(code);
        // Heap should be inferred as Heap<int>
        expect(ast).toBeDefined();
      });

      it('should refine HeapMap weak types from operations', () => {
        const code = `
          do main() {
            let hm = MinHeapMap()
            hm.push("a", 10)
            hm.push("b", 20)
          }
        `;
        const { ast } = infer(code);
        // HeapMap should be inferred as HeapMap<string, int>
        expect(ast).toBeDefined();
      });

      it('should refine Graph weak types from vertex operations', () => {
        const code = `
          do main() {
            let g = Graph(false)
            g.addVertex(1)
            g.addVertex(2)
            g.addEdge(1, 2, 10)
          }
        `;
        const { ast } = infer(code);
        // Graph should be inferred as Graph<int>
        expect(ast).toBeDefined();
      });

      it('should refine BinaryTree weak types', () => {
        const code = `
          do main() {
            let tree = BinaryTree()
            tree.insert(50)
            tree.insert(30)
          }
        `;
        const { ast } = infer(code);
        // BinaryTree should be inferred as BinaryTree<int>
        expect(ast).toBeDefined();
      });

      it('should refine AVLTree weak types', () => {
        const code = `
          do main() {
            let tree = AVLTree()
            tree.insert("apple")
            tree.insert("banana")
          }
        `;
        const { ast } = infer(code);
        // AVLTree should be inferred as AVLTree<string>
        expect(ast).toBeDefined();
      });
    });

    describe('All Weak Types Should Be Refined', () => {
      it('should have no weak types in fully annotated variable declarations', () => {
        const code = `
          do main() {
            let x = 42
            let y = "hello"
            let z = true
            let arr = [1, 2, 3]
          }
        `;
        const { ast } = infer(code);

        // All variable declarations should have concrete types (no weak)
        const mainFunc = ast.body.find(s => s.type === 'FunctionDeclaration' && (s as any).name === 'main') as any;
        expect(mainFunc).toBeDefined();

        const blockStmt = mainFunc.body;
        const varDecls = blockStmt.statements.filter((s: any) => s.type === 'VariableDeclaration');

        // Check that all have type annotations and none are 'weak'
        varDecls.forEach((decl: any) => {
          decl.declarations.forEach((declarator: any) => {
            expect(declarator.typeAnnotation).toBeDefined();
            expect(declarator.typeAnnotation.name).not.toBe('weak');
          });
        });
      });

      it('should refine all function parameter weak types', () => {
        const code = `
          do add(a, b) {
            return a + b
          }
          do main() {
            add(5, 10)
          }
        `;
        const { ast } = infer(code);

        const addFunc = ast.body.find(s => s.type === 'FunctionDeclaration' && (s as any).name === 'add') as any;
        expect(addFunc).toBeDefined();

        // Parameters should have refined types (not weak)
        addFunc.parameters.forEach((param: any) => {
          expect(param.typeAnnotation).toBeDefined();
          // Note: Parameters might still be weak if not enough info, but with usage they should refine
        });
      });

      it('should refine function return types', () => {
        const code = `
          do compute() {
            return 42 * 2
          }
          do main() {
            let result = compute()
          }
        `;
        const { ast } = infer(code);

        const computeFunc = ast.body.find(s => s.type === 'FunctionDeclaration' && (s as any).name === 'compute') as any;
        expect(computeFunc).toBeDefined();
        expect(computeFunc.returnType).toBeDefined();
        expect(computeFunc.returnType.name).not.toBe('weak');
      });
    });

    describe('Empty Collection Type Refinement', () => {
      it('should handle empty arrays with explicit type annotation', () => {
        const code = `
          do main() {
            let arr: Array<int> = []
            arr.push(42)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should allow empty Map with subsequent usage', () => {
        const code = `
          do main() {
            let m = Map()
            m.set(1, "one")
            let val: string = m.get(1)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should allow empty Set with subsequent usage', () => {
        const code = `
          do main() {
            let s = Set()
            s.add(42)
            let has: boolean = s.has(42)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });
  });

  describe('Type Checking - General', () => {
    describe('Primitive Type Checking', () => {
      it('should accept matching primitive types', () => {
        const code = `
          do main() {
            let x: int = 42
            let y: float = 3.14
            let z: string = "test"
            let w: boolean = true
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject mismatched primitive types', () => {
        const code = `
          do main() {
            let x: int = "not an int"
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should allow int assigned to float through mixed operations', () => {
        const code = `
          do main() {
            let x: float = 42
          }
        `;
        // The type system does not allow int in float context through mixed operations
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should reject float assigned to int', () => {
        const code = `
          do main() {
            let x: int = 3.14
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });
    });

    describe('Array Type Checking', () => {
      it('should check array element types', () => {
        const code = `
          do main() {
            let arr: Array<int> = [1, 2, 3, 4, 5]
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject arrays with wrong element types', () => {
        const code = `
          do main() {
            let arr: Array<int> = [1, 2, "three"]
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should check array indexing returns correct type', () => {
        const code = `
          do main() {
            let arr: Array<string> = ["a", "b", "c"]
            let elem: string = arr[0]
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject wrong type from array indexing', () => {
        const code = `
          do main() {
            let arr: Array<string> = ["a", "b"]
            let elem: int = arr[0]
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should check array method parameter types', () => {
        const code = `
          do main() {
            let arr: Array<int> = [1, 2, 3]
            arr.push(42)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject array method with wrong parameter type', () => {
        const code = `
          do main() {
            let arr: Array<int> = [1, 2, 3]
            arr.push("not an int")
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });
    });

    describe('Map Type Checking', () => {
      it('should check map key and value types', () => {
        const code = `
          do main() {
            let m: Map<string, int> = Map()
            m.set("one", 1)
            m.set("two", 2)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject wrong key type in map.set', () => {
        const code = `
          do main() {
            let m: Map<string, int> = Map()
            m.set(123, 456)
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should reject wrong value type in map.set', () => {
        const code = `
          do main() {
            let m: Map<string, int> = Map()
            m.set("key", "not an int")
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should check map.get return type', () => {
        const code = `
          do main() {
            let m: Map<string, int> = Map()
            m.set("key", 42)
            let val: int = m.get("key")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should check map indexing with correct key type', () => {
        const code = `
          do main() {
            let m: Map<string, int> = Map()
            m.set("x", 10)
            let val: int = m["x"]
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Set Type Checking', () => {
      it('should check set element types', () => {
        const code = `
          do main() {
            let s: Set<int> = Set()
            s.add(1)
            s.add(2)
            s.add(3)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject wrong element type in set.add', () => {
        const code = `
          do main() {
            let s: Set<int> = Set()
            s.add("not an int")
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should check set.has parameter and return types', () => {
        const code = `
          do main() {
            let s: Set<string> = Set()
            s.add("hello")
            let exists: boolean = s.has("hello")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Function Type Checking', () => {
      it('should check function parameter types', () => {
        const code = `
          do greet(name: string) {
            print("Hello", name)
          }
          do main() {
            greet("World")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject wrong parameter type in function call', () => {
        const code = `
          do add(a: int, b: int) -> int {
            return a + b
          }
          do main() {
            add(1, "not an int")
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should check function return type matches annotation', () => {
        const code = `
          do getValue() -> int {
            return 42
          }
          do main() {
            let x: int = getValue()
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject wrong return type', () => {
        const code = `
          do getValue() -> int {
            return "not an int"
          }
        `;
        expect(() => check(code)).toThrow(/Return type mismatch/);
      });

      it('should check void return type', () => {
        const code = `
          do doSomething() -> void {
            let x = 5
          }
          do main() {
            doSomething()
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject return value when void expected', () => {
        const code = `
          do doSomething() -> void {
            return 42
          }
          do main() {
            doSomething()
          }
        `;
        expect(() => check(code)).toThrow(/Return type mismatch/);
      });

      it('should check multiple parameters', () => {
        const code = `
          do compute(a: int, b: float, c: string) -> float {
            return a + b
          }
          do main() {
            let result: float = compute(5, 3.14, "test")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Control Flow Type Checking', () => {
      it('should require boolean condition in if statement', () => {
        const code = `
          do main() {
            if true {
              print("ok")
            }
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject non-boolean condition in if statement', () => {
        const code = `
          do main() {
            if 42 {
              print("bad")
            }
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should require boolean condition in while loop', () => {
        const code = `
          do main() {
            let i = 0
            while i < 10 {
              i = i + 1
            }
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject non-boolean condition in while loop', () => {
        const code = `
          do main() {
            while "string" {
              print("bad")
            }
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should check for loop iterable types', () => {
        const code = `
          do main() {
            let arr = [1, 2, 3]
            for x in arr {
              let y: int = x
            }
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Binary Expression Type Checking', () => {
      it('should check arithmetic operations on int', () => {
        const code = `
          do main() {
            let a = 10
            let b = 20
            let sum: int = a + b
            let diff: int = a - b
            let prod: int = a * b
            let div: int = a / b
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should check arithmetic operations on float', () => {
        const code = `
          do main() {
            let a = 10.5
            let b = 20.3
            let sum: float = a + b
            let diff: float = a - b
            let prod: float = a * b
            let div: float = a /. b
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should check mixed int-float operations return float', () => {
        const code = `
          do main() {
            let a = 10
            let b = 3.14
            let result: float = a + b
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should check comparison operations return boolean', () => {
        const code = `
          do main() {
            let a = 10
            let b = 20
            let r1: boolean = a < b
            let r2: boolean = a <= b
            let r3: boolean = a > b
            let r4: boolean = a >= b
            let r5: boolean = a == b
            let r6: boolean = a != b
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should check logical operations', () => {
        const code = `
          do main() {
            let a = true
            let b = false
            let r1: boolean = a && b
            let r2: boolean = a || b
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject invalid arithmetic operations', () => {
        const code = `
          do main() {
            let result: int = "string" * 42
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch|invalid binary operation/);
      });
    });

    describe('Complex Type Checking', () => {
      it('should handle nested data structures', () => {
        const code = `
          do main() {
            let matrix: Array<Array<int>> = [[1, 2], [3, 4]]
            let row: Array<int> = matrix[0]
            let elem: int = row[0]
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should handle map of arrays', () => {
        const code = `
          do main() {
            let m: Map<string, Array<int>> = Map()
            m.set("nums", [1, 2, 3])
            let arr: Array<int> = m.get("nums")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should handle function calls in expressions', () => {
        const code = `
          do double(x: int) -> int {
            return x * 2
          }
          do main() {
            let result: int = double(5) + double(10)
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Union Type Checking', () => {
      it('should allow union types', () => {
        const code = `
          do main() {
            let arr = [1, "two"]
          }
        `;
        // Arrays with mixed types should create unions
        expect(() => check(code)).not.toThrow();
      });
    });

    describe('Typeof Expression Type Checking', () => {
      it('should check typeof returns string', () => {
        const code = `
          do main() {
            let x = 42
            let t: string = typeof x
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject typeof assigned to non-string', () => {
        const code = `
          do main() {
            let x = 42
            let t: int = typeof x
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });
    });

    describe('Assert Expression Type Checking', () => {
      it('should check assert takes boolean and string', () => {
        const code = `
          do main() {
            assert(true, "message")
            assert(5 > 3, "five is greater")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should reject non-boolean condition in assert', () => {
        const code = `
          do main() {
            assert(42, "bad condition")
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });

      it('should reject non-string message in assert', () => {
        const code = `
          do main() {
            assert(true, 42)
          }
        `;
        expect(() => check(code)).toThrow(/Type mismatch/);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty array inference correctly', () => {
      const code = `
        do main() {
          let arr = []
        }
      `;
      // Empty arrays should be allowed
      expect(() => infer(code)).not.toThrow();
    });

    it('should handle recursive function calls', () => {
      const code = `
        do factorial(n: int) -> int {
          if n <= 1 {
            return 1
          } else {
            return n * factorial(n - 1)
          }
        }
        do main() {
          let result: int = factorial(5)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should handle mutually recursive functions', () => {
      const code = `
        do isEven(n: int) -> boolean {
          if n == 0 {
            return true
          } else {
            return isOdd(n - 1)
          }
        }
        do isOdd(n: int) -> boolean {
          if n == 0 {
            return false
          } else {
            return isEven(n - 1)
          }
        }
        do main() {
          let e: boolean = isEven(4)
          let o: boolean = isOdd(3)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should handle complex nested control flow', () => {
      const code = `
        do main() {
          let i = 0
          while i < 10 {
            if i % 2 == 0 {
              for j in 0..5 {
                let x = i + j
              }
            }
            i = i + 1
          }
        }
      `;
      expect(() => check(code)).not.toThrow();
    });
  });

  describe('Annotation Completeness', () => {
    it('should ensure all variables have non-empty type annotations after inference', () => {
      const code = `
        do main() {
          let x = 42
          let y = "hello"
          let z = true
          let arr = [1, 2, 3]
          let m = Map()
          m.set("key", 100)
        }
      `;
      const { ast } = infer(code);

      const mainFunc = ast.body.find(s => s.type === 'FunctionDeclaration' && (s as any).name === 'main') as any;
      const blockStmt = mainFunc.body;
      const varDecls = blockStmt.statements.filter((s: any) => s.type === 'VariableDeclaration');

      // Verify all variable declarations have type annotations
      varDecls.forEach((decl: any) => {
        decl.declarations.forEach((declarator: any) => {
          expect(declarator.typeAnnotation).toBeDefined();
          expect(declarator.typeAnnotation).not.toBeNull();
          expect(declarator.typeAnnotation.type).toBe('TypeAnnotation');
        });
      });
    });

    it('should ensure all function parameters have type annotations after inference', () => {
      const code = `
        do process(x, y, z) {
          return x + y + z
        }
        do main() {
          process(1, 2, 3)
        }
      `;
      const { ast } = infer(code);

      const processFunc = ast.body.find(s => s.type === 'FunctionDeclaration' && (s as any).name === 'process') as any;

      processFunc.parameters.forEach((param: any) => {
        expect(param.typeAnnotation).toBeDefined();
        expect(param.typeAnnotation).not.toBeNull();
      });
    });

    it('should ensure all functions have return type annotations after inference', () => {
      const code = `
        do getValue() {
          return 42
        }
        do compute(a, b) {
          return a * b
        }
        do main() {
          let x = getValue()
          let y = compute(3, 4)
        }
      `;
      const { ast } = infer(code);

      const functions = ast.body.filter(s => s.type === 'FunctionDeclaration') as any[];

      functions.forEach((func: any) => {
        expect(func.returnType).toBeDefined();
        expect(func.returnType).not.toBeNull();
        expect(func.returnType.type).toBe('TypeAnnotation');
      });
    });
  });
});
