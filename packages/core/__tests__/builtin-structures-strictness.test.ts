import { AntlrParser } from '../src/parser';
import { TypeChecker } from '../src/typechecker';

function check(code: string) {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  const typeChecker = new TypeChecker();
  typeChecker.infer(ast);
  typeChecker.check(ast);
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

  describe('Integration with Union and Intersection Types', () => {
    it('should support Union types in data structures', () => {
      const code = `
        do main() {
          // Key can be int or string
          let m: MinHeapMap<int | string, boolean> = MinHeapMap()
          m.push(1, true)
          m.push("key", false)
          
          let k: int | string = m.pop()
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should support Intersection types in data structures', () => {
      const code = `
        do main() {
          // Value must satisfy both constraints (hypothetically, though primitive intersection is usually empty/never, 
          // structurally it validates the parser/checker handling)
          // Let's use a more realistic structural intersection if we had objects, 
          // but for now we test the type system accepts the syntax and logic.
          let h: MinHeap<int & float> = MinHeap() 
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should enforce Union type constraints on operations', () => {
      const code = `
        do main() {
          let m: MinHeapMap<int | string, boolean> = MinHeapMap()
          m.push(true, true) // Error: boolean is not int | string
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Type Inference with Built-ins', () => {
    it('should infer generic types from constructor when explicit type is omitted', () => {
      const code = `
        do main() {
          let m = MinHeapMap() // Infers MinHeapMap< int | string , int | string>
          m.push(1, "value")
          m.push("key", 2)
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should validate types when explicit type is provided but constructor is generic', () => {
      const code = `
        do main() {
          let m: MinHeapMap<int, string> = MinHeapMap()
          m.push(1, "val")
          // m.push("bad", "val") // This would be a runtime/compile error if we checked push args against variable type
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
