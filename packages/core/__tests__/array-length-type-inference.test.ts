import { run } from '../src/index';

describe('Array length() type inference', () => {
  test('arr.length() - 1 should be inferred as int without explicit annotation', () => {
    const code = `
      do reverseArray(arr) {
        let left = 0
        let right = arr.length() - 1

        while left < right {
          let temp = arr[left]
          arr[left] = arr[right]
          arr[right] = temp

          left = left + 1
          right = right - 1
        }
      }

      reverseArray([1, 2, 3, 4, 5])
    `;

    expect(() => run(code)).not.toThrow();
  });

  test('arr.length() should always return int regardless of element type', () => {
    const code = `
      let arr1: Array<int> = [1, 2, 3]
      let len1 = arr1.length()

      let arr2: Array<string> = ["a", "b", "c"]
      let len2 = arr2.length()

      // Both should be usable as array indices
      let idx1 = len1 - 1
      let idx2 = len2 - 1

      print(arr1[idx1])
      print(arr2[idx2])
    `;

    expect(() => run(code)).not.toThrow();
  });

  test('arithmetic operations with arr.length() should produce int', () => {
    const code = `
      let arr = [1, 2, 3, 4, 5]
      let mid = arr.length() / 2
      let lastIdx = arr.length() - 1
      let size = arr.length() + 1
      let doubled = arr.length() * 2

      // All should be usable as array indices (where applicable)
      print(arr[lastIdx])
      print(arr[mid])
    `;

    expect(() => run(code)).not.toThrow();
  });

  test('single element array reverse should work', () => {
    const code = `
      do reverseArray(arr) {
        let left = 0
        let right = arr.length() - 1

        while left < right {
          let temp = arr[left]
          arr[left] = arr[right]
          arr[right] = temp

          left = left + 1
          right = right - 1
        }
      }

      reverseArray([42])
    `;

    expect(() => run(code)).not.toThrow();
  });

  test('empty array length should return int', () => {
    const code = `
      let arr: Array<int> = []
      let len = arr.length()

      if len == 0 {
        print("empty")
      }
    `;

    expect(() => run(code)).not.toThrow();
  });
});
