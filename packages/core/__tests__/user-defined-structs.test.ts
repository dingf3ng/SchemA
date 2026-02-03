import { run } from '../src/index';

describe('User-Defined Structs', () => {
  describe('Basic Struct Declaration', () => {
    it('should parse and execute a simple struct', () => {
      const code = `
        struct Counter {
          data count = 0

          do increment() {
            count += 1
          }

          do getValue() {
            return count
          }
        }

        let c = Counter()
        c.increment()
        c.increment()
        print(c.getValue())
      `;
      const output = run(code);
      expect(output).toEqual(['2']);
    });

    it('should support struct with generic type parameter', () => {
      const code = `
        struct Stack<T> {
          data arr: Array<T> = []
          data length = 0

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
        }

        let s = Stack()
        @assert(typeof(s) == "Stack<int>")
        s.push(1)
        s.push(2)
        s.push(3)
        print(s.size())
        print(s.pop())
        print(s.size())
      `;
      const output = run(code);
      expect(output).toEqual(['3', '3', '2']);
    });
  });

  it('should support struct with generic type parameter unused', () => {
    const code = `
      struct Stack<T> {
        data arr: Array<T> = []
        data length = 0

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
      }

      let s = Stack()
      @assert(typeof(s) == "Stack<weak>")
    `;
    const output = run(code);
    expect(() => output).not.toThrow();
  });

describe('Struct with Multiple Methods', () => {
  it('should support multiple method calls', () => {
    const code = `
        struct Point {
          data x = 0
          data y = 0

          do setX(val) {
            x = val
          }

          do setY(val) {
            y = val
          }

          do getX() {
            return x
          }

          do getY() {
            return y
          }
        }

        let p = Point()
        p.setX(10)
        p.setY(20)
        print(p.getX())
        print(p.getY())
      `;
    const output = run(code);
    expect(output).toEqual(['10', '20']);
  });
});

describe('Struct Instance Independence', () => {
  it('should maintain separate state for different instances', () => {
    const code = `
        struct Counter {
          data count = 0

          do increment() {
            count += 1
            @assert(typeof(count) == "int")
          }

          do getValue() {
            @assert(typeof(count) == "int")
            return count
          }
        }

        let c1 = Counter()
        let c2 = Counter()
        c1.increment()
        c1.increment()
        c2.increment()
        print(c1.getValue())
        print(c2.getValue())
      `;
    const output = run(code);
    expect(output).toEqual(['2', '1']);
  });
});

describe('Queue Data Structure', () => {
  it('should implement a basic queue with enqueue and dequeue', () => {
    const code = `
      struct Queue<T> {
        data items: Array<T> = []
        data front = 0
        data back = 0

        do enqueue(val) {
          items.push(val)
          back += 1
        }

        do dequeue() {
          if front == back {
            return -1
          }
          let val = items[front]
          front += 1
          return val
        }

        do size() {
          return back - front
        }

        do isEmpty() {
          return front == back
        }
      }

      let q = Queue()
      q.enqueue(10)
      q.enqueue(20)
      q.enqueue(30)
      print(q.size())
      print(q.dequeue())
      print(q.dequeue())
      print(q.size())
      print(q.dequeue())
      print(q.isEmpty())
    `;
    const output = run(code);
    expect(output).toEqual(['3', '10', '20', '1', '30', 'true']);
  });

  it('should handle dequeue on empty queue', () => {
    const code = `
      struct Queue<T> {
        data items: Array<T> = []
        data front = 0
        data back = 0

        do enqueue(val) {
          items.push(val)
          back += 1
        }

        do dequeue() {
          if front == back {
            return -1
          }
          let val = items[front]
          front += 1
          return val
        }

        do isEmpty() {
          return front == back
        }
      }

      let q = Queue()
      print(q.isEmpty())
      print(q.dequeue())
      q.enqueue(5)
      print(q.dequeue())
      print(q.dequeue())
    `;
    const output = run(code);
    expect(output).toEqual(['true', '-1', '5', '-1']);
  });

  it('should work with string type queue', () => {
    const code = `
      struct Queue<T> {
        data items: Array<T> = []
        data front = 0
        data back = 0

        do enqueue(val) {
          items.push(val)
          back += 1
        }

        do dequeue() {
          if front == back {
            return ""
          }
          let val = items[front]
          front += 1
          return val
        }
      }

      let q = Queue()
      @assert(typeof(q) == "Queue<string>")
      q.enqueue("hello")
      q.enqueue("world")
      print(q.dequeue())
      print(q.dequeue())
    `;
    const output = run(code);
    expect(output).toEqual(['hello', 'world']);
  });
});

describe('Deque (Double-Ended Queue)', () => {
  it('should support push and pop from both ends', () => {
    const code = `
      struct Deque<T> {
        data items: Array<T> = []
        data frontIdx = 0
        data backIdx = 0

        do pushFront(val) {
          frontIdx -= 1
          items[frontIdx] = val
        }

        do pushBack(val) {
          items[backIdx] = val
          backIdx += 1
        }

        do popFront() {
          if frontIdx == backIdx {
            return -1
          }
          let val = items[frontIdx]
          frontIdx += 1
          return val
        }

        do popBack() {
          if frontIdx == backIdx {
            return -1
          }
          backIdx -= 1
          let val = items[backIdx]
          return val
        }

        do size() {
          return backIdx - frontIdx
        }
      }

      let dq = Deque()
      dq.pushBack(10)
      dq.pushBack(20)
      dq.pushFront(5)
      dq.pushFront(1)
      print(dq.size())
      print(dq.popFront())
      print(dq.popBack())
      print(dq.popFront())
      print(dq.popBack())
      print(dq.size())
    `;
    const output = run(code);
    expect(output).toEqual(['4', '1', '20', '5', '10', '0']);
  });

  it('should handle empty deque operations', () => {
    const code = `
      struct Deque<T> {
        data items: Array<T> = []
        data frontIdx = 0
        data backIdx = 0

        do pushFront(val) {
          frontIdx -= 1
          items[frontIdx] = val
        }

        do pushBack(val) {
          items[backIdx] = val
          backIdx += 1
        }

        do popFront() {
          if frontIdx == backIdx {
            return -1
          }
          let val = items[frontIdx]
          frontIdx += 1
          return val
        }

        do popBack() {
          if frontIdx == backIdx {
            return -1
          }
          backIdx -= 1
          let val = items[backIdx]
          return val
        }

        do isEmpty() {
          return frontIdx == backIdx
        }
      }

      let dq = Deque()
      print(dq.isEmpty())
      print(dq.popFront())
      print(dq.popBack())
      dq.pushFront(42)
      print(dq.popBack())
      print(dq.isEmpty())
    `;
    const output = run(code);
    expect(output).toEqual(['true', '-1', '-1', '42', 'true']);
  });

  it('should work as a stack using one end', () => {
    const code = `
      struct Deque<T> {
        data items: Array<T> = []
        data frontIdx = 0
        data backIdx = 0

        do pushBack(val) {
          items[backIdx] = val
          backIdx += 1
        }

        do popBack() {
          if frontIdx == backIdx {
            return -1
          }
          backIdx -= 1
          let val = items[backIdx]
          return val
        }
      }

      let dq = Deque()
      dq.pushBack(1)
      dq.pushBack(2)
      dq.pushBack(3)
      print(dq.popBack())
      print(dq.popBack())
      print(dq.popBack())
    `;
    const output = run(code);
    expect(output).toEqual(['3', '2', '1']);
  });

  it('should implement circular buffer deque with wrap-around', () => {
    const code = `
      struct CircularDeque<T> {
        data items: Array<T> = [0, 0, 0, 0, 0, 0, 0, 0]
        data capacity = 8
        data frontIdx = 0
        data backIdx = 0
        data count = 0

        do pushFront(val) {
          if count == capacity {
            return false
          }
          frontIdx = (frontIdx - 1 + capacity) % capacity
          items[frontIdx] = val
          count += 1
          return true
        }

        do pushBack(val) {
          if count == capacity {
            return false
          }
          items[backIdx] = val
          backIdx = (backIdx + 1) % capacity
          count += 1
          return true
        }

        do popFront() {
          if count == 0 {
            return -1
          }
          let val = items[frontIdx]
          frontIdx = (frontIdx + 1) % capacity
          count -= 1
          return val
        }

        do popBack() {
          if count == 0 {
            return -1
          }
          backIdx = (backIdx - 1 + capacity) % capacity
          let val = items[backIdx]
          count -= 1
          return val
        }

        do size() {
          return count
        }

        do isEmpty() {
          return count == 0
        }

        do isFull() {
          return count == capacity
        }
      }

      let dq = CircularDeque()
      
      // Test wrap-around: push to front when frontIdx is 0
      // frontIdx starts at 0, so pushFront should wrap to index 7
      dq.pushFront(10)  // frontIdx wraps to 7
      dq.pushFront(20)  // frontIdx wraps to 6
      dq.pushFront(30)  // frontIdx wraps to 5
      
      print(dq.size())
      print(dq.popFront())  // Should get 30 from index 5
      print(dq.popFront())  // Should get 20 from index 6
      print(dq.popFront())  // Should get 10 from index 7
      print(dq.isEmpty())
      
      // Test mixed operations with wrap-around
      dq.pushBack(1)
      dq.pushBack(2)
      dq.pushFront(0)
      print(dq.popFront())  // 0
      print(dq.popBack())   // 2
      print(dq.popFront())  // 1
    `;
    const output = run(code);
    expect(output).toEqual(['3', '30', '20', '10', 'true', '0', '2', '1']);
  });

  it('should handle circular buffer when full', () => {
    const code = `
      struct CircularDeque<T> {
        data items: Array<T> = [0, 0, 0, 0]
        data capacity = 4
        data frontIdx = 0
        data backIdx = 0
        data count = 0

        do pushFront(val) {
          if count == capacity {
            return false
          }
          frontIdx = (frontIdx - 1 + capacity) % capacity
          items[frontIdx] = val
          count += 1
          return true
        }

        do pushBack(val) {
          if count == capacity {
            return false
          }
          items[backIdx] = val
          backIdx = (backIdx + 1) % capacity
          count += 1
          return true
        }

        do popFront() {
          if count == 0 {
            return -1
          }
          let val = items[frontIdx]
          frontIdx = (frontIdx + 1) % capacity
          count -= 1
          return val
        }

        do isFull() {
          return count == capacity
        }

        do size() {
          return count
        }
      }

      let dq = CircularDeque()
      print(dq.pushBack(1))
      print(dq.pushBack(2))
      print(dq.pushFront(0))
      print(dq.pushFront(-1))
      print(dq.isFull())
      print(dq.pushBack(99))  // Should fail, deque is full
      print(dq.size())
      
      // Pop all and verify order
      print(dq.popFront())
      print(dq.popFront())
      print(dq.popFront())
      print(dq.popFront())
    `;
    const output = run(code);
    expect(output).toEqual(['true', 'true', 'true', 'true', 'true', 'false', '4', '-1', '0', '1', '2']);
  });
});
});
