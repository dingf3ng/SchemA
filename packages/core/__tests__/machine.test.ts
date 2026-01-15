/**
 * Tests for the Abstract Machine implementation.
 * These tests verify that the machine produces the same results as the interpreter.
 */

import { run, runMachine } from '../src/index';

/**
 * Helper function to run code with both interpreter and machine,
 * asserting they produce the same output.
 */
function runBoth(code: string): string[] {
  const interpreterOutput = run(code);
  const machineOutput = runMachine(code);
  expect(machineOutput).toEqual(interpreterOutput);
  return machineOutput;
}

/**
 * Helper function to verify both interpreter and machine throw the same error.
 */
function expectBothToThrow(code: string, errorPattern: RegExp): void {
  expect(() => run(code)).toThrow(errorPattern);
  expect(() => runMachine(code)).toThrow(errorPattern);
}

describe('Abstract Machine', () => {
  describe('Basic Expressions', () => {
    it('should evaluate integer literals', () => {
      const output = runBoth(`print(42)`);
      expect(output).toEqual(['42']);
    });

    it('should evaluate float literals', () => {
      const output = runBoth(`print(3.14)`);
      expect(output).toEqual(['3.14']);
    });

    it('should evaluate string literals', () => {
      const output = runBoth(`print("hello")`);
      expect(output).toEqual(['hello']);
    });

    it('should evaluate boolean literals', () => {
      const output = runBoth(`print(true)`);
      expect(output).toEqual(['true']);
    });

    it('should evaluate array literals', () => {
      const output = runBoth(`print([1, 2, 3])`);
      expect(output).toEqual(['[1, 2, 3]']);
    });
  });

  describe('Arithmetic Operations', () => {
    it('should add integers', () => {
      const output = runBoth(`print(1 + 2)`);
      expect(output).toEqual(['3']);
    });

    it('should subtract integers', () => {
      const output = runBoth(`print(5 - 3)`);
      expect(output).toEqual(['2']);
    });

    it('should multiply integers', () => {
      const output = runBoth(`print(4 * 3)`);
      expect(output).toEqual(['12']);
    });

    it('should divide integers (floor division)', () => {
      const output = runBoth(`print(7 / 2)`);
      expect(output).toEqual(['3']);
    });

    it('should perform float division', () => {
      const output = runBoth(`print(7 /. 2)`);
      expect(output).toEqual(['3.5']);
    });

    it('should compute modulo', () => {
      const output = runBoth(`print(7 % 3)`);
      expect(output).toEqual(['1']);
    });

    it('should handle complex arithmetic expressions', () => {
      const output = runBoth(`print(2 + 3 * 4)`);
      expect(output).toEqual(['14']);
    });

    it('should handle unary minus', () => {
      const output = runBoth(`print(-5)`);
      expect(output).toEqual(['-5']);
    });
  });

  describe('Comparison Operations', () => {
    it('should compare less than', () => {
      const output = runBoth(`print(1 < 2)`);
      expect(output).toEqual(['true']);
    });

    it('should compare greater than', () => {
      const output = runBoth(`print(3 > 2)`);
      expect(output).toEqual(['true']);
    });

    it('should compare equality', () => {
      const output = runBoth(`print(5 == 5)`);
      expect(output).toEqual(['true']);
    });

    it('should compare inequality', () => {
      const output = runBoth(`print(5 != 3)`);
      expect(output).toEqual(['true']);
    });
  });

  describe('Logical Operations', () => {
    it('should evaluate logical AND', () => {
      const output = runBoth(`print(true && true)`);
      expect(output).toEqual(['true']);
    });

    it('should short-circuit AND on false', () => {
      const output = runBoth(`print(false && true)`);
      expect(output).toEqual(['false']);
    });

    it('should evaluate logical OR', () => {
      const output = runBoth(`print(false || true)`);
      expect(output).toEqual(['true']);
    });

    it('should short-circuit OR on true', () => {
      const output = runBoth(`print(true || false)`);
      expect(output).toEqual(['true']);
    });

    it('should evaluate logical NOT', () => {
      const output = runBoth(`print(!false)`);
      expect(output).toEqual(['true']);
    });
  });

  describe('Variables', () => {
    it('should declare and read variables', () => {
      const output = runBoth(`
        let x = 10
        print(x)
      `);
      expect(output).toEqual(['10']);
    });

    it('should assign to variables', () => {
      const output = runBoth(`
        let x = 10
        x = 20
        print(x)
      `);
      expect(output).toEqual(['20']);
    });

    it('should support multiple declarations', () => {
      const output = runBoth(`
        let x = 1, y = 2, z = 3
        print(x + y + z)
      `);
      expect(output).toEqual(['6']);
    });
  });

  describe('Control Flow - If Statements', () => {
    it('should execute then branch when condition is true', () => {
      const output = runBoth(`
        if true {
          print("yes")
        }
      `);
      expect(output).toEqual(['yes']);
    });

    it('should skip then branch when condition is false', () => {
      const output = runBoth(`
        if false {
          print("no")
        }
        print("done")
      `);
      expect(output).toEqual(['done']);
    });

    it('should execute else branch when condition is false', () => {
      const output = runBoth(`
        if false {
          print("yes")
        } else {
          print("no")
        }
      `);
      expect(output).toEqual(['no']);
    });

    it('should handle else-if chains', () => {
      const output = runBoth(`
        let x = 2
        if x == 1 {
          print("one")
        } else if x == 2 {
          print("two")
        } else {
          print("other")
        }
      `);
      expect(output).toEqual(['two']);
    });
  });

  describe('Control Flow - While Loops', () => {
    it('should execute while loop', () => {
      const output = runBoth(`
        let i = 0
        while i < 3 {
          print(i)
          i = i + 1
        }
      `);
      expect(output).toEqual(['0', '1', '2']);
    });

    it('should skip while loop when condition is false', () => {
      const output = runBoth(`
        while false {
          print("never")
        }
        print("done")
      `);
      expect(output).toEqual(['done']);
    });
  });

  describe('Control Flow - Until Loops', () => {
    it('should execute until loop', () => {
      const output = runBoth(`
        let i = 0
        until i == 3 {
          print(i)
          i = i + 1
        }
      `);
      expect(output).toEqual(['0', '1', '2']);
    });
  });

  describe('Control Flow - For Loops', () => {
    it('should iterate over array', () => {
      const output = runBoth(`
        for x in [1, 2, 3] {
          print(x)
        }
      `);
      expect(output).toEqual(['1', '2', '3']);
    });

    it('should iterate over range', () => {
      const output = runBoth(`
        for i in 0..3 {
          print(i)
        }
      `);
      expect(output).toEqual(['0', '1', '2']);
    });

    it('should iterate over inclusive range', () => {
      const output = runBoth(`
        for i in 0...2 {
          print(i)
        }
      `);
      expect(output).toEqual(['0', '1', '2']);
    });
  });

  describe('Functions', () => {
    it('should define and call functions', () => {
      const output = runBoth(`
        do greet() {
          print("hello")
        }
        greet()
      `);
      expect(output).toEqual(['hello']);
    });

    it('should pass arguments to functions', () => {
      const output = runBoth(`
        do add(a: int, b: int) -> int {
          return a + b
        }
        print(add(2, 3))
      `);
      expect(output).toEqual(['5']);
    });

    it('should return values from functions', () => {
      const output = runBoth(`
        do square(x: int) -> int {
          return x * x
        }
        print(square(5))
      `);
      expect(output).toEqual(['25']);
    });

    it('should handle recursive functions', () => {
      const output = runBoth(`
        do factorial(n: int) -> int {
          if n <= 1 {
            return 1
          }
          return n * factorial(n - 1)
        }
        print(factorial(5))
      `);
      expect(output).toEqual(['120']);
    });
  });

  describe('Arrays', () => {
    it('should access array elements by index', () => {
      const output = runBoth(`
        let arr = [10, 20, 30]
        print(arr[1])
      `);
      expect(output).toEqual(['20']);
    });

    it('should update array elements', () => {
      const output = runBoth(`
        let arr = [1, 2, 3]
        arr[1] = 42
        print(arr[1])
      `);
      expect(output).toEqual(['42']);
    });

    it('should get array length', () => {
      const output = runBoth(`
        let arr = [1, 2, 3, 4, 5]
        print(arr.length())
      `);
      expect(output).toEqual(['5']);
    });

    it('should push to array', () => {
      const output = runBoth(`
        let arr: Array<int> = []
        arr.push(1)
        arr.push(2)
        print(arr)
      `);
      expect(output).toEqual(['[1, 2]']);
    });

    it('should pop from array', () => {
      const output = runBoth(`
        let arr = [1, 2, 3]
        let x = arr.pop()
        print(x)
        print(arr)
      `);
      expect(output).toEqual(['3', '[1, 2]']);
    });
  });

  describe('Maps', () => {
    it('should create and use maps', () => {
      const output = runBoth(`
        let m = Map()
        m.set(1, "one")
        m.set(2, "two")
        print(m.get(1))
        print(m.get(2))
      `);
      expect(output).toEqual(['one', 'two']);
    });

    it('should check map membership', () => {
      const output = runBoth(`
        let m = Map()
        m.set("key", 42)
        print(m.has("key"))
        print(m.has("other"))
      `);
      expect(output).toEqual(['true', 'false']);
    });

    it('should get map size', () => {
      const output = runBoth(`
        let m = Map()
        m.set(1, "a")
        m.set(2, "b")
        print(m.size())
      `);
      expect(output).toEqual(['2']);
    });
  });

  describe('Sets', () => {
    it('should create and use sets', () => {
      const output = runBoth(`
        let s = Set()
        s.add(1)
        s.add(2)
        s.add(1)
        print(s.size())
      `);
      expect(output).toEqual(['2']);
    });

    it('should check set membership', () => {
      const output = runBoth(`
        let s = Set()
        s.add(42)
        print(s.has(42))
        print(s.has(99))
      `);
      expect(output).toEqual(['true', 'false']);
    });
  });

  describe('Heaps', () => {
    it('should use MinHeap', () => {
      const output = runBoth(`
        let h = MinHeap()
        h.push(3)
        h.push(1)
        h.push(2)
        print(h.pop())
        print(h.pop())
      `);
      expect(output).toEqual(['1', '2']);
    });

    it('should use MaxHeap', () => {
      const output = runBoth(`
        let h = MaxHeap()
        h.push(1)
        h.push(3)
        h.push(2)
        print(h.pop())
        print(h.pop())
      `);
      expect(output).toEqual(['3', '2']);
    });
  });

  describe('Builtin Functions', () => {
    it('should use print function', () => {
      const output = runBoth(`print("hello", "world")`);
      expect(output).toEqual(['hello world']);
    });

    it('should use MinHeap constructor', () => {
      const output = runBoth(`
        let h = MinHeap()
        print(h.size())
      `);
      expect(output).toEqual(['0']);
    });

    it('should use Map constructor', () => {
      const output = runBoth(`
        let m = Map()
        print(m.size())
      `);
      expect(output).toEqual(['0']);
    });
  });

  describe('Complex Programs', () => {
    it('should compute fibonacci', () => {
      const output = runBoth(`
        do fib(n: int) -> int {
          if n <= 1 {
            return n
          }
          return fib(n - 1) + fib(n - 2)
        }
        print(fib(10))
      `);
      expect(output).toEqual(['55']);
    });

    it('should compute sum of array', () => {
      const output = runBoth(`
        do sum(arr: Array<int>) -> int {
          let total = 0
          for x in arr {
            total = total + x
          }
          return total
        }
        print(sum([1, 2, 3, 4, 5]))
      `);
      expect(output).toEqual(['15']);
    });

    it('should run map iteration', () => {
      const output = runBoth(`
        let m = Map()
        m.set("a", 1)
        m.set("b", 2)
        for key in m {
          let value = m.get(key)
          print(value)
        }
      `);
      expect(output).toEqual(['1', '2']);
    });

    it('should find maximum in array', () => {
      const output = runBoth(`
        do findMax(arr: Array<int>) -> int {
          let maxVal = arr[0]
          for x in arr {
            if x > maxVal {
              maxVal = x
            }
          }
          return maxVal
        }
        print(findMax([3, 1, 4, 1, 5, 9, 2, 6]))
      `);
      expect(output).toEqual(['9']);
    });

    it('should implement bubble sort', () => {
      const output = runBoth(`
        do bubbleSort(arr: Array<int>) -> Array<int> {
          let n = arr.length()
          let i = 0
          while i < n {
            let j = 0
            while j < n - i - 1 {
              if arr[j] > arr[j + 1] {
                let temp = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
              }
              j = j + 1
            }
            i = i + 1
          }
          return arr
        }
        print(bubbleSort([64, 34, 25, 12, 22, 11, 90]))
      `);
      expect(output).toEqual(['[11, 12, 22, 25, 34, 64, 90]']);
    });

    it('should handle nested function calls', () => {
      const output = runBoth(`
        do double(x: int) -> int {
          return x * 2
        }
        do triple(x: int) -> int {
          return x * 3
        }
        print(double(triple(5)))
      `);
      expect(output).toEqual(['30']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty program', () => {
      const output = runBoth(``);
      expect(output).toEqual([]);
    });

    it('should handle deeply nested expressions', () => {
      const output = runBoth(`print(((((1 + 2) + 3) + 4) + 5))`);
      expect(output).toEqual(['15']);
    });

    it('should handle deeply nested blocks', () => {
      const output = runBoth(`
        let x = 1
        {
          let y = 2
          {
            let z = 3
            print(x + y + z)
          }
        }
      `);
      expect(output).toEqual(['6']);
    });

    it('should handle multiple print statements', () => {
      const output = runBoth(`
        print("a")
        print("b")
        print("c")
      `);
      expect(output).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Invariant and Assert Checking', () => {
    it('should pass when assert condition is true', () => {
      const output = runBoth(`
        let x = 10
        @assert(x > 0)
        print("passed")
      `);
      expect(output).toEqual(['passed']);
    });

    it('should fail when assert condition is false', () => {
      const code = `
        let x = -5
        @assert(x > 0)
      `;
      expectBothToThrow(code, /Assertion failed/);
    });

    it('should support custom assert error messages', () => {
      const code = `
        let x = -5
        @assert(x > 0, "x must be positive")
      `;
      expectBothToThrow(code, /x must be positive/);
    });

    it('should pass when invariant holds in function', () => {
      const output = runBoth(`
        do test() {
          let x = 5
          @invariant(x > 0)
          print("passed")
        }
        test()
      `);
      expect(output).toEqual(['passed']);
    });

    it('should fail when invariant is violated in function', () => {
      const code = `
        do test() {
          let x = -5
          @invariant(x > 0)
        }
        test()
      `;
      expectBothToThrow(code, /Invariant violated/);
    });

    it('should support custom invariant error messages', () => {
      const code = `
        do test() {
          let x = -5
          @invariant(x > 0, "x must be positive")
        }
        test()
      `;
      expectBothToThrow(code, /x must be positive/);
    });

    it('should check invariant in while loop', () => {
      const output = runBoth(`
        let i = 0
        while i < 5 {
          @invariant(i >= 0)
          @invariant(i < 10)
          i = i + 1
        }
        print("passed")
      `);
      expect(output).toEqual(['passed']);
    });

    it('should check invariant in for loop', () => {
      const output = runBoth(`
        let sum = 0
        for i in 0..5 {
          @invariant(sum >= 0)
          sum = sum + i
        }
        print(sum)
      `);
      expect(output).toEqual(['10']);
    });

    it('should verify binary search invariants', () => {
      const output = runBoth(`
        do binarySearch(arr, target) {
          let left = 0
          let right = arr.length() - 1

          until left > right {
            @invariant(left >= 0)
            @invariant(right < arr.length())
            @invariant(left <= right + 1, "Search bounds invalid")

            let mid = (left + right) / 2

            if arr[mid] == target {
              return mid
            } else {
              if arr[mid] < target {
                left = mid + 1
              } else {
                right = mid - 1
              }
            }
          }
          return -1
        }

        let arr = [1, 3, 5, 7, 9]
        print(binarySearch(arr, 5))
        print(binarySearch(arr, 4))
      `);
      expect(output).toEqual(['2', '-1']);
    });
  });

  describe('Predicate Checking', () => {
    it('should check positive predicate', () => {
      const output = runBoth(`
        let x = 5
        let is_positive = x |- @positive
        print(is_positive)
      `);
      expect(output).toEqual(['true']);
    });

    it('should check sorted predicate on array', () => {
      const output = runBoth(`
        let arr = [1, 2, 3, 4, 5]
        let is_sorted = arr |- @sorted("asc")
        print(is_sorted)
      `);
      expect(output).toEqual(['true']);
    });

    it('should check non_empty predicate', () => {
      const output = runBoth(`
        let arr = [1, 2, 3]
        let is_non_empty = arr |- @non_empty
        print(is_non_empty)
      `);
      expect(output).toEqual(['true']);
    });

    it('should return false when predicate fails', () => {
      const output = runBoth(`
        let x = -5
        let is_strict_positive = x |- @positive(true)
        print(is_strict_positive)
      `);
      expect(output).toEqual(['false']);
    });
  });
});
