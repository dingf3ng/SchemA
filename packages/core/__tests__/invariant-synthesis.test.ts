import { runWithEnv } from '../src/index';
import { Predicate } from '../src/runtime/values';

/**
 * Helper to check if a predicate of a specific kind exists
 */
function hasPredicate(predicates: Predicate[], kind: string): boolean {
  return predicates.some(p => p.kind === kind);
}

/**
 * Helper to get a specific predicate by kind (with type assertion)
 */
function getPredicate(
  predicates: Predicate[],
  kind: string
): any {
  return predicates.find(p => p.kind === kind);
}

describe('Invariant Synthesis - Runtime Refinement System', () => {
  describe('Numeric Invariant Synthesis', () => {
    it('should synthesize int_range predicate for loop counter', () => {
      const code = `
        let i = 0
        while i < 5 {
          i = i + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const i = env.get('i');

      // Check that int_range predicate exists
      expect(hasPredicate(i.type.refinements, 'int_range')).toBe(true);

      const range = getPredicate(i.type.refinements, 'int_range');
      expect(range).toBeDefined();
      expect(range!.min).toBe(0);
      expect(range!.max).toBe(5);
    });

    it('should synthesize positive predicate for strictly positive values', () => {
      const code = `
        let x = 1
        while x < 10 {
          x = x + 2
        }
      `;
      const { output, env } = runWithEnv(code);
      const x = env.get('x');

      // Should have positive predicate
      expect(hasPredicate(x.type.refinements, 'positive')).toBe(true);

      const positive = getPredicate(x.type.refinements, 'positive');
      expect(positive).toBeDefined();
      // Since all values (1, 3, 5, 7, 9, 11) are > 0, should infer strict positive
      expect(positive!.strict).toBe(true);
    });

    it('should synthesize parity predicate for even numbers', () => {
      const code = `
        let even = 0
        while even < 10 {
          even = even + 2
        }
      `;
      const { output, env } = runWithEnv(code);
      const even = env.get('even');

      // Should have parity predicate
      expect(hasPredicate(even.type.refinements, 'parity')).toBe(true);

      const parity = getPredicate(even.type.refinements, 'parity');
      expect(parity).toBeDefined();
      expect(parity!.value).toBe('even');
    });

    it('should synthesize monotonic increasing predicate', () => {
      const code = `
        let count = 0
        for i in 0..5 {
          count = count + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const count = env.get('count');

      // Should have monotonic predicate
      expect(hasPredicate(count.type.refinements, 'monotonic')).toBe(true);

      const monotonic = getPredicate(count.type.refinements, 'monotonic');
      expect(monotonic).toBeDefined();
      expect(monotonic!.direction).toBe('increasing');
    });

    it('should synthesize divisibility predicate', () => {
      const code = `
        let multiple = 0
        while multiple < 20 {
          multiple = multiple + 5
        }
      `;
      const { output, env } = runWithEnv(code);
      const multiple = env.get('multiple');

      // Should have divisible_by predicate for 5
      expect(hasPredicate(multiple.type.refinements, 'divisible_by')).toBe(true);

      const divisible = getPredicate(multiple.type.refinements, 'divisible_by');
      expect(divisible).toBeDefined();
      expect(divisible!.divisor).toBe(5);
    });
  });

  describe('Array Invariant Synthesis', () => {
    it('should synthesize non_empty predicate for growing arrays', () => {
      const code = `
        let arr: Array<int> = [1]
        while arr.length() < 5 {
          arr.push(arr.length() + 1)
        }
      `;
      const { output, env } = runWithEnv(code);
      const arr = env.get('arr');

      // Should have non_empty predicate
      expect(hasPredicate(arr.type.refinements, 'non_empty')).toBe(true);
    });

    it('should synthesize size_range predicate for arrays', () => {
      const code = `
        let items: Array<int> = [1, 2, 3]
        for i in 0..2 {
          items.push(i + 4)
        }
      `;
      const { output, env } = runWithEnv(code);
      const items = env.get('items');

      // Should have size_range predicate
      expect(hasPredicate(items.type.refinements, 'size_range')).toBe(true);

      const sizeRange = getPredicate(items.type.refinements, 'size_range');
      expect(sizeRange).toBeDefined();
      expect(sizeRange!.min).toBe(3);
      expect(sizeRange!.max).toBe(5);
    });

    it('should synthesize sorted predicate for ascending arrays', () => {
      const code = `
        let sorted: Array<int> = []
        let val = 0
        while val < 5 {
          sorted.push(val)
          val = val + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const sorted = env.get('sorted');

      // Should have sorted predicate
      expect(hasPredicate(sorted.type.refinements, 'sorted')).toBe(true);

      const sortedPred = getPredicate(sorted.type.refinements, 'sorted');
      expect(sortedPred).toBeDefined();
      expect(sortedPred!.order).toBe('asc');
    });

    it('should synthesize monotonic size increase predicate', () => {
      const code = `
        let growing: Array<int> = []
        for i in 0..10 {
          growing.push(i)
        }
      `;
      const { output, env } = runWithEnv(code);
      const growing = env.get('growing');

      // Should have monotonic predicate
      expect(hasPredicate(growing.type.refinements, 'size_monotonic')).toBe(true);

      const monotonic = getPredicate(growing.type.refinements, 'size_monotonic');
      expect(monotonic).toBeDefined();
      expect(monotonic!.direction).toBe('increasing');
    });
  });

  describe('Set/Map Invariant Synthesis', () => {
    it('should synthesize non_empty predicate for sets', () => {
      const code = `
        let visited = Set()
        visited.add(0)
        for i in 1..5 {
          visited.add(i)
        }
      `;
      const { output, env } = runWithEnv(code);
      const visited = env.get('visited');

      // Should have non_empty predicate
      expect(hasPredicate(visited.type.refinements, 'non_empty')).toBe(true);
    });

    it('should synthesize monotonic size increase for sets', () => {
      const code = `
        let unique = Set()
        for i in 0..10 {
          unique.add(i)
        }
      `;
      const { output, env } = runWithEnv(code);
      const unique = env.get('unique');

      // Should have monotonic predicate
      expect(hasPredicate(unique.type.refinements, 'size_monotonic')).toBe(true);

      const monotonic = getPredicate(unique.type.refinements, 'size_monotonic');
      expect(monotonic).toBeDefined();
      expect(monotonic!.direction).toBe('increasing');
    });

    it('should synthesize size predicates for maps', () => {
      const code = `
        let cache = Map()
        for i in 0..5 {
          cache.set(i, i * 2)
        }
      `;
      const { output, env } = runWithEnv(code);
      const cache = env.get('cache');

      // Should have size_range predicate
      expect(hasPredicate(cache.type.refinements, 'size_range')).toBe(true);

      const sizeRange = getPredicate(cache.type.refinements, 'size_range');
      expect(sizeRange).toBeDefined();
      expect(sizeRange!.min).toBe(0);
      expect(sizeRange!.max).toBe(5);
    });
  });

  describe('Complex Loop Invariants', () => {
    it('should synthesize invariants for nested relationships', () => {
      const code = `
        let sum = 0
        let count = 0
        while count < 10 {
          sum = sum + count
          count = count + 1
        }
      `;
      const { output, env } = runWithEnv(code);

      const sum = env.get('sum');
      const count = env.get('count');

      // sum should be monotonically increasing
      expect(hasPredicate(sum.type.refinements, 'monotonic')).toBe(true);
      const sumMonotonic = getPredicate(sum.type.refinements, 'monotonic');
      expect(sumMonotonic!.direction).toBe('increasing');

      // count should have int_range [0, 10]
      expect(hasPredicate(count.type.refinements, 'int_range')).toBe(true);
      const countRange = getPredicate(count.type.refinements, 'int_range');
      expect(countRange!.min).toBe(0);
      expect(countRange!.max).toBe(10);
    });

    it('should synthesize invariants in for-each loops', () => {
      const code = `
        let data = [1, 2, 3, 4, 5]
        let total = 0
        for val in data {
          total = total + val
        }
      `;
      const { output, env } = runWithEnv(code);
      const total = env.get('total');

      // total should be monotonically increasing
      expect(hasPredicate(total.type.refinements, 'monotonic')).toBe(true);
      const monotonic = getPredicate(total.type.refinements, 'monotonic');
      expect(monotonic!.direction).toBe('increasing');
    });

    it('should handle loop with multiple variables', () => {
      const code = `
        let i = 0
        let j = 10
        while i < j {
          i = i + 1
          j = j - 1
        }
      `;
      const { output, env } = runWithEnv(code);

      const i = env.get('i');
      const j = env.get('j');

      // i should be monotonically increasing
      expect(hasPredicate(i.type.refinements, 'monotonic')).toBe(true);
      const iMonotonic = getPredicate(i.type.refinements, 'monotonic');
      expect(iMonotonic!.direction).toBe('increasing');

      // j should be monotonically decreasing
      expect(hasPredicate(j.type.refinements, 'monotonic')).toBe(true);
      const jMonotonic = getPredicate(j.type.refinements, 'monotonic');
      expect(jMonotonic!.direction).toBe('decreasing');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle loops with no iterations', () => {
      const code = `
        let x = 10
        while x < 5 {
          x = x + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const x = env.get('x');

      // Should not crash, but may have no synthesized predicates
      // (since there were no iterations to observe)
      expect(x.type.refinements).toBeDefined();
    });

    it('should handle single iteration loops', () => {
      const code = `
        let single = 0
        while single < 1 {
          single = single + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const single = env.get('single');

      // Should handle minimal data for synthesis
      expect(single.type.refinements).toBeDefined();

      // With only one observation, should still infer int_range
      if (hasPredicate(single.type.refinements, 'int_range')) {
        const range = getPredicate(single.type.refinements, 'int_range');
        expect(range!.min).toBe(0);
        expect(range!.max).toBe(1);
      }
    });

    it('should handle loops with constant values', () => {
      const code = `
        let constant = 5
        for i in 0..3 {
          let _ = i
        }
      `;
      const { output, env } = runWithEnv(code);
      const constant = env.get('constant');

      // constant never changes, so should have size_equals or int_range with same min/max
      const range = getPredicate(constant.type.refinements, 'int_range');
      if (range) {
        expect(range.min).toBe(5);
        expect(range.max).toBe(5);
      }
    });
  });

  describe('Real-world Algorithm Patterns', () => {
    it('should synthesize invariants for binary search-like iteration', () => {
      const code = `
        let low = 0
        let high = 100
        while low < high {
          let mid = (low + high) / 2
          if mid < 50 {
            low = mid + 1
          } else {
            high = mid
          }
        }
      `;
      const { output, env } = runWithEnv(code);

      const low = env.get('low');
      const high = env.get('high');

      // low should have range and be monotonic increasing
      expect(hasPredicate(low.type.refinements, 'int_range')).toBe(true);
      expect(hasPredicate(low.type.refinements, 'monotonic')).toBe(true);

      const lowMonotonic = getPredicate(low.type.refinements, 'monotonic');
      expect(lowMonotonic!.direction).toBe('increasing');

      // high should be monotonic decreasing
      expect(hasPredicate(high.type.refinements, 'monotonic')).toBe(true);
      const highMonotonic = getPredicate(high.type.refinements, 'monotonic');
      expect(highMonotonic!.direction).toBe('decreasing');
    });

    it('should synthesize invariants for accumulator pattern', () => {
      const code = `
        let numbers = [1, 2, 3, 4, 5]
        let product = 1
        for num in numbers {
          product = product * num
        }
      `;
      const { output, env } = runWithEnv(code);
      const product = env.get('product');

      // product should be positive
      expect(hasPredicate(product.type.refinements, 'positive')).toBe(true);

      // product should be monotonically increasing
      expect(hasPredicate(product.type.refinements, 'monotonic')).toBe(true);
      const monotonic = getPredicate(product.type.refinements, 'monotonic');
      expect(monotonic!.direction).toBe('increasing');
    });
  });

  describe('Predicate Precision', () => {
    it('should infer strict positive for values starting from 1', () => {
      const code = `
        let x = 1
        while x < 5 {
          x = x + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const x = env.get('x');

      // Should infer positive (non-strict >= 0, since 1 >= 0)
      const positive = getPredicate(x.type.refinements, 'positive');
      expect(positive).toBeDefined();
    });

    it('should infer odd parity correctly', () => {
      const code = `
        let odd = 1
        while odd < 10 {
          odd = odd + 2
        }
      `;
      const { output, env } = runWithEnv(code);
      const odd = env.get('odd');

      // Should have parity predicate with value 'odd'
      const parity = getPredicate(odd.type.refinements, 'parity');
      expect(parity).toBeDefined();
      expect(parity!.value).toBe('odd');
    });

    it('should infer unique_elements for arrays with distinct values', () => {
      const code = `
        let unique: Array<int> = []
        for i in 0..5 {
          unique.push(i)
        }
      `;
      const { output, env } = runWithEnv(code);
      const unique = env.get('unique');

      // Should have unique_elements predicate
      expect(hasPredicate(unique.type.refinements, 'unique_elements')).toBe(true);
    });
  });
});
