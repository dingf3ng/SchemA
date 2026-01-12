import { run } from '../src/index';

describe('Array Assignment Type Checking', () => {
  it('should reject assignment of string to int array element', () => {
    const code = `
let ak : Array<int> = [1,2,3]
ak[2] = "k"
    `;

    expect(() => {
      run(code);
    }).toThrow(/Type mismatch/);
  });

  it('should allow assignment of int to int array element', () => {
    const code = `
let ak : Array<int> = [1,2,3]
ak[2] = 42
print(ak)
    `;

    expect(() => {
      run(code);
    }).not.toThrow();
  });

  it('should reject assignment to array with wrong element type', () => {
    const code = `
let arr : Array<string> = ["a", "b", "c"]
arr[1] = 123
    `;

    expect(() => {
      run(code);
    }).toThrow(/Type mismatch/);
  });

  it('should reject assignment to simple variable with wrong type', () => {
    const code = `
let x : int = 5
x = "hello"
    `;

    expect(() => {
      run(code);
    }).toThrow(/Type mismatch/);
  });

  describe('Basic Types in Arrays', () => {
    it('should allow assignment of boolean to boolean array element', () => {
      const code = `
let arr : Array<boolean> = [true, false]
arr[1] = true
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject assignment of int to boolean array element', () => {
      const code = `
let arr : Array<boolean> = [true, false]
arr[1] = 123
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });

    it('should allow assignment of float to float array element', () => {
      const code = `
let arr : Array<float> = [1.5, 2.5]
arr[1] = 3.14
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject assignment of string to float array element', () => {
      const code = `
let arr : Array<float> = [1.5, 2.5]
arr[1] = "pi"
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });
  });

  describe('Map Assignment and Access', () => {
    it('should allow assignment to Map via set method', () => {
      const code = `
let m : Map<string, int> = Map()
m.set("key", 42)
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject assignment to Map via set method with wrong types', () => {
      const code = `
let m : Map<string, int> = Map()
m.set(42, "key")
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });

    it('should allow assignment to Map via indexing', () => {
      const code = `
let m : Map<string, int> = Map()
m["key"] = 42
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject assignment to Map via indexing with wrong value type', () => {
      const code = `
let m : Map<string, int> = Map()
m["key"] = "value"
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });

    it('should reject assignment to Map via indexing with wrong key type', () => {
      const code = `
let m : Map<string, int> = Map()
m[123] = 42
       `;
      expect(() => { run(code); }).toThrow(/Type checking: cannot index map with key of type/);
    });
  });

  describe('Heap Assignment (push)', () => {
    it('should allow push to MinHeap with correct type', () => {
      const code = `
let h : MinHeap<float> = MinHeap()
h.push(1.23)
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject push to MinHeap with wrong type', () => {
      const code = `
let h : MinHeap<float> = MinHeap()
h.push("string")
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });
  });

  describe('HeapMap Assignment (push)', () => {
    it('should allow push to MinHeapMap with correct types', () => {
      const code = `
let hm : MinHeapMap<string, int> = MinHeapMap()
hm.push("key", 100)
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject push to MinHeapMap with wrong key type', () => {
      const code = `
let hm : MinHeapMap<string, int> = MinHeapMap()
hm.push(100, 100)
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });

    it('should reject push to MinHeapMap with wrong value type', () => {
      const code = `
let hm : MinHeapMap<string, int> = MinHeapMap()
hm.push("key", "value")
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });
  });

  describe('Nested Complex Types', () => {
    it('should allow assignment to Map<string, Array<int>>', () => {
      const code = `
let m : Map<string, Array<int>> = Map()
m.set("primes", [2, 3, 5])
m["evens"] = [2, 4, 6]
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject assignment of wrong array type to Map<string, Array<int>>', () => {
      const code = `
let m : Map<string, Array<int>> = Map()
m.set("strings", ["a", "b"])
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });
  });
});
