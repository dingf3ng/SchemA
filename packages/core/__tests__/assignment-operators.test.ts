import { run } from '../src/index';

describe('Compound Assignment Operators', () => {
  it('should handle += operator', () => {
    const code = `
      let a = 1
      a += 2
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['3']);
  });

  it('should handle -= operator', () => {
    const code = `
      let a = 5
      a -= 2
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['3']);
  });

  it('should handle *= operator', () => {
    const code = `
      let a = 3
      a *= 2
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['6']);
  });

  it('should handle /= operator', () => {
    const code = `
      let a = 6
      a /= 2
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['3']);
  });
  
  it('should handle %= operator', () => {
    const code = `
      let a = 7
      a %= 3
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['1']);
  });

  it('should handle <<= operator', () => {
    const code = `
      let a = 1
      a <<= 2
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['4']);
  });

  it('should handle >>= operator', () => {
    const code = `
      let a = 8
      a >>= 2
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['2']);
  });

  it('should handle &&= operator', () => {
    const code = `
      let a = true
      a &&= false
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['false']);
  });

  it('should handle ||= operator', () => {
    const code = `
      let a = false
      a ||= true
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['true']);
  });

  it('should handle /.= operator', () => {
    const code = `
      let a = 5.0
      a /.= 2.0
      print(a)
    `;
    const result = run(code);
    expect(result).toEqual(['2.5']);
  });
});
