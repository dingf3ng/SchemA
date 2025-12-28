import { runWithEnv } from '../src/index';
import { Predicate } from '../src/runtime/values';

/**
 * Helper to check if a predicate of a specific kind exists
 */
function hasPredicate(predicates: Predicate[], kind: string): boolean {
  return predicates.some(p => p.kind === kind);
}

describe('Frozen Predicate - Invariant Synthesis', () => {
  describe('Frozen for Primitive Values', () => {
    test('should detect frozen constant values', () => {
      const code = `
        let constant = 42
        let i = 0
        while i < 5 {
          i = i + 1
          // constant never changes
        }
      `;
      const { output, env } = runWithEnv(code);
      const constant = env.get('constant');

      // Constant value should have frozen predicate
      expect(hasPredicate(constant.type.refinements, 'frozen')).toBe(true);
    });

    test('should NOT detect frozen for changing values', () => {
      const code = `
        let counter = 0
        while counter < 5 {
          counter = counter + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const counter = env.get('counter');

      // Counter changes so should not be frozen
      expect(hasPredicate(counter.type.refinements, 'frozen')).toBe(false);
    });
  });

  describe('Frozen for Arrays', () => {
    test('should detect frozen for completely unchanged arrays', () => {
      const code = `
        let frozenArray = [1, 2, 3]
        let i = 0
        while i < 5 {
          i = i + 1
          // frozenArray never changes
        }
      `;
      const { output, env } = runWithEnv(code);
      const frozenArray = env.get('frozenArray');

      // Array that never changes should have frozen predicate
      expect(hasPredicate(frozenArray.type.refinements, 'frozen')).toBe(true);
    });

    test('should NOT detect frozen when array elements change', () => {
      const code = `
        let changingArray = [1, 2, 3]
        let i = 0
        while i < 3 {
          changingArray[i] = i * 2
          i = i + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const changingArray = env.get('changingArray');

      // Array with changing elements should not be frozen
      expect(hasPredicate(changingArray.type.refinements, 'frozen')).toBe(false);
    });
  });

  describe('Frozen with String and Boolean', () => {
    test('should detect frozen for constant strings', () => {
      const code = `
        let str = "constant"
        let i = 0
        while i < 5 {
          i = i + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const str = env.get('str');

      expect(hasPredicate(str.type.refinements, 'frozen')).toBe(true);
    });

    test('should detect frozen for constant booleans', () => {
      const code = `
        let flag = true
        let i = 0
        while i < 5 {
          i = i + 1
        }
      `;
      const { output, env } = runWithEnv(code);
      const flag = env.get('flag');

      expect(hasPredicate(flag.type.refinements, 'frozen')).toBe(true);
    });
    describe('Insertion Sort - Frozen Sorted Prefix', () => {
      test('should demonstrate insertion sort maintains sorted prefix', () => {
        const code = `
        let arr = [5, 2, 4, 6, 1, 3]
        let i = 1

        while i < arr.length() {
          @invariant(arr[0..i] |- @sorted)
          @invariant(arr |- @range_satisfies(0, i - 1, @frozen))
          let key = arr[i]
          let j = i - 1
          // Insert arr[i] into the sorted sequence arr[0..i-1]
          while j >= 0 && arr[j] > key {
            arr[j + 1] = arr[j]
            j = j - 1
          }
          arr[j + 1] = key
          i = i + 1
        }
      `;
        const { env } = runWithEnv(code);
        const arr = env.get('arr');
        const arrValue = arr.value;
        expect(arrValue!.toString()).toBe('[1, 2, 3, 4, 5, 6]');
      });
    });
  });
});
