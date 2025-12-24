import { run } from '../src/index';

describe('@invariant Functionality', () => {
  describe('Basic Invariant Checking', () => {
    it('should pass when invariant holds in function', () => {
      const code = `
        do test() {
          let x = 5
          @invariant(x > 0)
          print("passed")
        }
        test()
      `;
      const output = run(code);
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
      expect(() => run(code)).toThrow(/Invariant violated/);
    });

    it('should support custom error messages', () => {
      const code = `
        do test() {
          let x = -5
          @invariant(x > 0, "x must be positive")
        }
        test()
      `;
      expect(() => run(code)).toThrow(/x must be positive/);
    });

    it('should show current state in error message', () => {
      const code = `
        do test() {
          let x = -5
          let y = 10
          @invariant(x > 0)
        }
        test()
      `;
      try {
        run(code);
        fail('Should have thrown an error');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('Current state:');
        expect(error.message).toContain('x = -5');
        expect(error.message).toContain('y = 10');
      }
    });

    it('should reject invariant at top level', () => {
      const code = `
        let x = 5
        @invariant(x > 0)
      `;
      expect(() => run(code)).toThrow(/@invariant statement must be inside a loop or function/);
    });
  });

  describe('Loop Invariants', () => {
    it('should check invariant in until loop', () => {
      const code = `
        let i = 0
        until i == 5 {
          @invariant(i < 10)
          i = i + 1
        }
        print("passed")
      `;
      const output = run(code);
      expect(output).toEqual(['passed']);
    });

    it('should detect invariant violation in until loop', () => {
      const code = `
        let i = 0
        until i == 15 {
          @invariant(i < 10, "i exceeded limit")
          i = i + 1
        }
      `;
      expect(() => run(code)).toThrow(/i exceeded limit/);
      expect(() => run(code)).toThrow(/iteration 9/);
    });

    it('should check invariant in while loop', () => {
      const code = `
        let i = 0
        while i < 5 {
          @invariant(i >= 0)
          @invariant(i < 10)
          i = i + 1
        }
        print("passed")
      `;
      const output = run(code);
      expect(output).toEqual(['passed']);
    });

    it('should check invariant in for loop', () => {
      const code = `
        let sum = 0
        for i in 0..5 {
          @invariant(sum >= 0)
          sum = sum + i
        }
        print(sum)
      `;
      const output = run(code);
      expect(output).toEqual(['10']);
    });

    it('should check loop invariant at start and end of iteration', () => {
      const code = `
        let arr = [1, 2, 3]
        let i = 0
        for x in arr {
          @invariant(i < 10)
          i = i + 1
        }
        print("passed")
      `;
      const output = run(code);
      expect(output).toEqual(['passed']);
    });
  });

  describe('Function-Level vs Loop-Level Invariants', () => {
    it('should maintain function-level invariants throughout function', () => {
      const code = `
        do test() {
          let x = 5
          @invariant(x > 0)

          let i = 0
          while i < 3 {
            i = i + 1
          }

          return x
        }
        print(test())
      `;
      const output = run(code);
      expect(output).toEqual(['5']);
    });

    it('should clean up loop invariants after loop exits', () => {
      const code = `
        let x = 5
        let i = 0
        while i < 3 {
          @invariant(i < 10)
          i = i + 1
        }

        // This should work - loop invariant is cleaned up
        let j = 15
        print(j)
      `;
      const output = run(code);
      expect(output).toEqual(['15']);
    });
  });

  describe('Complex Invariants', () => {
    it('should handle invariants with multiple conditions', () => {
      const code = `
        do test() {
          let x = 5
          let y = 10
          @invariant(x > 0 && y > x)
          print("passed")
        }
        test()
      `;
      const output = run(code);
      expect(output).toEqual(['passed']);
    });

    it('should handle invariants with data structure properties', () => {
      const code = `
        do test() {
          let arr = [1, 2, 3]
          @invariant(arr.length() > 0)
          @invariant(arr.length() < 10)
          print("passed")
        }
        test()
      `;
      const output = run(code);
      expect(output).toEqual(['passed']);
    });

    it('should track monotonic increase in loop', () => {
      const code = `
        let visited = Set()
        for i in 0..5 {
          @invariant(visited.size() <= 5)
          visited.add(i)
        }
        print(visited.size())
      `;
      const output = run(code);
      expect(output).toEqual(['5']);
    });

    it('should detect when collection exceeds expected size', () => {
      const code = `
        let visited = Set()
        for i in 0..10 {
          @invariant(visited.size() < 5, "visited set too large")
          visited.add(i)
        }
      `;
      expect(() => run(code)).toThrow(/visited set too large/);
    });
  });

  describe('Binary Search Example', () => {
    it('should verify binary search invariants', () => {
      const code = `
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
      `;
      const output = run(code);
      expect(output).toEqual(['2', '-1']);
    });
  });

  describe('Graph Traversal Example', () => {
    it('should verify invariants in graph traversal', () => {
      const code = `
        do bfs(graph, start) {
          let visited = Set()
          let queue = [start]

          until queue.length() == 0 {
            @invariant(visited.size() <= graph.size())
            @invariant(queue.length() >= 0)

            let current = queue.pop()

            if !visited.has(current) {
              visited.add(current)
            }
          }

          return visited.size()
        }

        let g = Graph(true)
        g.addVertex(0)
        g.addVertex(1)
        g.addVertex(2)
        g.addEdge(0, 1, 1)
        g.addEdge(1, 2, 1)

        print(bfs(g, 0))
      `;
      const output = run(code);
      expect(output).toEqual(['1']);
    });
  });

  describe('Type Checking for Invariants', () => {
    it('should reject non-boolean invariant conditions', () => {
      const code = `
        do test() {
          let x = 5
          @invariant(x)
        }
        test()
      `;
      expect(() => run(code)).toThrow(/Type mismatch.*expected boolean/);
    });

    it('should reject non-string invariant messages', () => {
      const code = `
        do test() {
          let x = 5
          @invariant(x > 0, 123)
        }
        test()
      `;
      expect(() => run(code)).toThrow(/Type mismatch.*expected string/);
    });
  });

  describe('Invariants with Early Loop Exits (return statements)', () => {
    it('should check invariant before early return in while loop', () => {
      const code = `
        do findFirst(arr, target) {
          let i = 0
          while i < arr.length() {
            @invariant(i >= 0)
            @invariant(i < arr.length())

            if arr[i] == target {
              return i
            }
            i = i + 1
          }
          return -1
        }

        let result = findFirst([10, 20, 30, 40], 30)
        print(result)
      `;
      const output = run(code);
      expect(output).toEqual(['2']);
    });

    it('should detect invariant violation before early return', () => {
      const code = `
        do search(arr, target) {
          let i = 0
          while i < arr.length() {
            @invariant(i < 3, "index should not exceed 3")

            if arr[i] == target {
              return i
            }
            i = i + 1
          }
          return -1
        }

        search([1, 2, 3, 4, 5], 5)
      `;
      expect(() => run(code)).toThrow(/index should not exceed 3/);
    });

    it('should check invariant in for loop with early return', () => {
      const code = `
        do findNegative(numbers) {
          let checked = 0
          for num in numbers {
            @invariant(checked >= 0)
            @invariant(checked <= 10)

            checked = checked + 1
            if num < 0 {
              return checked
            }
          }
          return -1
        }

        let pos = findNegative([5, 3, -2, 1])
        print(pos)
      `;
      const output = run(code);
      expect(output).toEqual(['3']);
    });

    it('should verify invariants hold when early return occurs at first iteration', () => {
      const code = `
        do firstMatch(arr) {
          for item in arr {
            @invariant(item >= 0, "all items should be non-negative")

            if item > 100 {
              return item
            }
          }
          return 0
        }

        let result = firstMatch([150, 50, 200])
        print(result)
      `;
      const output = run(code);
      expect(output).toEqual(['150']);
    });

    it('should fail when invariant violated before early return at first iteration', () => {
      const code = `
        do firstCheck(arr) {
          for item in arr {
            @invariant(item > 0, "all items must be positive")

            if item > 100 {
              return item
            }
          }
          return 0
        }

        firstCheck([0, 50, 200])
      `;
      expect(() => run(code)).toThrow(/all items must be positive/);
    });

    it('should check invariants in nested loops with early returns', () => {
      const code = `
        do findPair(matrix, target) {
          let row = 0
          while row < matrix.length() {
            @invariant(row >= 0)
            @invariant(row <= matrix.length())

            let col = 0
            let currentRow = matrix[row]
            while col < currentRow.length() {
              @invariant(col >= 0)
              @invariant(col <= currentRow.length())

              if currentRow[col] == target {
                return row
              }
              col = col + 1
            }
            row = row + 1
          }
          return -1
        }

        let mat = [[1, 2], [3, 4], [5, 6]]
        let result = findPair(mat, 4)
        print(result)
      `;
      const output = run(code);
      expect(output).toEqual(['1']);
    });

    it('should detect invariant violation in inner loop before early return', () => {
      const code = `
        do search2D(matrix, maxOps) {
          let ops = 0
          for row in matrix {
            for item in row {
              @invariant(ops < maxOps, "exceeded max operations")
              ops = ops + 1

              if item == 99 {
                return ops
              }
            }
          }
          return ops
        }

        let mat = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
        search2D(mat, 5)
      `;
      expect(() => run(code)).toThrow(/exceeded max operations/);
    });

    it('should maintain invariant with multiple early returns in different branches', () => {
      const code = `
        do categorize(num) {
          let i = 0
          while i < 100 {
            @invariant(i >= 0)
            @invariant(i <= 100)

            if i == num && num < 10 {
              return "small"
            }
            if i == num && num >= 10 && num < 50 {
              return "medium"
            }
            if i == num && num >= 50 {
              return "large"
            }
            i = i + 1
          }
          return "unknown"
        }

        print(categorize(5))
        print(categorize(25))
        print(categorize(75))
      `;
      const output = run(code);
      expect(output).toEqual(['small', 'medium', 'large']);
    });

    it('should check invariants on early return from until loop', () => {
      const code = `
        do findThreshold(start, threshold) {
          let current = start
          until current > 1000 {
            @invariant(current >= 0)
            @invariant(current <= 1000)

            if current >= threshold {
              return current
            }
            current = current + 10
          }
          return -1
        }

        let val = findThreshold(0, 75)
        print(val)
      `;
      const output = run(code);
      expect(output).toEqual(['80']);
    });

    it('should fail when invariant violated just before successful early return', () => {
      const code = `
        do dangerousSearch(limit) {
          let count = 0
          while count < 100 {
            @invariant(count < limit, "count exceeded safe limit")

            count = count + 1

            if count == 50 {
              return count
            }
          }
          return -1
        }

        dangerousSearch(45)
      `;
      expect(() => run(code)).toThrow(/count exceeded safe limit/);
    });

    it('should verify complex state invariants before early return', () => {
      const code = `
        do processUntilValid(arr) {
          let sum = 0
          let count = 0

          for num in arr {
            @invariant(count <= arr.length())
            @invariant(sum >= 0, "sum should remain non-negative")
            @invariant(count == 0 || sum >= count, "average should be at least 1")

            sum = sum + num
            count = count + 1

            if sum > 100 {
              return count
            }
          }
          return count
        }

        let result = processUntilValid([10, 20, 30, 50])
        print(result)
      `;
      const output = run(code);
      expect(output).toEqual(['4']);
    });

    it('should catch invariant violation in complex state before early return', () => {
      const code = `
        do invalidProcess(arr) {
          let sum = 0
          let count = 0

          for num in arr {
            @invariant(sum <= 100, "sum exceeded maximum")

            sum = sum + num
            count = count + 1
            if count == 3 {
              return sum
            }
          }
          return sum
        }

        invalidProcess([40, 50, 30])
      `;
      expect(() => run(code)).toThrow(/sum exceeded maximum/);
    });
  });

  describe('Position-Independence of @invariant', () => {
    it('should work the same when @invariant is at the start of loop body', () => {
      const code = `
        do test() {
          let sum = 0
          for num in [40, 50, 30] {
            @invariant(sum <= 100, "sum exceeded at start")

            sum = sum + num
            if sum > 100 {
              return sum
            }
          }
          return sum
        }

        test()
      `;
      expect(() => run(code)).toThrow(/sum exceeded at start/);
    });

    it('should work the same when @invariant is in the middle of loop body', () => {
      const code = `
        do test() {
          let sum = 0
          for num in [40, 50, 30] {
            sum = sum + num
            @invariant(sum <= 100, "sum exceeded in middle")

            if sum > 100 {
              return sum
            }
          }
          return sum
        }

        test()
      `;
      expect(() => run(code)).toThrow(/sum exceeded in middle/);
    });

    it('should work the same when @invariant is at the end of loop body', () => {
      const code = `
        do test() {
          let sum = 0
          for num in [40, 50, 30] {
            sum = sum + num
            if sum > 100 {
              return sum
            }
            @invariant(sum <= 100, "sum exceeded at end")
          }
          return sum
        }

        test()
      `;
      expect(() => run(code)).toThrow(/sum exceeded at end/);
    });

    it('should work the same when @invariant is before the modifying statement', () => {
      const code = `
        do test() {
          let i = 0
          while i < 10 {
            @invariant(i < 5, "i exceeded before modification")
            i = i + 1
          }
          return i
        }

        test()
      `;
      expect(() => run(code)).toThrow(/i exceeded before modification/);
    });

    it('should work the same when @invariant is after the modifying statement', () => {
      const code = `
        do test() {
          let i = 0
          while i < 10 {
            i = i + 1
            @invariant(i < 5, "i exceeded after modification")
          }
          return i
        }

        test()
      `;
      expect(() => run(code)).toThrow(/i exceeded after modification/);
    });

    it('should check invariant at iteration start regardless of position', () => {
      const code = `
        do test() {
          let arr = [1, 2, 3, 4, 5]
          let i = 0

          for num in arr {
            i = i + 1
            @invariant(i <= 3, "exceeded at iteration start check")
          }
          return i
        }

        test()
      `;
      // Should fail at iteration 4 start (i=3), before i=i+1 executes
      expect(() => run(code)).toThrow(/exceeded at iteration start check/);
    });

    it('should check invariant at iteration end regardless of position', () => {
      const code = `
        do test() {
          let arr = [1, 2, 3, 4, 5]
          let i = 0

          for num in arr {
            @invariant(i <= 3, "exceeded at iteration end check")
            i = i + 1
          }
          return i
        }

        test()
      `;
      // Should fail at iteration 3 end (after i becomes 4)
      expect(() => run(code)).toThrow(/exceeded at iteration end check/);
    });

    it('should check multiple invariants at same checkpoints regardless of position', () => {
      const code = `
        do test() {
          let x = 0
          let y = 0

          while x < 10 {
            x = x + 1
            @invariant(x <= 5, "x limit")

            y = y + 2
            @invariant(y <= 8, "y limit")
          }
          return x
        }

        test()
      `;
      // Both invariants checked at start and end of each iteration
      // y limit will fail first at iteration 5 end (y=10)
      expect(() => run(code)).toThrow(/y limit/);
    });

    it('should check invariant before early return regardless of invariant position before return', () => {
      const code = `
        do search(target) {
          let found = false
          for i in 0...10 {
            @invariant(i < 7, "searched too far")

            if i == target {
              found = true
              return i  // Early return
            }
          }
          return -1
        }

        search(8)
      `;
      // Should fail when i=7, before early return at i=8
      expect(() => run(code)).toThrow(/searched too far/);
    });

    it('should check invariant before early return regardless of invariant position after return', () => {
      const code = `
        do search(target) {
          let found = false
          for i in 0...10 {
            if i == target {
              found = true
              return i  // Early return
            }

            @invariant(i < 7, "searched too far")
          }
          return -1
        }

        search(8)
      `;
      // Should still fail when i=7, even though @invariant is after return
      expect(() => run(code)).toThrow(/searched too far/);
    });

    it('should verify all three check points work with position-independent invariants', () => {
      const code = `
        do test() {
          let iterations = []
          let x = 0

          for i in 0..3 {
            @invariant(x >= 0, "x must be non-negative")
            @invariant(x <= 2, "x must not exceed 2")

            x = x + 1
          }
          return x
        }

        test()
      `;
      // Iteration 0: start (x=0✓), end (x=1✓)
      // Iteration 1: start (x=1✓), end (x=2✓)
      // Iteration 2: start (x=2✓), end (x=3✗) <- fails here
      expect(() => run(code)).toThrow(/x must not exceed 2/);
    });

    it('should demonstrate position-independence with concrete example', () => {
      // Test that invariant at different positions catches same violations
      const testCases = [
        {
          name: 'invariant before modification',
          code: `
            do test() {
              let count = 0
              for i in [1, 2, 3] {
                @invariant(count < 3)
                count = count + 1
              }
            }
            test()
          `
        },
        {
          name: 'invariant after modification',
          code: `
            do test() {
              let count = 0
              for i in [1, 2, 3] {
                count = count + 1
                @invariant(count < 3)
              }
            }
            test()
          `
        }
      ];

      // Both should fail at the same logical point (iteration 2 end, when count=3)
      for (const tc of testCases) {
        expect(() => run(tc.code)).toThrow(/Invariant violated/);
      }
    });
  });
});
