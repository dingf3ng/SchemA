import { run } from '../src/index';
import { AntlrParser } from '../src/parser';
import { TypeChecker } from '../src/typechecker';

function check(code: string) {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();
  typeChecker.infer(ast);
  typeChecker.check(ast);
}

describe('Type Widening', () => {
  describe('Basic Array Widening', () => {
    it('should widen array type with index assignment', () => {
      const code = `
let ak = [1,2,3]
ak[2] = "k"
print(typeof(ak)) // given no type annotation, should widen to Array<int | string>
print(ak)
      `;
      const output = run(code);
      console.log('Index assignment output:', output);
      // Should show the actual array with widened type
      expect(output.length).toBe(2);
      expect(output[0]).not.toBe('Array<int>');
      expect(output[1]).toContain('k'); // Array should contain the string "k"
    });

    it('should widen array type with push method', () => {
      const code = `
let ak = [1,2,3]
ak.push("k")
print(typeof(ak)) // given no type annotation, should widen to Array<int | string>
print(ak)
      `;
      const output = run(code);
      console.log('Push method output:', output);
      // Should show the actual array with widened type
      expect(output.length).toBe(2);
      expect(output[0]).not.toBe('Array<int>');
      expect(output[1]).toContain('k'); // Array should contain the string "k"
    });

    it('should match user example exactly', () => {
      const code = `
let ak = [1,2,3]
print(typeof(ak)) // should also be Array<int | string> as the inference is a whole
ak[2] = "k" // should widen type to Array<int | string> as well
ak.push("k") // ok
print(typeof(ak))
      `;
      // This should not throw an error
      expect(() => run(code)).not.toThrow();
      const output = run(code);
      expect(output[0]).not.toBe('Array<int>');
      expect(output[1]).not.toBe('Array<int>');
      console.log('User example output:', output);
    });

    it('should widen array from string to string | boolean', () => {
      const code = `
let arr = ["a", "b", "c"]
arr[1] = true
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('string');
      expect(output[0]).toContain('boolean');
    });

    it('should widen array from boolean to boolean | int', () => {
      const code = `
let arr = [true, false]
arr.push(42)
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('boolean');
      expect(output[0]).toContain('int');
    });

    it('should widen array to include float', () => {
      const code = `
let arr = [1, 2, 3]
arr.push(3.14)
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('float');
    });
  });

  describe('Map Type Widening', () => {
    it('should widen Map value type with different value types', () => {
      const code = `
let m = Map()
m.set("a", 1)
print(typeof(m))
m.set("b", "value")
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<string, int | string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
    });

    it('should widen Map key type with different key types', () => {
      const code = `
let m = Map()
m.set(1, "value")
print(typeof(m))
m.set("key", "value")
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<int | string, string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
    });

    it('should widen Map both key and value types', () => {
      const code = `
let m = Map()
m.set(1, 100)
print(typeof(m))
m.set("key", true)
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<int | string, int | boolean>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
      expect(output[1]).toContain('boolean');
    });

    it('should progressively widen Map value type', () => {
      const code = `
let m = Map()
m.set("a", 1)
m.set("b", 2)
print(typeof(m))
m.set("c", 3.14)
print(typeof(m))
m.set("d", true)
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<string, int | float | boolean>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('float');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('float');
      expect(output[2]).toContain('boolean');
    });
  });

  describe('Set Type Widening', () => {
    it('should widen Set element type from int to int | string', () => {
      const code = `
let s = Set()
s.add(1)
s.add(2)
print(typeof(s))
s.add("hello")
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toBe('Set<int | string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
    });

    it('should widen Set to include multiple types', () => {
      const code = `
let s = Set()
s.add(1)
print(typeof(s))
s.add(true)
print(typeof(s))
s.add(3.14)
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toBe('Set<int | boolean | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('boolean');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('boolean');
      expect(output[2]).toContain('float');
    });

    it('should widen Set from string to string | boolean | int', () => {
      const code = `
let s = Set()
s.add("a")
s.add("b")
print(typeof(s))
s.add(true)
s.add(42)
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toBe('Set<string | boolean | int>');
      expect(output[1]).toContain('string');
      expect(output[1]).toContain('boolean');
      expect(output[1]).toContain('int');
    });
  });

  describe('Heap Type Widening', () => {
    it('should widen MinHeap element type from int to int | float', () => {
      const code = `
let h = MinHeap()
h.push(1)
h.push(2)
print(typeof(h))
h.push(3.14)
print(typeof(h))
      `;
      const output = run(code);
      expect(output[0]).toBe('Heap<int | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('float');
    });

    it('should widen MaxHeap element type progressively', () => {
      const code = `
let h = MaxHeap()
h.push(5)
print(typeof(h))
h.push(2.71)
print(typeof(h))
      `;
      const output = run(code);
      expect(output[0]).toBe('Heap<int | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('float');
    });
  });

  describe('Nested Structure Widening', () => {
    it('should widen Array of Arrays with different inner types', () => {
      const code = `
let arr = []
arr.push([1, 2, 3])
print(typeof(arr))
arr.push([true, false])
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toBe('Array<Array<int> | Array<boolean>>');
      expect(output[1]).toContain('Array<int>');
      expect(output[1]).toContain('Array<boolean>');
    });

    it('should widen Map with nested Array values', () => {
      const code = `
let m = Map()
m.set("nums", [1, 2, 3])
print(typeof(m))
m.set("flags", [true, false])
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<string, Array<int> | Array<boolean>>');
      expect(output[1]).toContain('Array<int>');
      expect(output[1]).toContain('Array<boolean>');
    });

    it('should widen Array of Maps with different value types', () => {
      const code = `
let arr = []
let m1 = Map()
m1.set("a", 1)
arr.push(m1)
print(typeof(arr))
let m2 = Map()
m2.set("b", true)
arr.push(m2)
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toBe('Array<Map<string, int> | Map<string, boolean>>');
      expect(output[1]).toContain('Map<string, int>');
      expect(output[1]).toContain('Map<string, boolean>');
    });

    it('should widen Map values from simple to complex types', () => {
      const code = `
let m = Map()
m.set("num", 42)
print(typeof(m))
m.set("arr", [1, 2, 3])
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<string, int | Array<int>>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('Array<int>');
    });
  });

  describe('Negative Tests - Type Annotation Violations', () => {
    it('should fail when widening violates explicit Array type annotation', () => {
      const code = `
        do main() {
          let arr: Array<int> = [1, 2, 3]
          arr.push("not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when index assignment violates Array type annotation', () => {
      const code = `
        do main() {
          let arr: Array<int> = [1, 2, 3]
          arr[0] = "not_an_int"
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when Map value widening violates type annotation', () => {
      const code = `
        do main() {
          let m: Map<string, int> = Map()
          m.set("a", 1)
          m.set("b", "not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when Map key widening violates type annotation', () => {
      const code = `
        do main() {
          let m: Map<int, string> = Map()
          m.set(1, "value")
          m.set("not_an_int", "value")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when Set widening violates type annotation', () => {
      const code = `
        do main() {
          let s: Set<int> = Set()
          s.add(1)
          s.add("not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when MinHeap widening violates type annotation', () => {
      const code = `
        do main() {
          let h: MinHeap<int> = MinHeap()
          h.push(1)
          h.push("not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when nested Array widening violates type annotation', () => {
      const code = `
        do main() {
          let arr: Array<Array<int>> = []
          arr.push([1, 2, 3])
          arr.push(["not", "ints"])
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when Map with Array value widening violates annotation', () => {
      const code = `
        do main() {
          let m: Map<string, Array<int>> = Map()
          m.set("nums", [1, 2, 3])
          m.set("strs", ["not", "ints"])
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Positive Tests - Valid Widening with Annotations', () => {
    it('should allow widening within union type bounds for Array', () => {
      const code = `
        do main() {
          let arr: Array<int | string> = [1, 2, 3]
          arr.push("valid")
          arr[0] = "also_valid"
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow widening within union type bounds for Map values', () => {
      const code = `
        do main() {
          let m: Map<string, int | boolean> = Map()
          m.set("a", 1)
          m.set("b", true)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow widening within union type bounds for Map keys', () => {
      const code = `
        do main() {
          let m: Map<int | string, boolean> = Map()
          m.set(1, true)
          m.set("key", false)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow widening within union type bounds for Set', () => {
      const code = `
        do main() {
          let s: Set<int | string | boolean> = Set()
          s.add(1)
          s.add("hello")
          s.add(true)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow widening within union type bounds for MinHeap', () => {
      const code = `
        do main() {
          let h: MinHeap<int | float> = MinHeap()
          h.push(1)
          h.push(3.14)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow nested structure widening within bounds', () => {
      const code = `
        do main() {
          let arr: Array<Array<int> | Array<boolean>> = []
          arr.push([1, 2, 3])
          arr.push([true, false])
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should allow complex union widening in Map', () => {
      const code = `
        do main() {
          let m: Map<string, int | Array<int> | boolean> = Map()
          m.set("num", 42)
          m.set("arr", [1, 2, 3])
          m.set("flag", true)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });
  });

  describe('Multiple Data Structure Widening', () => {
    it('should widen multiple data structures independently', () => {
      const code = `
let arr = [1, 2, 3]
let m = Map()
let s = Set()

arr.push("widen_array")
m.set(1, "initial")
m.set("widen_key", "value")
s.add(1)
s.add("widen_set")

print(typeof(arr))
print(typeof(m))
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('string');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('string');
    });

    it('should handle progressive widening across multiple structures', () => {
      const code = `
let arr = [1]
let m = Map()
let h = MinHeap()

print(typeof(arr))
print(typeof(m))
print(typeof(h))

arr.push(true)
m.set("a", 1)
h.push(5)

print(typeof(arr))
print(typeof(m))
print(typeof(h))

arr.push(3.14)
m.set("b", true)
h.push(2.71)

print(typeof(arr))
print(typeof(m))
print(typeof(h))
      `;
      const output = run(code);
      // Initial types
      expect(output[0]).toBe('Array<int | boolean | float>');
      expect(output[1]).toContain('Map<');
      expect(output[2]).toContain('Heap<');

      // After first widening
      expect(output[3]).toContain('int');
      expect(output[3]).toContain('boolean');

      // Final widened types
      expect(output[6]).toContain('int');
      expect(output[6]).toContain('boolean');
      expect(output[6]).toContain('float');
    });
  });

  describe('Array Index Assignment Widening', () => {
    it('should widen array type through index assignment', () => {
      const code = `
let arr = [1, 2, 3]
print(typeof(arr))
arr[0] = "string"
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toBe('Array<int | string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
    });

    it('should widen array through multiple index assignments with different types', () => {
      const code = `
let arr = [1, 2, 3]
arr[0] = true
print(typeof(arr))
arr[1] = 3.14
print(typeof(arr))
arr[2] = "hello"
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('boolean');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('boolean');
      expect(output[1]).toContain('float');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('boolean');
      expect(output[2]).toContain('float');
      expect(output[2]).toContain('string');
    });

    it('should widen empty array through index assignment', () => {
      const code = `
let arr = []
arr[0] = 42
print(typeof(arr))
arr[1] = "string"
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toBe('Array<int | string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
    });

    it('should widen boolean array through index assignment', () => {
      const code = `
let arr = [true, false, true]
arr[1] = 42
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('boolean');
      expect(output[0]).toContain('int');
    });

    it('should widen string array through index assignment', () => {
      const code = `
let arr = ["a", "b", "c"]
arr[2] = 3.14
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('string');
      expect(output[0]).toContain('float');
    });

    it('should widen array with both index assignment and push', () => {
      const code = `
let arr = [1, 2, 3]
arr[0] = "indexed"
print(typeof(arr))
arr.push(true)
print(typeof(arr))
arr[4] = 3.14
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('string');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
      expect(output[1]).toContain('boolean');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('string');
      expect(output[2]).toContain('boolean');
      expect(output[2]).toContain('float');
    });

    it('should widen nested arrays through index assignment', () => {
      const code = `
let arr = [[1, 2], [3, 4]]
print(typeof(arr))
arr[0] = ["a", "b"]
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toBe('Array<Array<int> | Array<string>>');
      expect(output[1]).toContain('Array<int>');
      expect(output[1]).toContain('Array<string>');
    });

    it('should progressively widen through sequential index assignments', () => {
      const code = `
let arr = [1]
print(typeof(arr))
arr[1] = "two"
print(typeof(arr))
arr[2] = true
print(typeof(arr))
arr[3] = 3.14
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toBe('Array<int | string | boolean | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('string');
      expect(output[2]).toContain('boolean');
      expect(output[3]).toContain('int');
      expect(output[3]).toContain('string');
      expect(output[3]).toContain('boolean');
      expect(output[3]).toContain('float');
    });

    it('should widen with out-of-bounds index assignment', () => {
      const code = `
let arr = [1, 2, 3]
arr[10] = "far"
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('string');
    });
  });

  describe('Map Index Assignment (get/set) Widening', () => {
    it('should widen Map through sequential .set() operations', () => {
      const code = `
let m = Map()
m.set("key1", 1)
print(typeof(m))
m.set("key2", "value")
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<string, int | string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
    });

    it('should widen Map keys through sequential set operations', () => {
      const code = `
let m = Map()
m.set(1, "first")
print(typeof(m))
m.set("key", "second")
print(typeof(m))
m.set(true, "third")
print(typeof(m))
      `;
      const output = run(code);
      expect(output[0]).toBe('Map<int | string | boolean, string>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('string');
      expect(output[2]).toContain('boolean');
    });
  });

  describe('Set Add Operation Widening', () => {
    it('should widen Set through sequential add operations', () => {
      const code = `
let s = Set()
s.add(1)
print(typeof(s))
s.add("string")
print(typeof(s))
s.add(true)
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toBe('Set<int | string | boolean>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('string');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('string');
      expect(output[2]).toContain('boolean');
    });

    it('should widen Set from homogeneous to heterogeneous', () => {
      const code = `
let s = Set()
s.add(1)
s.add(2)
s.add(3)
print(typeof(s))
s.add(3.14)
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toBe('Set<int | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('float');
    });
  });

  describe('Heap Push Operation Widening', () => {
    it('should widen MinHeap through sequential push operations', () => {
      const code = `
let h = MinHeap()
h.push(5)
h.push(3)
print(typeof(h))
h.push(2.71)
print(typeof(h))
      `;
      const output = run(code);
      expect(output[0]).toBe('Heap<int | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('float');
    });

    it('should widen MaxHeap through push operations with multiple types', () => {
      const code = `
let h = MaxHeap()
h.push(10)
print(typeof(h))
h.push(3.14)
print(typeof(h))
      `;
      const output = run(code);
      expect(output[0]).toBe('Heap<int | float>');
      expect(output[1]).toContain('int');
      expect(output[1]).toContain('float');
    });
  });

  describe('Mixed Operations Widening', () => {
    it('should handle widening with mix of index and method operations', () => {
      const code = `
let arr = [1, 2, 3]
arr[0] = "index"
arr.push(true)
arr[4] = 3.14
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('string');
      expect(output[0]).toContain('boolean');
      expect(output[0]).toContain('float');
    });

    it('should widen across different data structures simultaneously', () => {
      const code = `
let arr = [1]
let m = Map()
let s = Set()

arr[1] = "string"
m.set(1, "value")
s.add(1)

print(typeof(arr))
print(typeof(m))
print(typeof(s))

arr[2] = true
m.set("key", true)
s.add("item")

print(typeof(arr))
print(typeof(m))
print(typeof(s))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('string');
      expect(output[1]).toContain('Map');
      expect(output[2]).toContain('Set');
      expect(output[3]).toContain('int');
      expect(output[3]).toContain('string');
      expect(output[3]).toContain('boolean');
      expect(output[4]).toContain('int');
      expect(output[4]).toContain('string');
      expect(output[4]).toContain('boolean');
      expect(output[5]).toContain('int');
      expect(output[5]).toContain('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle widening empty array on first push', () => {
      const code = `
let arr = []
print(typeof(arr))
arr.push(1)
print(typeof(arr))
arr.push("string")
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[1]).toBe('Array<int | string>');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('string');
    });

    it('should handle widening empty Map on first set', () => {
      const code = `
let m = Map()
print(typeof(m))
m.set("key", 1)
print(typeof(m))
m.set("key2", true)
print(typeof(m))
      `;
      const output = run(code);
      expect(output[1]).toBe('Map<string, int | boolean>');
      expect(output[2]).toContain('int');
      expect(output[2]).toContain('boolean');
    });

    it('should handle widening with multiple union members', () => {
      const code = `
let arr = [1]
arr.push(true)
arr.push(3.14)
arr.push("hello")
print(typeof(arr))
      `;
      const output = run(code);
      expect(output[0]).toContain('int');
      expect(output[0]).toContain('boolean');
      expect(output[0]).toContain('float');
      expect(output[0]).toContain('string');
    });
  });
});
