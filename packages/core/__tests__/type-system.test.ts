import { parse } from '../src/transpiler/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';

function check(code: string) {
  const ast = parse(code);
  typeCheck(ast);
}

describe('Type System', () => {
  describe('Primitive Types', () => {
    it('should allow valid primitive assignments', () => {
      const code = `
        do main() {
          let i: int = 42
          let f: float = 3.14
          let s: string = "hello"
          let b: boolean = true
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail on invalid primitive assignments', () => {
      const code = `
        do main() {
          let i: int = "not an int"
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when assigning float to int', () => {
      const code = `
        do main() {
          let i: int = 3.14
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Type Inference', () => {
    it('should infer types from initializers', () => {
      const code = `
        do main() {
          let x = 10
          let y: int = x  // Should work if x is inferred as int
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail if inferred type does not match usage', () => {
      const code = `
        do main() {
          let x = "string"
          let y: int = x
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Data Structures', () => {
    it('should check array element types', () => {
      const code = `
        do main() {
          let arr: Array<int> = [1, 2, 3]
          let x: int = arr[0]
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail for mixed array types', () => {
      // Assuming Array inference might default to first element or common type
      // If explicit type is given, it should enforce it
      const code = `
        do main() {
          let arr: Array<int> = [1, "two"]
        }
      `;
      expect(() => check(code)).toThrow('array elements must be of the same type');
    });

    it('should check map key and value types', () => {
      const code = `
        do main() {
          let m: Map<string, int> = Map()
          m.set("one", 1)
          let val: int = m.get("one")
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail on invalid map key type', () => {
      const code = `
        do main() {
          let m: Map<string, int> = Map()
          m.set(123, 1) // Key should be string
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch'); // Or similar error from method call check
    });
  });

  describe('Functions', () => {
    it('should validate argument types', () => {
      const code = `
        do add(a: int, b: int) -> int {
          return a + b
        }
        do main() {
          add(1, 2)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail on invalid argument types', () => {
      const code = `
        do add(a: int, b: int) -> int {
          return a + b
        }
        do main() {
          add(1, "2")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should validate return type', () => {
      const code = `
        do getVal() -> int {
          return "string"
        }
      `;
      expect(() => check(code)).toThrow('Return type mismatch');
    });

    it('should validate void return', () => {
      const code = `
        do getVal() -> int {
          return
        }
      `;
      expect(() => check(code)).toThrow('Return type mismatch');
    });
  });

  describe('Control Flow', () => {
    it('should require boolean condition in if', () => {
      const code = `
        do main() {
          if "not boolean" {
            print("bad")
          }
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should require boolean condition in while', () => {
      const code = `
        do main() {
          while 1 {
            print("bad")
          }
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should require boolean condition in while', () => {
      const code = `
        do main() {
          while "abc" {
            print("bad")
          }
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Debugging Features', () => {
    describe('typeof operator', () => {
      it('should return string type for typeof expression', () => {
        const code = `
          do main() {
            let x: int = 42
            let typeStr: string = typeof x
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should work with different types', () => {
        const code = `
          do main() {
            let s: string = typeof "hello"
            let s2: string = typeof 3.14
            let s3: string = typeof true
            let arr: Array<int> = [1, 2, 3]
            let s4: string = typeof arr
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should fail when typeof result assigned to non-string', () => {
        const code = `
          do main() {
            let x: int = typeof 42
          }
        `;
        expect(() => check(code)).toThrow('Type mismatch');
      });
    });

    describe('@assert expression', () => {
      it('should accept boolean condition and string message', () => {
        const code = `
          do main() {
            @assert(true, "This should pass")
            @assert(1 == 1, "Equality check")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should work with variables', () => {
        const code = `
          do main() {
            let x: int = 10
            @assert(x > 5, "x should be greater than 5")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });

      it('should fail when condition is not boolean', () => {
        const code = `
          do main() {
            @assert(42, "This is wrong")
          }
        `;
        expect(() => check(code)).toThrow('Type mismatch');
      });

      it('should fail when message is not string', () => {
        const code = `
          do main() {
            @assert(true, 42)
          }
        `;
        expect(() => check(code)).toThrow('Type mismatch');
      });

      it('should fail when condition is a string', () => {
        const code = `
          do main() {
            @assert("not a boolean", "error message")
          }
        `;
        expect(() => check(code)).toThrow('Type mismatch');
      });
    });

    describe('Combined typeof and @assert', () => {
      it('should work together in complex scenarios', () => {
        const code = `
          do main() {
            let x: int = 42
            let typeStr: string = typeof(x)
            @assert(typeStr == "int", "x should be an int")
          }
        `;
        expect(() => check(code)).not.toThrow();
      });
    });
  });

  describe('Lexical Scoping', () => {
    it('should allow functions to access top-level variables', () => {
      const code = `
        let arr = []
        let len = 0

        do push(val) {
          arr.push(val)
          len += 1
        }

        do pull() {
          len -= 1
          return arr[len]
        }
        
        @assert(typeof(arr) == "Array<weak>")
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow functions to read top-level variables', () => {
      const code = `
        let counter = 0

        do getCounter() -> int {
          return counter
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow functions to modify top-level variables', () => {
      const code = `
        let total = 0

        do addToTotal(x: int) {
          total += x
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow multiple functions to share top-level state', () => {
      const code = `
        let stack: Array<int> = []

        do push(val: int) {
          stack.push(val)
        }

        do pop() -> int {
          return stack.pop()
        }

        do peek() -> int {
          return stack[stack.length() - 1]
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow nested access to top-level data structures', () => {
      const code = `
        let data = Map()

        do store(key: string, value: int) {
          data.set(key, value)
        }

        do retrieve(key: string) -> int {
          return data.get(key)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should handle top-level variables with inferred types in functions', () => {
      const code = `
        let items = [1, 2, 3]

        do sumItems() -> int {
          let total = 0
          for item in items {
            total += item
          }
          return total
        }
      `;
      expect(() => check(code)).not.toThrow();
    });
  });
});
