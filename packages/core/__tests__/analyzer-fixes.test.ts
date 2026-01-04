import { run } from '../src/index';

describe('Analyzer and Synthesizer Fixes', () => {
  describe('New Predicates', () => {
    describe('greater_than predicate', () => {
      it('should check if value is greater than threshold', () => {
        const code = `
          let x: int = 10
          @assert(x |- @greater_than(5))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if value is not greater than threshold', () => {
        const code = `
          let x: int = 3
          @assert(x |- @greater_than(5))
        `;
        expect(() => run(code)).toThrow();
      });

      it('should work with alias gt', () => {
        const code = `
          let x: int = 10
          @assert(x |- @gt(5))
        `;
        expect(() => run(code)).not.toThrow();
      });
    });

    describe('greater_equal_than predicate', () => {
      it('should check if value is greater than or equal to threshold', () => {
        const code = `
          let x: int = 5
          @assert(x |- @greater_equal_than(5))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if value is less than threshold', () => {
        const code = `
          let x: int = 4
          @assert(x |- @greater_equal_than(5))
        `;
        expect(() => run(code)).toThrow();
      });

      it('should work with alias gte', () => {
        const code = `
          let x: int = 5
          @assert(x |- @gte(5))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should work with alias ge', () => {
        const code = `
          let x: int = 5
          @assert(x |- @ge(5))
        `;
        expect(() => run(code)).not.toThrow();
      });
    });

    describe('not predicate', () => {
      it('should negate a predicate', () => {
        const code = `
          let x: int = -5
          @assert(x |- @not(@positive))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail when negated predicate is true', () => {
        const code = `
          let x: int = 5
          @assert(x |- @not(@positive))
        `;
        expect(() => run(code)).toThrow();
      });

      it('should work with complex predicates', () => {
        const code = `
          let x: int = 3
          @assert(x |- @not(@even))
        `;
        expect(() => run(code)).not.toThrow();
      });
    });

    describe('is_permutation_of predicate', () => {
      it('should detect permutations correctly', () => {
        const code = `
          let original: Array<int> = [1, 2, 3]
          let permuted: Array<int> = [3, 1, 2]

          for i in ..3 {
            @invariant(permuted |- @is_permutation_of(original))
          }
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail for non-permutations', () => {
        const code = `
          let original: Array<int> = [1, 2, 3]
          let different: Array<int> = [1, 2, 4]

          @invariant(different, @is_permutation_of(original))
        `;
        expect(() => run(code)).toThrow();
      });

      it('should handle duplicates correctly', () => {
        const code = `
          let original: Array<int> = [1, 2, 2, 3]
          let permuted: Array<int> = [2, 3, 1, 2]

          @assert(permuted |- @is_permutation_of(original))
        `;
        expect(() => run(code)).not.toThrow();
      });
    });
  });

  describe('Fixed: Recursive Predicate Checking', () => {
    describe('range_satisfies with element checking', () => {
      it('should check predicates on array elements in range', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3, 4, 5]
          @assert(arr |- @range_satisfies(0, 3, @positive))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail when elements do not satisfy predicate', () => {
        const code = `
          let arr: Array<int> = [1, -2, 3]
          @assert(arr |- @range_satisfies(0, 3, @positive))
        `;
        expect(() => run(code)).toThrow();
      });

      it('should work with greater_than predicate', () => {
        const code = `
          let arr: Array<int> = [10, 20, 30]
          @assert(arr |- @range_satisfies(0, 3, @greater_than(5)))
        `;
        expect(() => run(code)).not.toThrow();
      });
    });

    describe('all_elements_satisfy with element checking', () => {
      it('should check all elements satisfy predicate', () => {
        const code = `
          let arr: Array<int> = [2, 4, 6, 8]
          @assert(arr |- @all_elements_satisfy(@even))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail when some elements do not satisfy', () => {
        const code = `
          let arr: Array<int> = [2, 4, 5, 8]
          @assert(arr |- @all_elements_satisfy(@even))
        `;
        expect(() => run(code)).toThrow();
      });

      it('should work with positive predicate', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3, 4]
          @assert(arr |- @all_elements_satisfy(@positive))
        `;
        expect(() => run(code)).not.toThrow();
      });
    });
  });

  describe('Temporal vs Point-in-time Predicates', () => {
    describe('monotonic (temporal)', () => {
      it('should track monotonic "increasing" values across iterations', () => {
        const code = `
          let x: int = 0

          for i in 0..5 {
            x = x + 1
            @invariant(x |- @monotonic("increasing", false))
          }
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail when value decreases', () => {
        const code = `
          let x: int = 10

          for i in 0..3 {
            x = x - 1
            @invariant(x |- @monotonic("increasing", false))
          }
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('size_monotonic (temporal)', () => {
      it('should track monotonic "increasing" array size', () => {
        const code = `
          let arr: Array<int> = []

          for i in 0..5 {
            arr.push(i)
            @invariant(arr |- @size_monotonic("increasing", false))
          }
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail when size decreases', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3]

          for i in 0..2 {
            arr.pop()
            @invariant(arr |- @size_monotonic("increasing", false))
          }
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('positive (point-in-time)', () => {
      it('should check current value only', () => {
        const code = `
          let x: int = -5
          x = 10
          @assert(x |- @positive)
        `;
        expect(() => run(code)).not.toThrow();
      });
    });
  });

  describe('Error Handling Improvements', () => {
    describe('Unimplemented predicates throw clear errors', () => {
      it('should throw error for acyclic predicate', () => {
        const code = `
          let g: Graph<int> = Graph(true)
          @assert(g |- @acyclic)
        `;
        expect(() => run(code)).toThrow(/not yet implemented/);
      });
    });
  });

  describe('Type Safety Improvements', () => {
    describe('Graph predicates with type guards', () => {
      it('should validate Graph instance for graph predicates', () => {
        const code = `
          let g: Graph<int> = Graph(true)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 5)

          @assert(g |- @all_weights_non_negative)
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail with negative weights', () => {
        const code = `
          let g: Graph<int> = Graph(true)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, -5)

          @assert(g |- @all_weights_non_negative)
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('Collection size predicates with type guards', () => {
      it('should work with SchemaArray', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3]
          @assert(arr |- @non_empty)
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should work with SchemaSet', () => {
        const code = `
          let s: Set<int> = Set()
          s.add(1)
          @assert(s |- @non_empty)
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should work with SchemaMap', () => {
        const code = `
          let m: Map<int, int> = Map()
          m.set(1, 10)
          @assert(m |- @non_empty)
        `;
        expect(() => run(code)).not.toThrow();
      });
    });
  });

  describe('Additional Predicates', () => {
    describe('int_range predicate', () => {
      it('should check if value is within range', () => {
        const code = `
          let x: int = 5
          @assert(x |- @int_range(0, 10))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if value is outside range', () => {
        const code = `
          let x: int = 15
          @assert(x |- @int_range(0, 10))
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('divisible_by predicate', () => {
      it('should check if value is divisible by divisor', () => {
        const code = `
          let x: int = 10
          @assert(x |- @divisible_by(2))
          @assert(x |- @divisible_by(5))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if value is not divisible', () => {
        const code = `
          let x: int = 10
          @assert(x |- @divisible_by(3))
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('parity predicate', () => {
      it('should check for even parity', () => {
        const code = `
          let x: int = 4
          @assert(x |- @parity("even"))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should check for odd parity', () => {
        const code = `
          let x: int = 3
          @assert(x |- @parity("odd"))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if parity does not match', () => {
        const code = `
          let x: int = 4
          @assert(x |- @parity("odd"))
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('sorted predicate', () => {
      it('should check if array is sorted ascending', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3, 4]
          @assert(arr |- @sorted("asc"))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should check if array is sorted descending', () => {
        const code = `
          let arr: Array<int> = [4, 3, 2, 1]
          @assert(arr |- @sorted("desc"))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if array is not sorted', () => {
        const code = `
          let arr: Array<int> = [1, 3, 2, 4]
          @assert(arr |- @sorted("asc"))
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('unique_elements predicate', () => {
      it('should check if array has unique elements', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3, 4]
          @assert(arr |- @unique_elements)
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if array has duplicates', () => {
        const code = `
          let arr: Array<int> = [1, 2, 2, 4]
          @assert(arr |- @unique_elements)
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('size_range predicate', () => {
      it('should check if collection size is within range', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3]
          @assert(arr |- @size_range(1, 5))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if collection size is outside range', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3]
          @assert(arr |- @size_range(5, 10))
        `;
        expect(() => run(code)).toThrow();
      });
    });

    describe('size_equals predicate', () => {
      it('should check if collection size equals value', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3]
          @assert(arr |- @size_equals(3))
        `;
        expect(() => run(code)).not.toThrow();
      });

      it('should fail if collection size does not equal value', () => {
        const code = `
          let arr: Array<int> = [1, 2, 3]
          @assert(arr |- @size_equals(2))
        `;
        expect(() => run(code)).toThrow();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should combine multiple new features', () => {
      const code = `
        let arr: Array<int> = [5, 10, 15, 20]

        @assert(arr |- @non_empty)
        @assert(arr |- @all_elements_satisfy(@greater_than(0)))
        @assert(arr |- @range_satisfies(0, 4, @positive))
        @assert(arr |- @not(@sorted("desc")))
      `;
      expect(() => run(code)).not.toThrow();
    });

    it('should work in loops with temporal predicates', () => {
      const code = `
        let sum: int = 0
        let arr: Array<int> = []

        for i in 1..6 {
          sum = sum + i
          arr.push(i)

          @invariant(sum |- @monotonic("increasing", true))
          @invariant(sum |- @positive)
          @invariant(sum |- @greater_equal_than(0))
          @invariant(arr |- @size_monotonic("increasing", true))
          @invariant(arr |- @all_elements_satisfy(@positive))
        }
      `;
      expect(() => run(code)).not.toThrow();
    });

    it('should verify sorting algorithm with permutation', () => {
      const code = `
        let original: Array<int> = [3, 1, 4, 1, 5]
        let sorted: Array<int> = [1, 1, 3, 4, 5]

        @assert(sorted |- @is_permutation_of(original))
        @assert(sorted |- @sorted("asc"))
      `;
      expect(() => run(code)).not.toThrow();
    });
  });
});
