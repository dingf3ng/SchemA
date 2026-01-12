import { run, runMachine } from '../src/index';
import { parse } from '../src/transpiler/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';

function check(code: string) {
  const ast = parse(code);
  typeCheck(ast);
}

/**
 * Helper to ensure both interpreter and machine produce the same result
 */
function expectBothToEqual(code: string): string[] {
  const interpResult = run(code);
  const machineResult = runMachine(code);
  expect(interpResult).toEqual(machineResult);
  return interpResult;
}

/**
 * Helper to ensure both interpreter and machine throw the same error
 */
function expectBothToThrow(code: string, errorPattern: RegExp): void {
  expect(() => run(code)).toThrow(errorPattern);
  expect(() => runMachine(code)).toThrow(errorPattern);
}

describe('Map Type Refinement', () => {
  describe('Basic Map Refinement', () => {
    it('should refine Map<weak, weak> to Map<string, int> after set', () => {
      const code = `
        let map = Map()
        map.set("a", 1)
        print(typeof(map))
      `;
      expect(expectBothToEqual(code)).toEqual(['Map<string, int>']);
    });

    it('should refine Map to Map<int, string> after multiple sets', () => {
      const code = `
        let map = Map()
        map.set(1, "hello")
        map.set(2, "world")
        print(typeof(map))
      `;
      expect(expectBothToEqual(code)).toEqual(['Map<int, string>']);
    });

    it('should refine Map to Map<boolean, float> after set', () => {
      const code = `
        let map = Map()
        map.set(true, 3.14)
        map.set(false, 2.71)
        print(typeof(map))
      `;
      expect(expectBothToEqual(code)).toEqual(['Map<boolean, float>']);
    });
  });

  describe('Map Type Mismatch Errors (Union Types Not Supported)', () => {
    it('should throw with mixed value types', () => {
      const code = `
        let map = Map()
        map.set("a", 1)
        map.set("b", true)
        print(typeof(map))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });

    it('should throw with mixed key types', () => {
      const code = `
        let map = Map()
        map.set(1, true)
        map.set("key", false)
        print(typeof(map))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });

    it('should throw with fully mixed types', () => {
      const code = `
        let map = Map()
        map.set(1, 100)
        map.set("key", 3.14)
        map.set(2, 200)
        map.set("another", 2.71)
        print(typeof(map))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });
  });

  describe('Set Type Refinement', () => {
    it('should refine Set<weak> to Set<int> after add', () => {
      const code = `
        let set = Set()
        set.add(1)
        set.add(2)
        print(typeof(set))
      `;
      expect(expectBothToEqual(code)).toEqual(['Set<int>']);
    });

    it('should refine Set to Set<string> after add', () => {
      const code = `
        let set = Set()
        set.add("hello")
        set.add("world")
        print(typeof(set))
      `;
      expect(expectBothToEqual(code)).toEqual(['Set<string>']);
    });

    it('should throw with mixed element types', () => {
      const code = `
        let set = Set()
        set.add(1)
        set.add("hello")
        set.add(2)
        print(typeof(set))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });

    it('should throw with multiple types', () => {
      const code = `
        let set = Set()
        set.add(1)
        set.add(true)
        set.add(3.14)
        print(typeof(set))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });
  });

  describe('Array Type Refinement', () => {
    it('should refine Array to Array<int> after elements', () => {
      const code = `
        let arr = []
        arr.push(1)
        arr.push(2)
        print(typeof(arr))
      `;
      expect(expectBothToEqual(code)).toEqual(['Array<int>']);
    });

    it('should report type mismatch with mixed push', () => {
      const code = `
        let arr = []
        arr.push(1)
        arr.push("hello")
        print(typeof(arr))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });

    it('should throw with multiple types', () => {
      const code = `
        let arr = []
        arr.push(1)
        arr.push(true)
        arr.push(3.14)
        print(typeof(arr))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });
  });

  describe('MinHeap/MaxHeap Type Refinement', () => {
    it('should refine MinHeap<weak> to MinHeap<int> after push', () => {
      const code = `
        let heap = MinHeap()
        heap.push(5)
        heap.push(3)
        heap.push(7)
        print(typeof(heap))
      `;
      expect(expectBothToEqual(code)).toEqual(['Heap<int>']);
    });

    it('should refine MaxHeap to MaxHeap<float> after push', () => {
      const code = `
        let heap = MaxHeap()
        heap.push(3.14)
        heap.push(2.71)
        print(typeof(heap))
      `;
      expect(expectBothToEqual(code)).toEqual(['Heap<float>']); 
    });

    it('should fail with mixed types', () => {
      const code = `
        let heap = MinHeap()
        heap.push(5)
        heap.push(3.14)
        print(typeof(heap))
      `;
      expectBothToThrow(code, /Type mismatch/);
    });
  });

  describe('Nested Data Structures with Refinement', () => {
    it('should refine Map with Array values: Map<string, Array<int>>', () => {
      const code = `
        let map = Map()
        map.set("nums", [1, 2, 3])
        print(typeof(map))
      `;
      expect(expectBothToEqual(code)).toEqual(['Map<string, Array<int>>']);
    });

    it('should refine Map with Map values: Map<string, Map<int, boolean>>', () => {
      const code = `
        let outer = Map()
        let inner = Map()
        inner.set(1, true)
        outer.set("nested", inner)
        print(typeof(outer))
      `;
      const output = run(code);
      expect(output).toEqual(runMachine(code));
      expect(output).toEqual(['Map<string, Map<int, boolean>>']);
    });

    it('should refine Array of Maps: Array<Map<string, int>>', () => {
      const code = `
        let arr = []
        let map1 = Map()
        map1.set("a", 1)
        let map2 = Map()
        map2.set("b", 2)
        arr.push(map1)
        arr.push(map2)
        print(typeof(arr))
      `;
      const output = run(code);
      expect(output).toEqual(runMachine(code));
      expect(output).toEqual(['Array<Map<string, int>>']);
    });

    it('should throw with union of nested structures (union types not supported)', () => {
      const code = `
        let map = Map()
        map.set("arr", [1, 2])
        map.set("num", 42)
        print(typeof(map))
      `;
      expect(() => run(code)).toThrow(); 
      expect(() => runMachine(code)).toThrow();
    });
  });

    

  describe('Negative Tests - Type Mismatches', () => {
    it('should fail when assigning wrong type to typed Map', () => {
      const code = `
        do main() {
          let map: Map<string, int> = Map()
          map.set("key", "not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when using wrong key type in typed Map', () => {
      const code = `
        do main() {
          let map: Map<string, int> = Map()
          map.set(123, 456)
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when adding wrong type to typed Set', () => {
      const code = `
        do main() {
          let set: Set<int> = Set()
          set.add("not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when pushing wrong type to typed MinHeap', () => {
      const code = `
        do main() {
          let heap: MinHeap<int> = MinHeap()
          heap.push("not_an_int")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail with nested structure type mismatch', () => {
      const code = `
        do main() {
          let map: Map<string, Array<int>> = Map()
          map.set("arr", [1, 2, "oops"])
        }
      `;
      expect(() => check(code)).toThrow('array elements must be of the same type');
    });

    it('should fail when nested Map has wrong inner type', () => {
      const code = `
        do main() {
          let outer: Map<string, Map<int, boolean>> = Map()
          let inner: Map<int, string> = Map()
          inner.set(1, "wrong")
          outer.set("nested", inner)
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Positive Tests - Valid Type Annotations', () => {
    
    it('should accept valid nested Map structures', () => {
      const code = `
        do main() {
          let outer: Map<string, Map<int, boolean>> = Map()
          let inner: Map<int, boolean> = Map()
          inner.set(1, true)
          outer.set("nested", inner)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should accept valid Map with Array values', () => {
      const code = `
        do main() {
          let map: Map<string, Array<int>> = Map()
          map.set("nums", [1, 2, 3])
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should accept valid Array of Sets', () => {
      const code = `
        do main() {
          let arr: Array<Set<int>> = []
          let set1: Set<int> = Set()
          set1.add(1)
          arr.push(set1)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });
  });

  describe('Mixed Refinement Scenarios', () => {
    it('should refine multiple data structures in sequence', () => {
      const code = `
        let map = Map()
        let set = Set()
        let arr = []

        map.set("key", 1)
        set.add("value")
        arr.push(true)

        print(typeof(map))
        print(typeof(set))
        print(typeof(arr))
      `;
      const output = run(code);
      expect(output).toEqual(runMachine(code));
      expect(output).toEqual(['Map<string, int>', 'Set<string>', 'Array<boolean>']);
    });

    it('should throw with progressive refinement attempting union types', () => {
      const code = `
        let map = Map()
        map.set("a", 1)
        print(typeof(map))
        map.set("b", true)
        print(typeof(map))
      `;
      expect(() => run(code)).toThrow(); 
      expect(() => runMachine(code)).toThrow();
    });
  });
});
