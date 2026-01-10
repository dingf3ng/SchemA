import { run, runMachine } from '../src/index';

describe('Interpreter Runtime Type Resolution', () => {
  describe('Union Type Resolution in Binary Expressions', () => {
    it('should resolve int | string to int for addition when value is int', () => {
      const code = `
        let x: int | string = 10
        let y: int | string = 20
        let z = x + y
        @assert(z == 30, "10 + 20 should be 30")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should resolve int | string to string for concatenation when value is string', () => {
      const code = `
        let x: int | string = "hello"
        let y: int | string = "world"
        let z = x + y
        @assert(z == "helloworld", "strings should concatenate")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should resolve int | float to float for addition', () => {
      const code = `
        let x: int | float = 10
        let y: int | float = 2.5
        let z = x + y
        @assert(z == 12.5, "10 + 2.5 should be 12.5")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should handle mixed int and float in union', () => {
      const code = `
        let x: int | float = 10
        let y: int | float = 20
        let z = x + y
        @assert(z == 30, "10 + 20 should be 30")
      `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });

    it('should fail when types are incompatible at runtime despite union type', () => {
      const code = `
         let x: int | string = 10
         let y: int | string = "hello"
         let z = x + y
      `;
      expect(() => run(code)).toThrow(/Cannot add int and string/);
      expect(() => runMachine(code)).toThrow(/Cannot add int and string/);
    });

    it('should resolve boolean | int correctly for logic', () => {
      const code = `
          let x: boolean | int = true
          let y: boolean | int = false
          let z = x || y
          @assert(z == true, "true || false should be true")
        `;
      expect(() => run(code)).not.toThrow();
      expect(() => runMachine(code)).not.toThrow();
      expect(run(code)).toEqual(runMachine(code));
    });
  });
});
