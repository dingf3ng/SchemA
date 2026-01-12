import { run, runMachine } from '../src/index';
import { parse } from '../src/transpiler/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';

function check(code: string) {
  const ast = parse(code);

  typeCheck(ast);
}

describe('Type Widening', () => {
  describe('Basic Array Widening', () => {
    it('should throw error when assigning different type with index assignment', () => {
      const code = `
let ak = [1,2,3]
ak[2] = "k"
print(typeof(ak))
print(ak)
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when pushing different type', () => {
      const code = `
let ak = [1,2,3]
ak.push("k")
print(typeof(ak))
print(ak)
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error with user example', () => {
      const code = `
let ak = [1,2,3]
print(typeof(ak))
ak[2] = "k"
ak.push("k")
print(typeof(ak))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when assigning boolean to string array', () => {
      const code = `
let arr = ["a", "b", "c"]
arr[1] = true
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when pushing int to boolean array', () => {
      const code = `
let arr = [true, false]
arr.push(42)
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when pushing float to int array', () => {
      const code = `
let arr = [1, 2, 3]
arr.push(3.14)
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Map Type Widening', () => {
    it('should throw error when setting different value types', () => {
      const code = `
let m = Map()
m.set("a", 1)
print(typeof(m))
m.set("b", "value")
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when setting different key types', () => {
      const code = `
let m = Map()
m.set(1, "value")
print(typeof(m))
m.set("key", "value")
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when setting different key and value types', () => {
      const code = `
let m = Map()
m.set(1, 100)
print(typeof(m))
m.set("key", true)
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when progressively adding different value types', () => {
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
      expect(() => check(code)).toThrow();
    });
  });

  describe('Set Type Widening', () => {
    it('should throw error when adding different type to Set', () => {
      const code = `
let s = Set()
s.add(1)
s.add(2)
print(typeof(s))
s.add("hello")
print(typeof(s))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when adding multiple different types to Set', () => {
      const code = `
let s = Set()
s.add(1)
print(typeof(s))
s.add(true)
print(typeof(s))
s.add(3.14)
print(typeof(s))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when adding boolean and int to string Set', () => {
      const code = `
let s = Set()
s.add("a")
s.add("b")
print(typeof(s))
s.add(true)
s.add(42)
print(typeof(s))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Heap Type Widening', () => {
    it('should throw error when pushing float to int MinHeap', () => {
      const code = `
let h = MinHeap()
h.push(1)
h.push(2)
print(typeof(h))
h.push(3.14)
print(typeof(h))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when pushing float to int MaxHeap', () => {
      const code = `
let h = MaxHeap()
h.push(5)
print(typeof(h))
h.push(2.71)
print(typeof(h))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Nested Structure Widening', () => {
    it('should throw error when pushing arrays with different element types', () => {
      const code = `
let arr = []
arr.push([1, 2, 3])
print(typeof(arr))
arr.push([true, false])
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when setting arrays with different element types in Map', () => {
      const code = `
let m = Map()
m.set("nums", [1, 2, 3])
print(typeof(m))
m.set("flags", [true, false])
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when pushing Maps with different value types', () => {
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
      expect(() => check(code)).toThrow();
    });

    it('should throw error when setting both primitive and array types in Map', () => {
      const code = `
let m = Map()
m.set("num", 42)
print(typeof(m))
m.set("arr", [1, 2, 3])
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
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

  // Removed: Positive Tests section - union types are no longer supported

  describe('Multiple Data Structure Widening', () => {
    it('should throw error when trying to widen multiple data structures', () => {
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
      expect(() => check(code)).toThrow();
    });

    it('should throw error with progressive widening attempts', () => {
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
      expect(() => check(code)).toThrow();
    });
  });

  describe('Array Index Assignment Widening', () => {
    it('should throw error when assigning different type through index', () => {
      const code = `
let arr = [1, 2, 3]
print(typeof(arr))
arr[0] = "string"
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error with multiple index assignments of different types', () => {
      const code = `
let arr = [1, 2, 3]
arr[0] = true
print(typeof(arr))
arr[1] = 3.14
print(typeof(arr))
arr[2] = "hello"
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when assigning different types to empty array via index', () => {
      const code = `
let arr = []
arr[0] = 42
print(typeof(arr))
arr[1] = "string"
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when assigning int to boolean array', () => {
      const code = `
let arr = [true, false, true]
arr[1] = 42
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when assigning float to string array', () => {
      const code = `
let arr = ["a", "b", "c"]
arr[2] = 3.14
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error with both index assignment and push', () => {
      const code = `
let arr = [1, 2, 3]
arr[0] = "indexed"
print(typeof(arr))
arr.push(true)
print(typeof(arr))
arr[4] = 3.14
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when assigning array with different element type', () => {
      const code = `
let arr = [[1, 2], [3, 4]]
print(typeof(arr))
arr[0] = ["a", "b"]
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error with progressive sequential index assignments', () => {
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
      expect(() => check(code)).toThrow();
    });

    it('should throw error with out-of-bounds index assignment', () => {
      const code = `
let arr = [1, 2, 3]
arr[10] = "far"
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Map Index Assignment (get/set) Widening', () => {
    it('should throw error with sequential .set() operations of different types', () => {
      const code = `
let m = Map()
m.set("key1", 1)
print(typeof(m))
m.set("key2", "value")
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when setting different key types', () => {
      const code = `
let m = Map()
m.set(1, "first")
print(typeof(m))
m.set("key", "second")
print(typeof(m))
m.set(true, "third")
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Set Add Operation Widening', () => {
    it('should throw error with sequential add operations of different types', () => {
      const code = `
let s = Set()
s.add(1)
print(typeof(s))
s.add("string")
print(typeof(s))
s.add(true)
print(typeof(s))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when adding float to int Set', () => {
      const code = `
let s = Set()
s.add(1)
s.add(2)
s.add(3)
print(typeof(s))
s.add(3.14)
print(typeof(s))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Heap Push Operation Widening', () => {
    it('should throw error with sequential push operations of different types', () => {
      const code = `
let h = MinHeap()
h.push(5)
h.push(3)
print(typeof(h))
h.push(2.71)
print(typeof(h))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when pushing different types to MaxHeap', () => {
      const code = `
let h = MaxHeap()
h.push(10)
print(typeof(h))
h.push(3.14)
print(typeof(h))
      `;
      expect(() => check(code)).toThrow();
    });
  });

  describe('Mixed Operations Widening', () => {
    it('should throw error with mix of index and method operations', () => {
      const code = `
let arr = [1, 2, 3]
arr[0] = "index"
arr.push(true)
arr[4] = 3.14
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when widening different structures simultaneously', () => {
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
      expect(() => check(code)).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should throw error when pushing different type to empty array', () => {
      const code = `
let arr = []
print(typeof(arr))
arr.push(1)
print(typeof(arr))
arr.push("string")
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when setting different value types to empty Map', () => {
      const code = `
let m = Map()
print(typeof(m))
m.set("key", 1)
print(typeof(m))
m.set("key2", true)
print(typeof(m))
      `;
      expect(() => check(code)).toThrow();
    });

    it('should throw error when adding multiple different types', () => {
      const code = `
let arr = [1]
arr.push(true)
arr.push(3.14)
arr.push("hello")
print(typeof(arr))
      `;
      expect(() => check(code)).toThrow();
    });
  });
});
