
import { Stepper } from '../src/runtime/stepper';
import { parse } from '../src/transpiler/parser';
import { typeCheck } from '../src/type-checker/type-checker-main';
import { Interpreter } from '../src/runtime/interpreter';

describe('Stepper Repro', () => {
  it('should step through recursive fibonacci in a loop without getting stuck', () => {
    const code = `
      // Functions
      do fibonacci(n) {
        if n <= 1 {
          return n
        }
        return fibonacci(n - 1) + fibonacci(n - 2)
      }

      print("Fibonacci sequence:")
      let i = 0
      until i == 3 {
        print(fibonacci(i))
        i = i + 1
      }
    `;

    const program = parse(code);
    typeCheck(program);

    const interpreter = new Interpreter();
    const stepper = new Stepper(interpreter);
    stepper.initialize(program);

    let steps = 0;
    const maxSteps = 5000; // Increased limit for recursive calls

    while (!stepper.isFinished() && steps < maxSteps) {
      stepper.step();
      steps++;
    }

    if (steps >= maxSteps) {
        // Just to give some debug info if it fails
        const state = stepper.getCurrentState();
        console.log("Stepper stuck at statement index:", state.statementIndex);
        if (state.statement) {
            console.log("Statement type:", state.statement.type);
            console.log("Line:", state.line);
        }
    }

    expect(steps).toBeLessThan(maxSteps);
    expect(stepper.isFinished()).toBe(true);
  });

  it('should step through binary search without getting stuck on if statements', () => {
    const code = `
      do binarySearch(arr, target) {
        let left = -1
        let right = arr.length()

        until left + 1 == right {
          let mid = (left + right) / 2
          let midVal = arr[mid]
          if midVal == target {
            return mid
          } else if midVal < target {
            left = mid
          } else {
            right = mid
          }
        }
        return -1
      }

      let sortedArr = [1, 3, 5, 7, 9, 11, 13]
      let index = binarySearch(sortedArr, 7)
      print(index)
    `;

    const program = parse(code);
    typeCheck(program);

    const interpreter = new Interpreter();
    const stepper = new Stepper(interpreter);
    stepper.initialize(program);

    let steps = 0;
    const maxSteps = 5000;

    let lastStatementType = '';
    let sameStatementCount = 0;

    while (!stepper.isFinished() && steps < maxSteps) {
      const state = stepper.getCurrentState();
      const currentType = state.statement?.type || 'null';

      if (currentType === lastStatementType && currentType === 'IfStatement') {
        sameStatementCount++;
        if (sameStatementCount > 10) {
          console.log("Stuck on IfStatement!");
          console.log("Statement:", state.statement);
          console.log("Line:", state.line);
          console.log("Call stack:", state.callStack);
          break;
        }
      } else {
        sameStatementCount = 0;
        lastStatementType = currentType;
      }

      stepper.step();
      steps++;
    }

    if (steps >= maxSteps) {
        const state = stepper.getCurrentState();
        console.log("Stepper stuck at statement index:", state.statementIndex);
        if (state.statement) {
            console.log("Statement type:", state.statement.type);
            console.log("Line:", state.line);
        }
    }

    expect(steps).toBeLessThan(maxSteps);
    expect(stepper.isFinished()).toBe(true);
  });

  it('should highlight statements inside if branches correctly', () => {
    const code = `
do test(x) {
  if x == 1 {
    let a = 10
    print(a)
  } else if x == 2 {
    let b = 20
    print(b)
  } else {
    let c = 30
    print(c)
  }
}

test(2)
    `;

    const program = parse(code);
    typeCheck(program);

    const interpreter = new Interpreter();
    const stepper = new Stepper(interpreter);
    stepper.initialize(program);

    const highlightedLines: number[] = [];
    let steps = 0;
    const maxSteps = 100;

    while (!stepper.isFinished() && steps < maxSteps) {
      const state = stepper.getCurrentState();
      if (state.statement) {
        highlightedLines.push(state.line);
        console.log(`Step ${steps}: Line ${state.line}, Type: ${state.statement.type}`);
      }
      stepper.step();
      steps++;
    }

    // We should see line 6 (let b = 20) and line 7 (print(b)) highlighted
    expect(highlightedLines).toContain(6);
    expect(highlightedLines).toContain(7);

    // We should NOT see lines from the other branches
    // Line 3 is "let a = 10" (then branch - should not execute)
    // Line 9 is "let c = 30" (else branch - should not execute)
    expect(highlightedLines).not.toContain(3);
    expect(highlightedLines).not.toContain(9);

    expect(stepper.isFinished()).toBe(true);
  });
});
