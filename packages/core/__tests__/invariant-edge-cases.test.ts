/**
 * Edge Case Tests for Invariant and Assertion Checking
 *
 * These tests cover hard edge cases discovered during the refactoring of
 * the Evaluator class, particularly around:
 * - Synchronous evaluation of user-defined functions
 * - Invariant checking in nested loops
 * - Early returns and their interaction with invariants
 * - Position-independence of invariants
 * - Complex control flow scenarios
 */

import { run, runMachine } from '../src/index';

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

describe('Invariant Edge Cases', () => {
  describe('User-Defined Functions in Invariants', () => {
    it('should evaluate user-defined helper functions synchronously in invariants', () => {
      const code = `
        do isPositive(x) {
          return x > 0
        }

        do test() {
          let x = 5
          @invariant(isPositive(x), "x must be positive")
          print("passed")
        }
        test()
      `;
      expect(expectBothToEqual(code)).toEqual(['passed']);
    });

    it('should detect invariant violation when user-defined function returns false', () => {
      const code = `
        do isInRange(val, min, max) {
          return val >= min && val <= max
        }

        do test() {
          let x = 100
          @invariant(isInRange(x, 0, 50), "x out of range")
        }
        test()
      `;
      expectBothToThrow(code, /x out of range/);
    });

    it('should handle recursive helper functions in invariants', () => {
      const code = `
        do factorial(n) {
          if n <= 1 {
            return 1
          }
          return n * factorial(n - 1)
        }

        do test() {
          let x = 5
          @invariant(factorial(x) == 120, "factorial check failed")
          print("passed")
        }
        test()
      `;
      expect(expectBothToEqual(code)).toEqual(['passed']);
    });

    it('should handle helper functions with loops in invariants', () => {
      const code = `
        do sum(arr) {
          let total = 0
          for x in arr {
            total = total + x
          }
          return total
        }

        do test() {
          let numbers = [1, 2, 3, 4, 5]
          @invariant(sum(numbers) == 15, "sum check failed")
          print("passed")
        }
        test()
      `;
      expect(expectBothToEqual(code)).toEqual(['passed']);
    });

    it('should fail when helper function with loop detects violation', () => {
      const code = `
        do allPositive(arr) {
          for x in arr {
            if x <= 0 {
              return false
            }
          }
          return true
        }

        do test() {
          let numbers = [1, 2, -3, 4]
          @invariant(allPositive(numbers), "all values must be positive")
        }
        test()
      `;
      expectBothToThrow(code, /all values must be positive/);
    });
  });

  describe('Nested Loops with Invariants', () => {
    it('should check invariants in nested for loops', () => {
      const code = `
        let outerCount = 0
        let innerCount = 0

        for i in 0..3 {
          @invariant(outerCount <= 3, "outer count exceeded")
          outerCount = outerCount + 1

          for j in 0..2 {
            @invariant(innerCount <= 10, "inner count exceeded")
            innerCount = innerCount + 1
          }
        }
        print(outerCount)
        print(innerCount)
      `;
      expect(expectBothToEqual(code)).toEqual(['3', '6']);
    });

    it('should detect invariant violation in inner loop', () => {
      const code = `
        for i in 0..3 {
          let innerSum = 0
          for j in 0..5 {
            @invariant(innerSum <= 3, "inner sum too large")
            innerSum = innerSum + 1
          }
        }
      `;
      expectBothToThrow(code, /inner sum too large/);
    });

    it('should check invariants in nested while loops', () => {
      const code = `
        let i = 0
        let total = 0

        while i < 3 {
          @invariant(total <= 15, "total exceeded")
          let j = 0
          while j < 2 {
            @invariant(j < 10, "inner counter exceeded")
            total = total + 1
            j = j + 1
          }
          i = i + 1
        }
        print(total)
      `;
      expect(expectBothToEqual(code)).toEqual(['6']);
    });

    it('should handle mixed loop types with invariants', () => {
      const code = `
        let count = 0

        for i in 0..3 {
          @invariant(count <= 20, "count limit")
          let j = 0
          until j == 2 {
            @invariant(j >= 0, "j must be non-negative")
            count = count + 1
            j = j + 1
          }
        }
        print(count)
      `;
      expect(expectBothToEqual(code)).toEqual(['6']);
    });
  });

  describe('Early Return Scenarios', () => {
    it('should check invariants before early return in for loop', () => {
      const code = `
        do findAndCheck(arr, target) {
          let checked = 0
          for x in arr {
            @invariant(checked <= 5, "checked too many")
            checked = checked + 1
            if x == target {
              return checked
            }
          }
          return -1
        }

        print(findAndCheck([1, 2, 3, 4, 5], 3))
      `;
      expect(expectBothToEqual(code)).toEqual(['3']);
    });

    it('should fail invariant on early return when violation occurs', () => {
      const code = `
        do process(arr) {
          let sum = 0
          for x in arr {
            @invariant(sum <= 40, "sum exceeded before return")
            sum = sum + x
            if sum > 40 {
              return sum
            }
          }
          return sum
        }

        process([20, 25, 30])
      `;
      expectBothToThrow(code, /sum exceeded before return/);
    });

    it('should check invariants before early return in while loop', () => {
      const code = `
        do countdown(start) {
          let i = start
          while i > 0 {
            @invariant(i <= start, "i exceeded start")
            if i == 5 {
              return i
            }
            i = i - 1
          }
          return 0
        }

        print(countdown(10))
      `;
      expect(expectBothToEqual(code)).toEqual(['5']);
    });

    it('should check invariants before early return in until loop', () => {
      const code = `
        do search(limit) {
          let i = 0
          until i > limit {
            @invariant(i >= 0, "i went negative")
            if i == 7 {
              return i
            }
            i = i + 1
          }
          return -1
        }

        print(search(10))
      `;
      expect(expectBothToEqual(code)).toEqual(['7']);
    });

    it('should handle multiple invariants with early return', () => {
      const code = `
        do complexCheck(arr) {
          let sum = 0
          let count = 0

          for x in arr {
            @invariant(sum <= 100, "sum limit")
            @invariant(count <= 10, "count limit")

            sum = sum + x
            count = count + 1

            if count == 3 {
              return sum
            }
          }
          return sum
        }

        print(complexCheck([10, 20, 30, 40]))
      `;
      expect(expectBothToEqual(code)).toEqual(['60']);
    });
  });

  describe('Invariants in Nested Function Calls', () => {
    it('should check invariants in function called from another function', () => {
      const code = `
        do innerFunc(x) {
          @invariant(x > 0, "inner: x must be positive")
          return x * 2
        }

        do outerFunc(y) {
          @invariant(y < 100, "outer: y must be less than 100")
          return innerFunc(y)
        }

        print(outerFunc(10))
      `;
      expect(expectBothToEqual(code)).toEqual(['20']);
    });

    it('should detect invariant violation in deeply nested call', () => {
      const code = `
        do level3(x) {
          @invariant(x > 0, "level3 failed")
          return x
        }

        do level2(x) {
          @invariant(x > 0, "level2 failed")
          return level3(x - 1)
        }

        do level1(x) {
          @invariant(x > 0, "level1 failed")
          return level2(x - 1)
        }

        level1(2)
      `;
      expectBothToThrow(code, /level3 failed/);
    });

    it('should handle invariants in mutually recursive functions', () => {
      const code = `
        do isEven(n) {
          @invariant(n >= 0, "n must be non-negative")
          if n == 0 {
            return true
          }
          return isOdd(n - 1)
        }

        do isOdd(n) {
          @invariant(n >= 0, "n must be non-negative")
          if n == 0 {
            return false
          }
          return isEven(n - 1)
        }

        if isEven(4) {
          print("4 is even")
        }
      `;
      expect(expectBothToEqual(code)).toEqual(['4 is even']);
    });
  });

  describe('Invariants with Data Structures', () => {
    it('should check invariants involving array operations', () => {
      const code = `
        do process(arr) {
          for i in 0..arr.length() {
            @invariant(arr.length() > 0, "array must not be empty")
            let val = arr[i]
          }
          print("done")
        }

        process([1, 2, 3])
      `;
      expect(expectBothToEqual(code)).toEqual(['done']);
    });

    it('should check invariants involving map operations', () => {
      const code = `
        let counts: Map<string, int> = Map()

        for word in ["a", "b", "a", "c"] {
          @invariant(counts.size() <= 10, "too many unique words")

          if counts.has(word) {
            let current = counts.get(word)
            counts.set(word, current + 1)
          } else {
            counts.set(word, 1)
          }
        }
        print(counts.size())
      `;
      expect(expectBothToEqual(code)).toEqual(['3']);
    });

    it('should detect invariant violation with heap', () => {
      const code = `
        let heap: MinHeap<int> = MinHeap()

        for i in [5, 3, 8, 1, 9] {
          @invariant(heap.size() <= 3, "heap too large")
          heap.push(i)
        }
      `;
      expectBothToThrow(code, /heap too large/);
    });
  });

  describe('Assert Statement Edge Cases', () => {
    it('should pass assert in user-defined function', () => {
      const code = `
        do validate(x) {
          @assert(x > 0, "x must be positive")
          @assert(x < 100, "x must be less than 100")
          return x * 2
        }

        print(validate(50))
      `;
      expect(expectBothToEqual(code)).toEqual(['100']);
    });

    it('should fail assert with current state in error', () => {
      const code = `
        do test() {
          let x = 10
          let y = 20
          @assert(x > y, "x should be greater than y")
        }
        test()
      `;
      try {
        run(code);
        fail('Should have thrown');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('x should be greater than y');
        expect(error.message).toContain('Current state:');
        expect(error.message).toContain('x = 10');
        expect(error.message).toContain('y = 20');
      }
    });

    it('should check assert with complex expression', () => {
      const code = `
        do checkRange(arr, min, max) {
          for x in arr {
            @assert(x >= min && x <= max, "value out of range")
          }
          print("all in range")
        }

        checkRange([5, 10, 15], 0, 20)
      `;
      expect(expectBothToEqual(code)).toEqual(['all in range']);
    });
  });

  describe('Invariant State Capture', () => {
    it('should capture array state in invariant error', () => {
      const code = `
        do test() {
          let arr = [1, 2, 3]
          let x = -1
          @invariant(x > 0, "x must be positive")
        }
        test()
      `;
      try {
        run(code);
        fail('Should have thrown');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('Current state:');
        expect(error.message).toContain('arr = [1, 2, 3]');
        expect(error.message).toContain('x = -1');
      }
    });

    it('should capture state mid-loop in invariant error', () => {
      const code = `
        do test() {
          let sum = 0
          for i in 0..5 {
            sum = sum + i
            @invariant(sum <= 5, "sum exceeded")
          }
        }
        test()
      `;
      try {
        run(code);
        fail('Should have thrown');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('sum exceeded');
        expect(error.message).toContain('Current state:');
        // After i=0,1,2,3: sum = 0+1+2+3 = 6, which exceeds 5
        expect(error.message).toMatch(/sum = [0-9]+/);
      }
    });
  });

  describe('Complex Control Flow with Invariants', () => {
    it('should handle invariants with if-else branches', () => {
      const code = `
        do process(x) {
          let result = 0
          for i in 0..x {
            @invariant(result >= 0, "result went negative")

            if i % 2 == 0 {
              result = result + i
            } else {
              result = result - 1
            }
          }
          return result
        }

        print(process(6))
      `;
      // i=0: result = 0 + 0 = 0
      // i=1: result = 0 - 1 = -1 -- but invariant is checked BEFORE body
      // Actually:
      // Before i=0: result=0 (pass), after: result=0
      // Before i=1: result=0 (pass), after: result=-1
      // Before i=2: result=-1 (FAIL!)
      expectBothToThrow(code, /result went negative/);
    });

    it('should handle invariants with nested conditionals', () => {
      const code = `
        do classify(arr) {
          let positive = 0
          let negative = 0

          for x in arr {
            @invariant(positive + negative <= 10, "too many items")

            if x > 0 {
              positive = positive + 1
            } else {
              if x < 0 {
                negative = negative + 1
              }
            }
          }
          print(positive)
          print(negative)
        }

        classify([1, -2, 3, -4, 0, 5])
      `;
      expect(expectBothToEqual(code)).toEqual(['3', '2']);
    });

    it('should handle break-like early exit with invariant', () => {
      const code = `
        do findFirst(arr, pred) {
          for x in arr {
            @invariant(true, "always passes")
            if pred == x {
              return x
            }
          }
          return -1
        }

        print(findFirst([1, 2, 3, 4, 5], 3))
      `;
      expect(expectBothToEqual(code)).toEqual(['3']);
    });
  });

  describe('Edge Cases with Empty and Single-Element Collections', () => {
    it('should handle invariant in loop with empty array', () => {
      const code = `
        let count = 0
        for x in [] {
          @invariant(count < 10, "count limit")
          count = count + 1
        }
        print(count)
      `;
      expect(expectBothToEqual(code)).toEqual(['0']);
    });

    it('should check twice in single-iteration loop (once before and once after body)', () => {
      const code = `
        let checked = false
        for x in [42] {
          @invariant(!checked, "should be checked twice")
          checked = true
          print(x)
        }
      `;
      expectBothToThrow(code, /should be checked twice/);
    });

    it('should handle while loop that never executes body', () => {
      const code = `
        let i = 10
        while i < 5 {
          @invariant(false, "should never reach here")
          i = i + 1
        }
        print("done")
      `;
      expect(expectBothToEqual(code)).toEqual(['done']);
    });
  });

  describe('Invariants with Predicate Expressions', () => {
    it('should check invariant using predicate syntax', () => {
      const code = `
        let x = 5
        for i in 0..3 {
          @invariant(x |- @positive)
          x = x + 1
        }
        print(x)
      `;
      expect(expectBothToEqual(code)).toEqual(['8']);
    });

    it('should fail invariant with predicate violation', () => {
      const code = `
        do test() {
          let x = 5
          for i in 0..10 {
            @invariant(x |- @int_range(0, 10))
            x = x + 1
          }
        }
        test()
      `;
      expectBothToThrow(code, /Invariant violated/);
    });
  });
});
