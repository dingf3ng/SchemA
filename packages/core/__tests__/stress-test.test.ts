import { run } from '../src/index';

describe('Stress Tests', () => {
  describe('TypeChecker Stress Tests', () => {
    it('should handle deeply nested function calls', () => {
      // Generate 50 nested function calls
      const depth = 50;
      let functionDecls = '';

      for (let i = 0; i < depth; i++) {
        if (i === 0) {
          functionDecls += `do func0() -> int { return 1 }\n`;
        } else {
          functionDecls += `do func${i}() -> int { return func${i-1}() + 1 }\n`;
        }
      }

      const code = `
        ${functionDecls}
        do main() {
          let result = func${depth-1}()
          print(result)
        }
        
        main()
      `;

      const start = Date.now();
      expect(() => run(code)).not.toThrow();
      const duration = Date.now() - start;

      console.log(`  ✓ Deeply nested functions (depth=${depth}): ${duration}ms`);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should handle large arrays with complex operations', () => {
      const code = `
        do processArray(arr: Array<int>) -> int {
          let sum = 0
          for item in arr {
            sum = sum + item
          }
          return sum
        }

        do main() {
          let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                     11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
                     21, 22, 23, 24, 25, 26, 27, 28, 29, 30]

          let result1 = processArray(arr)
          let result2 = processArray(arr)
          let result3 = processArray(arr)

          print(result1)
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Large array processing: ${duration}ms`);
      expect(output).toHaveLength(1);
      expect(output[0]).toBe('465');
      expect(duration).toBeLessThan(1000);
    });

    it('should handle deeply nested generic types', () => {
      const code = `
        do createNestedStructure() {
          let m1 = Map()
          let m2 = Map()
          let m3 = Map()

          let arr1 = [1, 2, 3]

          m1.set(1, arr1)
          m2.set(2, m1)
          m3.set(3, m2)

          return m3
        }

        do main() {
          let nested = createNestedStructure()
          print("Created nested structure")
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Deeply nested generic types: ${duration}ms`);
      expect(output).toEqual(['Created nested structure']);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple complex recursive functions', () => {
      const code = `
        do fibonacci(n: int) -> int {
          if n <= 1 {
            return n
          }
          return fibonacci(n - 1) + fibonacci(n - 2)
        }

        do factorial(n: int) -> int {
          if n <= 1 {
            return 1
          }
          return n * factorial(n - 1)
        }

        do power(base: int, exp: int) -> int {
          if exp == 0 {
            return 1
          }
          return base * power(base, exp - 1)
        }

        do gcd(a: int, b: int) -> int {
          if b == 0 {
            return a
          }
          return gcd(b, a % b)
        }

        do sumDigits(n: int) -> int {
          if n < 10 {
            return n
          }
          return (n % 10) + sumDigits(n / 10)
        }

        do main() {
          let fib10 = fibonacci(10)
          let fact10 = factorial(10)
          let pow23 = power(2, 3)
          let gcd4860 = gcd(48, 60)
          let digits = sumDigits(12345)

          print(fib10)
          print(fact10)
          print(pow23)
          print(gcd4860)
          print(digits)
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Multiple recursive functions: ${duration}ms`);
      expect(output).toEqual(['55', '3628800', '8', '12', '15']);
      expect(duration).toBeLessThan(1500);
    });

    it('should handle complex type inference with polymorphic types', () => {
      const code = `
        do processData(data) {
          let m = Map()
          let result = []

          for item in data {
            m.set(item, item * 2)
            result.push(item)
          }

          return result
        }

        do transformData(input) {
          let result = []
          for item in input {
            result.push(item + 1)
          }
          return result
        }

        do main() {
          let arr1 = [1, 2, 3, 4, 5]
          let arr2 = [3, 4, 5, 6, 7]

          let processed = processData(arr1)
          let transformed = transformData(arr2)

          print("Processing complete")
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Complex type inference: ${duration}ms`);
      expect(output).toEqual(['Processing complete']);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle many function declarations', () => {
      // Generate 100 simple functions
      const funcCount = 100;
      let functionDecls = '';

      for (let i = 0; i < funcCount; i++) {
        functionDecls += `
          do func${i}(x: int) -> int {
            return x + ${i}
          }
        `;
      }

      let calls = '';
      for (let i = 0; i < 10; i++) {
        calls += `let result${i} = func${i}(${i})\n`;
      }

      const code = `
        ${functionDecls}

        do main() {
          ${calls}
          print("All functions declared")
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Many function declarations (${funcCount} functions): ${duration}ms`);
      expect(output).toEqual(['All functions declared']);
      expect(duration).toBeLessThan(2000);
    });

    it('should efficiently handle early convergence optimization', () => {
      // This test verifies the optimization works by ensuring
      // simple programs don't take long even with the potential for 10 passes
      const code = `
        do simple(x: int) -> int {
          return x + 1
        }

        do main() {
          let a = 1
          let b = 2
          let c = 3
          print(simple(a))
          print(simple(b))
          print(simple(c))  
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Early convergence test: ${duration}ms`);
      expect(output).toEqual(['2', '3', '4']);
      // Should be very fast due to early convergence (typically 1-2 passes)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Interpreter Stress Tests', () => {
    it('should handle deep recursion efficiently', () => {
      const code = `
        do countdown(n: int) -> int {
          if n <= 0 {
            return 0
          }
          return 1 + countdown(n - 1)
        }

        do main() {
          let result = countdown(500)
          print(result)
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Deep recursion (500 levels): ${duration}ms`);
      expect(output).toEqual(['500']);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large loops efficiently', () => {
      const code = `
        do sumToN(n: int) -> int {
          let sum = 0
          for i in 0..n {
            sum = sum + i
          }
          return sum
        }

        do main() {
          let result = sumToN(5000)
          print(result)
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Large loop (5000 iterations): ${duration}ms`);
      expect(output).toEqual(['12497500']);
      expect(duration).toBeLessThan(500);
    });

    // it('should handle EXTREMELY large loops efficiently', () => {
    //   const code = `
    //     do sumToN(n: int) -> int {
    //       let sum = 0
    //       for i in 0..n {
    //         sum = sum + 1
    //       }
    //       return sum
    //     }

    //     do main() {
    //       let result = sumToN(500000)
    //       print(result)
    //     }
        
    //     main()
    //   `;

    //   const start = Date.now();
    //   const output = run(code);
    //   const duration = Date.now() - start;

    //   console.log(`  ✓ EXTREMELY large loop (500000 iterations): ${duration}ms`);
    //   expect(output).toEqual(['500000']);
    //   expect(duration).toBeLessThan(500);
    // });

    // it('should handle EXTREMELY large loops efficiently', () => {
    //   const code = `
    //     do sumToN(n: int) -> int {
    //       let sum = 0
    //       while sum < n {
    //         sum = sum + 1
    //       }
    //       return sum
    //     }

    //     do main() {
    //       let result = sumToN(10000000)
    //       print(result)
    //     }
        
    //     main()
    //   `;

    //   const start = Date.now();
    //   const output = run(code);
    //   const duration = Date.now() - start;

    //   console.log(`  ✓ EXTREMELY large loop (10000000 iterations): ${duration}ms`);
    //   expect(output).toEqual(['10000000']);
    //   expect(duration).toBeLessThan(4000);
    // });

    it('should handle nested loops efficiently', () => {
      const code = `
        do nestedLoops() -> int {
          let sum = 0
          for i in 0..50 {
            for j in 0..50 {
              sum = sum + 1
            }
          }
          return sum
        }

        do main() {
          let result = nestedLoops()
          print(result)
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Nested loops (50x50): ${duration}ms`);
      expect(output).toEqual(['2500']);
      expect(duration).toBeLessThan(500);
    });

    it('should handle heap operations with many elements', () => {
      const code = `
        do testHeap() -> int {
          let h = MinHeap()

          for i in 0..100 {
            h.push(100 - i)
          }

          let sum = 0
          let count = 0
          while h.size() > 0 && count < 100 {
            let val = h.pop()
            sum = sum + val
            count = count + 1
          }

          return sum
        }

        do main() {
          let result = testHeap()
          print(result)
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Heap operations (100 elements): ${duration}ms`);
      expect(output).toEqual(['5050']);
      expect(duration).toBeLessThan(500);
    });

    it('should handle memory-intensive operations', () => {
      const code = `
        do createLargeStructure() {
          let maps = []

          for i in 0..10 {
            let m = Map()
            for j in 0..30 {
              m.set(j, j * i)
            }
            maps.push(m)
          }

          return maps
        }

        do main() {
          let structure = createLargeStructure()
          print("Structure created")
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Memory-intensive operations: ${duration}ms`);
      expect(output).toEqual(['Structure created']);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Combined Stress Tests', () => {
    it('should handle a complete complex program', () => {
      const code = `
        do sumArray(arr: Array<int>) -> int {
          let sum = 0
          for x in arr {
            sum = sum + x
          }
          return sum
        }

        do filterEven(arr: Array<int>) -> Array<int> {
          let result = []
          for x in arr {
            if x % 2 == 0 {
              result.push(x)
            }
          }
          return result
        }

        do main() {
          let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          let evens = filterEven(numbers)
          let sum = sumArray(evens)
          print("Even numbers sum:")
          print(sum)
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Complete complex program: ${duration}ms`);
      expect(output).toEqual([
        'Even numbers sum:',
        '30'
      ]);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle worst-case type inference scenario', () => {
      // This creates a scenario that would have taken all 10 passes
      // in the old implementation but should converge faster now
      const code = `
        do f1(x) { return x }
        do f2(x) { return f1(x) }
        do f3(x) { return f2(x) }
        do f4(x) { return f3(x) }
        do f5(x) { return f4(x) }
        do f6(x) { return f5(x) }
        do f7(x) { return f6(x) }
        do f8(x) { return f7(x) }

        do main() {
          let result = f8(42)
          print(result)
        }

        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Worst-case type inference: ${duration}ms`);
      expect(output).toEqual(['42']);
      // With optimization, this should converge in ~8 passes instead of 10
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should complete all operations within reasonable time bounds', () => {
      const code = `
        do arithmetic() -> int {
          let sum = 0
          for i in 0..100 {
            sum = sum + (i * 2) - 1
          }
          return sum
        }

        do main() {
          let result = arithmetic()
          print(result)
        }
        
        main()
      `;

      const start = Date.now();
      const output = run(code);
      const duration = Date.now() - start;

      console.log(`  ✓ Performance regression check: ${duration}ms`);
      expect(output).toEqual(['9800']);
      expect(duration).toBeLessThan(500);
    });
  });
});
