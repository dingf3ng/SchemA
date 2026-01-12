import { parse } from '../src/transpiler/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';

function check(code: string) {
  const ast = parse(code);
  
  typeCheck(ast);
}

describe('Built-in Data Structures Strictness & Advanced Types', () => {
  
  describe('Strict Type Argument Validation', () => {
    it('should fail when MinHeapMap has incorrect number of type arguments', () => {
      const code1 = `
        do main() {
          let m: MinHeapMap<int> = MinHeapMap() // Too few
        }
      `;
      expect(() => check(code1)).toThrow('HeapMap type requires exactly two type parameters');

      const code2 = `
        do main() {
          let m: MinHeapMap<int, int, int> = MinHeapMap() // Too many
        }
      `;
      expect(() => check(code2)).toThrow('HeapMap type requires exactly two type parameters');
    });

    it('should fail when MinHeap/MaxHeap has incorrect number of type arguments', () => {
      const code = `
        do main() {
          let h: MinHeap<int, string> = MinHeap() // Too many
        }
      `;
      expect(() => check(code)).toThrow('Heap type requires exactly one type parameter');
    });

    it('should fail when Graph has incorrect number of type arguments', () => {
      const code = `
        do main() {
          let g: Graph<int, string> = Graph(true) // Too many
        }
      `;
      expect(() => check(code)).toThrow('Graph type requires exactly one type parameter');
    });
  });

  describe('Type Inference with Built-ins', () => {
    it('should refine generic types from first usage', () => {
      // First usage refines the type, subsequent usages must match
      const code = `
        do main() {
          let m = MinHeapMap()
          m.push(1, "value")
          m.push(2, "another") // Same types as first usage - OK
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail when subsequent usage has different types than first usage', () => {
      // After first push refines to MinHeapMap<int, string>, second push with different types should fail
      const code = `
        do main() {
          let m = MinHeapMap()
          m.push(1, "value")
          m.push("key", 2) // Different types - should fail
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should validate types when explicit type is provided but constructor is generic', () => {
      const code = `
        do main() {
          let m: MinHeapMap<int, string> = MinHeapMap()
          m.push(1, "val")
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should catch mismatches between variable type and usage even with inference involved', () => {
       const code = `
        do main() {
          let m: MinHeapMap<int, string> = MinHeapMap()
          m.push("not-int", "val")
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });
});
