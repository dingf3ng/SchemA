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
});
