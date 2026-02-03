import { run } from '../src/index';

describe('Argument Count Validation', () => {
  describe('User-defined functions', () => {
    it('should reject function call with too many arguments', () => {
      const code = `
        do push(val) {
          print(val)
        }
        push(1, 2)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'push'.*expected 1.*got 2/);
    });

    it('should reject function call with too few arguments', () => {
      const code = `
        do add(a, b) {
          return a + b
        }
        add(1)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'add'.*expected 2.*got 1/);
    });

    it('should reject function call with zero arguments when one is expected', () => {
      const code = `
        do greet(name) {
          print(name)
        }
        greet()
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'greet'.*expected 1.*got 0/);
    });

    it('should reject function call with arguments when none are expected', () => {
      const code = `
        do sayHello() {
          print("hello")
        }
        sayHello(123)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'sayHello'.*expected 0.*got 1/);
    });

    it('should accept function call with correct number of arguments', () => {
      const code = `
        do add(a, b) {
          return a + b
        }
        print(add(1, 2))
      `;
      const output = run(code);
      expect(output).toEqual(['3']);
    });

    it('should accept function call with zero arguments when none are expected', () => {
      const code = `
        do getAnswer() {
          return 42
        }
        print(getAnswer())
      `;
      const output = run(code);
      expect(output).toEqual(['42']);
    });
  });

  describe('Built-in variadic functions', () => {
    it('should accept print with multiple arguments', () => {
      const code = `
        print(1, 2, 3)
      `;
      const output = run(code);
      expect(output).toEqual(['1 2 3']);
    });

    it('should accept int_max with multiple arguments', () => {
      const code = `
        print(int_max(1, 5, 3))
      `;
      const output = run(code);
      expect(output).toEqual(['5']);
    });

    it('should accept int_min with multiple arguments', () => {
      const code = `
        print(int_min(1, 5, 3))
      `;
      const output = run(code);
      expect(output).toEqual(['1']);
    });

    it('should accept int_max with single argument', () => {
      const code = `
        print(int_max(42))
      `;
      const output = run(code);
      expect(output).toEqual(['42']);
    });

    it('should accept float_max with multiple arguments', () => {
      const code = `
        print(float_max(1.5, 3.7, 2.1))
      `;
      const output = run(code);
      expect(output).toEqual(['3.7']);
    });

    it('should accept float_min with multiple arguments', () => {
      const code = `
        print(float_min(1.5, 3.7, 2.1))
      `;
      const output = run(code);
      expect(output).toEqual(['1.5']);
    });

    it('should accept print with no arguments', () => {
      const code = `
        print()
      `;
      const output = run(code);
      expect(output).toEqual(['']);
    });
  });

  describe('Method calls', () => {
    it('should reject array push with too many arguments', () => {
      const code = `
        let arr = [1, 2, 3]
        arr.push(4, 5)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'push'.*expected 1.*got 2/);
    });

    it('should reject array pop with arguments when none expected', () => {
      const code = `
        let arr = [1, 2, 3]
        arr.pop(1)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'pop'.*expected 0.*got 1/);
    });

    it('should reject array length with arguments when none expected', () => {
      const code = `
        let arr = [1, 2, 3]
        arr.length(1)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'length'.*expected 0.*got 1/);
    });

    it('should accept array push with correct number of arguments', () => {
      const code = `
        let arr = [1, 2, 3]
        arr.push(4)
        print(arr)
      `;
      const output = run(code);
      expect(output).toEqual(['[1, 2, 3, 4]']);
    });

    it('should accept array pop with correct number of arguments', () => {
      const code = `
        let arr = [1, 2, 3]
        let x = arr.pop()
        print(x)
      `;
      const output = run(code);
      expect(output).toEqual(['3']);
    });
  });

  describe('Complex scenario from user report', () => {
    it('should reject push with two arguments when one is expected', () => {
      const code = `
        let arr = []
        let length = 0

        do push(val) {
          arr.push(val)
          length += 1
        }

        do pop() {
          length -= 1
          return arr.pop()
        }

        do size() {
          return length
        }

        for i in ..10 {
          push(i)
        }
        push(123, 12)
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'push'.*expected 1.*got 2/);
    });

    it('should reject pop with one argument when none are expected', () => {
      const code = `
        let arr = []
        let length = 0

        do push(val) {
          arr.push(val)
          length += 1
        }

        do pop() {
          length -= 1
          return arr.pop()
        }

        for i in ..10 {
          push(i)
        }
        print(pop(2))
      `;
      expect(() => run(code)).toThrow(/Argument count mismatch.*'pop'.*expected 0.*got 1/);
    });

    it('should work correctly when functions are called with proper arguments', () => {
      const code = `
        let arr = []
        let length = 0

        do push(val) {
          arr.push(val)
          length += 1
        }

        do pop() {
          length -= 1
          return arr.pop()
        }

        do size() {
          return length
        }

        for i in ..5 {
          push(i)
        }
        print(size())
        print(pop())
        print(size())
      `;
      const output = run(code);
      expect(output).toEqual(['5', '4', '4']);
    });
  });
});
