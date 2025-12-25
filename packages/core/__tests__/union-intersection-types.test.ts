import { AntlrParser } from '../src/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';

function check(code: string) {
  const parser = new AntlrParser();
  const ast = parser.parse(code);
  typeCheck(ast);
}

describe('Union and Intersection Types', () => {
  describe('Union Types', () => {
    it('should allow assigning member to union type', () => {
      const code = `
        do main() {
          let x: int = 10
          let y: int | string = x
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail when assigning union type to one of its members', () => {
      const code = `
        do main() {
          let x: int | string = "hello"
          let y: int = x
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });

    it('should fail when assigning incompatible type to union', () => {
      const code = `
        do main() {
          let x: boolean = true
          let y: int | string = x
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });

  describe('Intersection Types', () => {
    it('should allow assigning intersection type to its members', () => {
      // 'inf' is defined as int & float in builtins
      const code = `
        do main() {
          let x: int = inf
          let y: float = inf
        }
      `;
      expect(() => check(code)).not.toThrow();
    });

    it('should fail when assigning member to intersection type', () => {
      const code = `
        do main() {
          let x: int = 10
          let y: int & float = x
        }
      `;
      expect(() => check(code)).toThrow('Type mismatch');
    });
  });
});
