import { run } from '../src/index';
import { parse } from '../src/transpiler/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';

function check(code: string) {
  const ast = parse(code);
  typeCheck(ast);
}

describe('Map Type Refinement', () => {
  describe('Basic Map Refinement', () => {
    it('should refine Map<weak, weak> to Map<string, int> after set', () => {
      const code = `
        let map = Map()
        map.set("a", 1)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<string, int>']);
    });

    it('should refine Map to Map<int, string> after multiple sets', () => {
      const code = `
        let map = Map()
        map.set(1, "hello")
        map.set(2, "world")
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<int, string>']);
    });

    it('should refine Map to Map<boolean, float> after set', () => {
      const code = `
        let map = Map()
        map.set(true, 3.14)
        map.set(false, 2.71)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<boolean, float>']);
    });
  });

  describe('Map Refinement with Union Types', () => {
    it('should refine Map to Map<string, int | boolean> with mixed value types', () => {
      const code = `
        let map = Map()
        map.set("a", 1)
        map.set("b", true)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<string, int | boolean>']);
    });

    it('should refine Map to Map<int | string, boolean> with mixed key types', () => {
      const code = `
        let map = Map()
        map.set(1, true)
        map.set("key", false)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<int | string, boolean>']);
    });

    it('should refine Map to Map<int | string, int | float> with fully mixed types', () => {
      const code = `
        let map = Map()
        map.set(1, 100)
        map.set("key", 3.14)
        map.set(2, 200)
        map.set("another", 2.71)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<int | string, int | float>']);
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
      const output = run(code);
      expect(output).toEqual(['Set<int>']);
    });

    it('should refine Set to Set<string> after add', () => {
      const code = `
        let set = Set()
        set.add("hello")
        set.add("world")
        print(typeof(set))
      `;
      const output = run(code);
      expect(output).toEqual(['Set<string>']);
    });

    it('should refine Set to Set<int | string> with mixed element types', () => {
      const code = `
        let set = Set()
        set.add(1)
        set.add("hello")
        set.add(2)
        print(typeof(set))
      `;
      const output = run(code);
      expect(output).toEqual(['Set<int | string>']);
    });

    it('should refine Set to Set<int | boolean | float> with multiple union members', () => {
      const code = `
        let set = Set()
        set.add(1)
        set.add(true)
        set.add(3.14)
        print(typeof(set))
      `;
      const output = run(code);
      expect(output).toEqual(['Set<int | boolean | float>']);
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
      const output = run(code);
      expect(output).toEqual(['Array<int>']);
    });

    it('should refine Array to Array<string | int> with mixed push', () => {
      const code = `
        let arr = []
        arr.push(1)
        arr.push("hello")
        print(typeof(arr))
      `;
      const output = run(code);
      expect(output).toEqual(['Array<int | string>']);
    });

    it('should refine Array to Array<int | boolean | float> with multiple types', () => {
      const code = `
        let arr = []
        arr.push(1)
        arr.push(true)
        arr.push(3.14)
        print(typeof(arr))
      `;
      const output = run(code);
      expect(output).toEqual(['Array<int | boolean | float>']);
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
      const output = run(code);
      expect(output).toEqual(['Heap<int>']);
    });

    it('should refine MaxHeap to MaxHeap<float> after push', () => {
      const code = `
        let heap = MaxHeap()
        heap.push(3.14)
        heap.push(2.71)
        print(typeof(heap))
      `;
      const output = run(code);
      expect(output).toEqual(['Heap<float>']);
    });

    it('should refine MinHeap to MinHeap<int | float> with mixed types', () => {
      const code = `
        let heap = MinHeap()
        heap.push(5)
        heap.push(3.14)
        print(typeof(heap))
      `;
      const output = run(code);
      expect(output).toEqual(['Heap<int | float>']);
    });
  });

  describe('Nested Data Structures with Refinement', () => {
    it('should refine Map with Array values: Map<string, Array<int>>', () => {
      const code = `
        let map = Map()
        map.set("nums", [1, 2, 3])
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<string, Array<int>>']);
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
      expect(output).toEqual(['Array<Map<string, int>>']);
    });

    it('should refine Map with union of nested structures', () => {
      const code = `
        let map = Map()
        map.set("arr", [1, 2])
        map.set("num", 42)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual(['Map<string, Array<int> | int>']);
    });
  });

  describe('Refinement with Intersection Types', () => {
    it('should handle Map with intersection type annotation', () => {
      const code = `
        do main() {
          let map: Map<int & float, string> = Map()
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should handle Set with intersection type annotation', () => {
      const code = `
        do main() {
          let set: Set<int & float> = Set()
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should handle MinHeap with intersection type annotation', () => {
      const code = `
        do main() {
          let heap: MinHeap<int & float> = MinHeap()
        }
      `;
      expect(() => check(code)).not.toThrow();
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

    it('should fail when Map union type constraint is violated', () => {
      const code = `
        do main() {
          let map: Map<int | string, boolean> = Map()
          map.set(true, true)
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when Set union type constraint is violated', () => {
      const code = `
        do main() {
          let set: Set<int | string> = Set()
          set.add(true)
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
      expect(() => check(code)).toThrow('Type mismatch');
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
    it('should accept valid Map with union types', () => {
      const code = `
        do main() {
          let map: Map<int | string, boolean> = Map()
          map.set(1, true)
          map.set("key", false)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should accept valid Set with union types', () => {
      const code = `
        do main() {
          let set: Set<int | string | boolean> = Set()
          set.add(1)
          set.add("hello")
          set.add(true)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

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

    it('should accept complex union in Map values', () => {
      const code = `
        do main() {
          let map: Map<string, int | Array<int> | boolean> = Map()
          map.set("num", 42)
          map.set("arr", [1, 2, 3])
          map.set("flag", true)
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
      expect(output).toEqual(['Map<string, int>', 'Set<string>', 'Array<boolean>']);
    });

    it('should handle progressive refinement with increasing union complexity', () => {
      const code = `
        let map = Map()
        map.set("a", 1)
        print(typeof(map))
        map.set("b", true)
        print(typeof(map))
        map.set("c", 3.14)
        print(typeof(map))
      `;
      const output = run(code);
      expect(output).toEqual([
        'Map<string, int | boolean | float>',
        'Map<string, int | boolean | float>',
        'Map<string, int | boolean | float>'
      ]);
    });
  });
});
