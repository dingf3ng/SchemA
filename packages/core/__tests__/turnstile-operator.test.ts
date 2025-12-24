import { run } from '../src/index';

describe('Turnstile Operator (|-)', () => {
  describe('Basic Predicate Checks', () => {
    it('should check sorted predicate on sorted array', () => {
      const code = `
        let arr = [1, 2, 3, 4, 5]
        let is_sorted = arr |- @sorted
        print(is_sorted)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check sorted predicate on unsorted array', () => {
      const code = `
        let arr = [3, 1, 4, 1, 5]
        let is_sorted = arr |- @sorted
        print(is_sorted)
      `;
      const output = run(code);
      expect(output).toEqual(['false']);
    });

    it('should check sorted(asc) predicate', () => {
      const code = `
        let arr = [1, 2, 3, 4, 5]
        let is_sorted_asc = arr |- @sorted("asc")
        print(is_sorted_asc)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check sorted(desc) predicate', () => {
      const code = `
        let arr = [5, 4, 3, 2, 1]
        let is_sorted_desc = arr |- @sorted("desc")
        print(is_sorted_desc)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check non_empty predicate on non-empty array', () => {
      const code = `
        let arr = [1, 2, 3]
        let is_non_empty = arr |- @non_empty
        print(is_non_empty)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check non_empty predicate on empty array', () => {
      const code = `
        let arr: Array<int> = []
        let is_non_empty = arr |- @non_empty
        print(is_non_empty)
      `;
      const output = run(code);
      expect(output).toEqual(['false']);
    });

    it('should check unique_elements predicate on unique array', () => {
      const code = `
        let arr = [1, 2, 3, 4, 5]
        let is_unique = arr |- @unique
        print(is_unique)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check unique_elements predicate on non-unique array', () => {
      const code = `
        let arr = [1, 2, 3, 2, 5]
        let is_unique = arr |- @unique
        print(is_unique)
      `;
      const output = run(code);
      expect(output).toEqual(['false']);
    });
  });

  describe('Numeric Predicate Checks', () => {
    it('should check positive predicate on positive number', () => {
      const code = `
        let x = 42
        let is_positive = x |- @positive
        print(is_positive)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check positive predicate on negative number', () => {
      const code = `
        let x = -5
        let is_positive = x |- @positive
        print(is_positive)
      `;
      const output = run(code);
      expect(output).toEqual(['false']);
    });

    it('should check positive predicate on zero (non-strict)', () => {
      const code = `
        let x = 0
        let is_positive = x |- @positive
        print(is_positive)
      `;
      const output = run(code);
      expect(output).toEqual(['true']); // non-strict: >= 0
    });

    it('should check even parity', () => {
      const code = `
        let x = 42
        let is_even = x |- @even
        print(is_even)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check odd parity', () => {
      const code = `
        let x = 43
        let is_odd = x |- @odd
        print(is_odd)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check divisible_by predicate', () => {
      const code = `
        let x = 15
        let is_divisible = x |- @divisible_by(5)
        print(is_divisible)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check negative divisible_by predicate', () => {
      const code = `
        let x = 17
        let is_divisible = x |- @divisible_by(5)
        print(is_divisible)
      `;
      const output = run(code);
      expect(output).toEqual(['false']);
    });
  });

  describe('Collection Predicate Checks', () => {
    it('should check non_empty predicate on sets', () => {
      const code = `
        let s = Set()
        s.add(1)
        s.add(2)
        let is_non_empty = s |- @non_empty
        print(is_non_empty)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should check non_empty predicate on maps', () => {
      const code = `
        let m = Map()
        m.set(1, 10)
        let is_non_empty = m |- @non_empty
        print(is_non_empty)
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });
  });

  describe('Use in Control Flow', () => {
    it('should use turnstile operator in if statement', () => {
      const code = `
        let arr = [1, 2, 3, 4, 5]
        if arr |- @sorted {
          print("Array is sorted")
        } else {
          print("Array is not sorted")
        }
      `;
      const output = run(code);
      expect(output).toEqual(['Array is sorted']);
    });

    it('should use turnstile operator in while loop', () => {
      const code = `
        let arr = [1, 2, 3, 4, 5]
        let sorted_array: Array<int> = []
        while arr.length() > 0 {
          sorted_array.push(arr.length())
          arr.pop()
        }
        print(sorted_array |- @sorted("desc"))
      `;
      const output = run(code);
      expect(output).toEqual(['true']);
    });

    it('should combine multiple predicate checks', () => {
      const code = `
        let arr = [1, 2, 3, 4, 5]
        let is_valid = (arr |- @non_empty) && (arr |- @sorted) && (arr |- @unique)
        let invalid_arr = [1, 2, 2, 4, 5]
        let is_invalid = (invalid_arr |- @non_empty) && (invalid_arr |- @sorted) && (invalid_arr |- @unique)
        print(is_valid)
        print(is_invalid)
      `;
      const output = run(code);
      expect(output).toEqual(['true', 'false']);
    });

    describe('@assert with turnstile operator', () => {
      it('should pass assertion with turnstile operator', () => {
        const code = `
        let arr = [1, 2, 3, 4, 5]
        @assert(arr |- @sorted, "Array must be sorted")
        print("Assertion passed")
      `;
        const output = run(code);
        expect(output).toEqual(['Assertion passed']);
      });

      it('should fail assertion with turnstile operator', () => {
        const code = `
        let arr = [3, 1, 4, 1, 5]
        @assert(arr |- @sorted, "Array must be sorted")
        print("This should not print")
      `;
        expect(() => run(code)).toThrow('Array must be sorted');
      });

      it('should use turnstile in complex assertion', () => {
        const code = `
        let arr = [2, 4, 6, 8, 10]
        let all_even = true
        for x in arr {
          if !(x |- @even) {
            all_even = false
          }
        }
        @assert(all_even, "All elements must be even")
        print("All even!")
      `;
        const output = run(code);
        expect(output).toEqual(['All even!']);
      });
    });

    describe('Synthesized Invariants with Turnstile', () => {
      it('should verify synthesized invariant with turnstile', () => {
        const code = `
        let i = 0
        while i < 5 {
          i = i + 1
        }
        let in_range = i |- @positive
        print(in_range)
      `;
        const output = run(code);
        expect(output).toEqual(['true']);
      });
    });
  });
});
