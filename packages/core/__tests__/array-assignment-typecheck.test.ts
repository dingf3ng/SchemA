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

  it('should allow assignment to simple variable with union type', () => {
    const code = `
let x : int | string = 5
x = "hello"
    `;

    expect(() => {
      run(code);
    }).not.toThrow();
  });

  it('should allow assignment to array with union type', () => {
    const code = `
let x : Array< int | string > = [5, "hello"]
x[1] = "world"
x[0] = 42
    `;

    expect(() => {
      run(code);
    }).not.toThrow();
  });

  it('should allow assignment to array with union type', () => {
    const code = `
let x : Array< int | string > = [5, "hello"]
x[1] = 42.3
x[0] = 42
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
       expect(() => { run(code); }).toThrow(/Type mismatch/);
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

  describe('Union and Intersection Types', () => {
    it('should allow assignment to Array<int | string>', () => {
      const code = `
let arr : Array<int | string> = [1, "two"]
arr[0] = "one"
arr[1] = 2
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject assignment of boolean to Array<int | string>', () => {
      const code = `
let arr : Array<int | string> = [1, "two"]
arr[0] = true
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });

    it('should allow assignment to Map<string, int | boolean>', () => {
      const code = `
let m : Map<string, int | boolean> = Map()
m.set("a", 1)
m.set("b", true)
m["c"] = 0
m["d"] = false
      `;
      expect(() => { run(code); }).not.toThrow();
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

    it('should handle deeply nested types: Map<Array<int | boolean>, Map<boolean | string, string>>', () => {
      // Note: Map keys in this language might need to be hashable/comparable. 
      // Assuming Array<int | boolean> is a valid key type or just testing the type checker's structural validation.
      // If arrays are not valid keys at runtime, this might fail at runtime but pass type check, or fail type check if keys are constrained.
      // Based on previous context, Map keys seem flexible in type checker.
      const code = `
let complexMap : Map<Array<int | boolean>, Map<boolean | string, string>> = Map()
let key : Array<int | boolean> = [1, true]
let innerMap : Map<boolean | string, string> = Map()

innerMap.set(true, "value1")
innerMap.set("key2", "value2")

complexMap.set(key, innerMap)
      `;
      expect(() => { run(code); }).not.toThrow();
    });

    it('should reject invalid inner map in deeply nested type', () => {
      const code = `
let complexMap : Map<Array<int | boolean>, Map<boolean | string, string>> = Map()
let key : Array<int | boolean> = [1, true]
let invalidInnerMap : Map<boolean | string, int> = Map() // Value type mismatch (int vs string)

invalidInnerMap.set(true, 1)

complexMap.set(key, invalidInnerMap)
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });

    it('should reject invalid key in deeply nested type', () => {
      const code = `
let complexMap : Map<Array<int | boolean>, Map<boolean | string, string>> = Map()
let invalidKey : Array<string> = ["invalid"]
let innerMap : Map<boolean | string, string> = Map()

complexMap.set(invalidKey, innerMap)
      `;
      expect(() => { run(code); }).toThrow(/Type mismatch/);
    });
  });
});
