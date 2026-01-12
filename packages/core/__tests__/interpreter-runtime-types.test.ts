import { run, runMachine } from '../src/index';

describe('Interpreter Runtime Type Resolution', () => {
  describe('Numeric Operations Between Int and Float', () => {
    it('should handle int + float and return float', () => {
      const code = `
        let x: int = 10
        let y: float = 2.5
        let z = x + y
        @assert(z == 12.5, "10 + 2.5 should be 12.5")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle float + int and return float', () => {
      const code = `
        let x: float = 5.5
        let y: int = 10
        let z = x + y
        @assert(z == 15.5, "5.5 + 10 should be 15.5")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle int - float and return float', () => {
      const code = `
        let x: int = 10
        let y: float = 2.5
        let z = x - y
        @assert(z == 7.5, "10 - 2.5 should be 7.5")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle int * float and return float', () => {
      const code = `
        let x: int = 4
        let y: float = 2.5
        let z = x * y
        @assert(z == 10.0, "4 * 2.5 should be 10.0")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle int / int and return int', () => {
      const code = `
        let x: int = 10
        let y: int = 2
        let z = x / y
        @assert(z == 5, "10 / 2 should be 5")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle int /. int and return float', () => {
      const code = `
        let x: int = 15
        let y: int = 3
        let z = x /. y
        @assert(z == 5.0, "15 /. 3 should be 5.0")
        @assert(typeof(z) == "float")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle complex mixed arithmetic', () => {
      const code = `
        let a: int = 10
        let b: float = 2.5
        let c: int = 4
        let result = (a + b) * c - 3.0
        @assert(result == 47.0, "(10 + 2.5) * 4 - 3.0 should be 47.0")
        @assert(typeof(result) == "float")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });
  });
});
