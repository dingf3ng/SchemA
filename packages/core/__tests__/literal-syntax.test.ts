import { run } from '../src/index';

function expectOutput(code: string, expected: string[]) {
  const output = run(code);
  expect(output).toEqual(expected);
}

describe('Literal Syntax', () => {
  describe('Tuple Literals', () => {
    it('should parse two-element tuples', () => {
      expectOutput(`
        let t = (1, 2)
        print(t)
      `, ['(1, 2)']);
    });

    it('should parse three-element tuples', () => {
      expectOutput(`
        let t = (1, 2, 3)
        print(t)
      `, ['(1, 2, 3)']);
    });

    it('should parse mixed-type tuples', () => {
      expectOutput(`
        let t = ("hello", 42, true)
        print(t)
      `, ['(hello, 42, true)']);
    });

    it('should parse single-element tuple with trailing comma', () => {
      expectOutput(`
        let t = (42,)
        print(t)
      `, ['(42)']);
    });

    it('should parse single-element tuple with expression', () => {
      expectOutput(`
        let t = (1 + 2,)
        print(t)
      `, ['(3)']);
    });

    it('should access single-element tuple by index', () => {
      expectOutput(`
        let t = (99,)
        print(t[0])
      `, ['99']);
    });

    it('should distinguish parenthesized expressions from tuples', () => {
      expectOutput(`
        let x = (1 + 2) * 3
        print(x)
      `, ['9']);
    });

    it('should support nested tuples', () => {
      expectOutput(`
        let t = ((1, 2), (3, 4))
        print(t)
      `, ['((1, 2), (3, 4))']);
    });
  });

  describe('Record Literals', () => {
    it('should parse simple records with quoted keys', () => {
      expectOutput(`
        let r = ("name": "Alice", "age": 30)
        print(r)
      `, ['{ name: Alice, age: 30 }']);
    });

    it('should parse single-field records', () => {
      // Single-field record: ("key": value)
      expectOutput(`
        let r = ("x": 10)
        print(r)
      `, ['{ x: 10 }']);
    });

    it('should parse multi-field records', () => {
      expectOutput(`
        let r = ("x": 10, "y": 20, "z": 30)
        print(r)
      `, ['{ x: 10, y: 20, z: 30 }']);
    });

    it('should access record fields by index', () => {
      expectOutput(`
        let r = ("name": "Bob", "score": 100)
        print(r["name"])
        print(r["score"])
      `, ['Bob', '100']);
    });
  });

  describe('Map Literals', () => {
    it('should parse map literals with curly braces', () => {
      expectOutput(`
        let m = {1: "one", 2: "two"}
        print(m.get(1))
        print(m.get(2))
      `, ['one', 'two']);
    });

    it('should parse empty maps', () => {
      expectOutput(`
        let m = {}
        m.set("key", "value")
        print(m.get("key"))
      `, ['value']);
    });

    it('should not parse empty sets', () => {
      expect(() => {
        run(`
          let s = {}
          s.add(1)
        `);
      }).toThrow()
    });

    it('should not parse string-keyed maps', () => {
      expectOutput(`
        let m = {"a": 1, "b": 2}
        print(m.get("a") + m.get("b"))
      `, ['3']);
    });
  });

  describe('Set Literals', () => {
    it('should parse set literals', () => {
      expectOutput(`
        let s = {1, 2, 3}
        print(s.size())
      `, ['3']);
    });

    it('should parse sets and verify membership', () => {
      expectOutput(`
        let s = {10, 20, 30}
        print(s.has(20))
        print(s.has(99))
      `, ['true', 'false']);
    });
  });

  describe('Array Literals', () => {
    it('should continue to work as before', () => {
      expectOutput(`
        let arr = [1, 2, 3, 4, 5]
        print(arr.length())
        print(arr[0])
        print(arr[4])
      `, ['5', '1', '5']);
    });

    it('should handle empty arrays', () => {
      expectOutput(`
        let arr = []
        arr.push(42)
        print(arr.length())
      `, ['1']);
    });
  });

  describe('Complex Expressions with Parentheses', () => {
    it('should handle complex arithmetic with parentheses', () => {
      expectOutput(`
        let a = 2
        let b = 3
        let c = 4
        let result = (a + b) * (c - 1)
        print(result)
      `, ['15']);
    });

    it('should handle nested parentheses', () => {
      expectOutput(`
        let x = ((1 + 2) * (3 + 4)) + 5
        print(x)
      `, ['26']);
    });

    it('should work in function calls', () => {
      expectOutput(`
        do add(a: int, b: int) -> int {
          return a + b
        }
        print(add((1 + 2), (3 + 4)))
      `, ['10']);
    });

    it('should work in conditionals', () => {
      expectOutput(`
        let x = 5
        if (x > 3) && (x < 10) {
          print("in range")
        }
      `, ['in range']);
    });
  });
});
