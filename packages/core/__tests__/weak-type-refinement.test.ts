import { run, runMachine } from '../src/index';

/**
 * Helper to ensure both interpreter and machine produce the same result
 */
function expectBothToEqual(code: string): string[] {
  const interpResult = run(code);
  const machineResult = runMachine(code);
  expect(interpResult).toEqual(machineResult);
  return interpResult;
}

/**
 * Helper to ensure both interpreter and machine throw the same error
 */
function expectBothToThrow(code: string, errorPattern: RegExp): void {
  expect(() => expectBothToEqual(code)).toThrow(errorPattern);
  expect(() => runMachine(code)).toThrow(errorPattern);
}

describe('Weak Type Refinement', () => {
  describe('Primitive Type Refinement', () => {
    it('should refine weak parameter to int when called with int', () => {
      const code = `
        do process(value) {
          let x = value
          return x + 10
        }
        
        print(process(5))
      `;
      expect(expectBothToEqual(code)).toEqual(['15']);
    });

    it('should refine weak parameter to float when called with float', () => {
      const code = `
        do process(value) {
          let x = value
          return x + 1.5
        }
        
        print(process(3.14))
      `;

      expect(expectBothToEqual(code)).toEqual(['4.640000000000001']);
    });

    it('should refine weak parameter to string when called with string', () => {
      const code = `
        do concat(value) {
          let x = value
          return x + " world"
        }
        
        print(concat("hello"))
      `;

      expect(expectBothToEqual(code)).toEqual(['hello world']);
    });

    it('should refine weak parameter to boolean when called with boolean', () => {
      const code = `
        do negate(value) {
          let x = value
          @assert(typeof(x) == "boolean")
          return !x
        }
        
        print(negate(true))
        print(negate(false))
      `;

      expect(expectBothToEqual(code)).toEqual(['false', 'true']);
    });

    it('should refine weak parameter used in comparisons', () => {
      const code = `
        do isPositive(num) {
          let n = num
          return n > 0
        }
        
        print(isPositive(5))
        print(isPositive(-3))
        print(isPositive(0))
      `;

      expect(expectBothToEqual(code)).toEqual(['true', 'false', 'false']);
    });

    it('should refine weak parameter used in while loop condition', () => {
      const code = `
        do countdown(start) {
          let i = start
          let sum = 0
          while i > 0 {
            sum = sum + i
            i = i - 1
          }
          return sum
        }
        
        print(countdown(5))
      `;

      expect(expectBothToEqual(code)).toEqual(['15']); // 5+4+3+2+1 = 15
    });
  });

  describe('Array Type Refinement', () => {
    it('should refine weak Array parameter to Array<int>', () => {
      const code = `
        do sumArray(arr) {
          let a = arr
          let sum = 0
          for x in a {
            sum = sum + x
          }
          return sum
        }
        
        print(sumArray([1, 2, 3, 4, 5]))
      `;

      expect(expectBothToEqual(code)).toEqual(['15']);
    });

    it('should refine weak Array parameter with array operations', () => {
      const code = `
        do processArray(arr) {
          let a = arr
          let len = a.length()
          return len
        }
        
        print(processArray([10, 20, 30]))
      `;

      expect(expectBothToEqual(code)).toEqual(['3']);
    });

    it('should refine weak Array parameter with index access', () => {
      const code = `
        do getFirst(arr) {
          let a = arr
          return a[0]
        }
        
        print(getFirst([42, 99, 17]))
      `;

      expect(expectBothToEqual(code)).toEqual(['42']);
    });

    it('should refine weak Array<weak> to Array<string>', () => {
      const code = `
        do joinStrings(arr) {
          let a = arr
          let result = ""
          for s in a {
            result = result + s
          }
          return result
        }
        
        print(joinStrings(["hello", " ", "world"]))
      `;

      expect(expectBothToEqual(code)).toEqual(['hello world']);
    });

    it('should handle nested arrays with weak types', () => {
      const code = `
        do sumNested(arr) {
          let a = arr
          let total = 0
          for inner in a {
            for x in inner {
              total = total + x
            }
          }
          return total
        }
        
        print(sumNested([[1, 2], [3, 4], [5]]))
      `;

      expect(expectBothToEqual(code)).toEqual(['15']);
    });
  });

  describe('Map Type Refinement', () => {
    it('should refine weak Map parameter to Map<string, int>', () => {
      const code = `
        do sumMapValues(m) {
          let map = m
          let sum = 0
          for key in map.keys() {
            sum = sum + map[key]
          }
          return sum
        }
        
        let myMap: Map<string, int> = Map()
        myMap["a"] = 10
        myMap["b"] = 20
        myMap["c"] = 30
        print(sumMapValues(myMap))
      `;

      expect(expectBothToEqual(code)).toEqual(['60']);
    });

    it('should refine weak Map parameter with map operations', () => {
      const code = `
        do getMapSize(m) {
          let map = m

          //@assert(typeof(map) == "Map<string, int>")
          print(typeof(map))

          return map.size()
        }
        
        let myMap = Map()
        myMap["x"] = 1
        myMap["y"] = 2
        print(getMapSize(myMap))
      `;

      expect(expectBothToEqual(code)).toEqual(['Map<string, int>', '2']);
    });

    it('should refine Map with weak key and value types', () => {
      const code = `
        do containsKey(m, key) {
          let map = m
          let k = key
          @assert(typeof(k) == "string")
          @assert(typeof(map) == "Map<string, int>")
          return map.has(k)
        }
        
        let myMap: Map<string, int> = Map()
        myMap["test"] = 42
        print(containsKey(myMap, "test"))
        print(containsKey(myMap, "missing"))
      `;

      expect(expectBothToEqual(code)).toEqual(['true', 'false']);
    });
  });

  describe('Set Type Refinement', () => {
    it('should refine weak Set parameter to Set<int>', () => {
      const code = `
        do sumSetValues(s) {
          let set = s
          let sum = 0

          @assert(typeof(sum) == "int")
          @assert(typeof(set) == "Set<int>")

          for x in set {
            sum = sum + x
          }
          return sum
        }
        
        let mySet: Set<int> = Set()
        mySet.add(5)
        mySet.add(10)
        mySet.add(15)
        print(sumSetValues(mySet))
      `;

      expect(expectBothToEqual(code)).toEqual(['30']);
    });

    it('should refine weak Set parameter with set operations', () => {
      const code = `
        do checkMembership(s, value) {
          let set = s
          let v = value

          @assert(typeof(v) == "string")
          @assert(typeof(set) == "Set<string>")

          return set.has(v)
        }
        
        let mySet: Set<string> = Set()
        mySet.add("apple")
        mySet.add("banana")
        print(checkMembership(mySet, "apple"))
        print(checkMembership(mySet, "orange"))
      `;

      expect(expectBothToEqual(code)).toEqual(['true', 'false']);
    });
  });

  describe('Heap Type Refinement', () => {
    it('should refine weak MinHeap parameter to MinHeap<int>', () => {
      const code = `
        do getMin(h) {
          let heap = h

          @assert(typeof(heap) == "Heap<int>")
          return heap.peek()
        }
        
        let myHeap: MinHeap<int> = MinHeap()
        myHeap.push(5)
        myHeap.push(2)
        myHeap.push(8)
        myHeap.push(1)
        print(getMin(myHeap))
      `;

      expect(expectBothToEqual(code)).toEqual(['1']);
    });

    it('should refine weak MaxHeap parameter with heap operations', () => {
      const code = `
        do getMax(h) {
          let heap = h

          @assert(typeof(heap) == "Heap<int>")

          return heap.peek()
        }
        
        let myHeap: MaxHeap<int> = MaxHeap()
        myHeap.push(5)
        myHeap.push(2)
        myHeap.push(8)
        myHeap.push(1)
        print(getMax(myHeap))
      `;

      expect(expectBothToEqual(code)).toEqual(['8']);
    });

    it('should refine weak heap parameter with extract operation', () => {
      const code = `
        do extractAll(h) {
          let heap = h
          let sum = 0

          @assert(typeof(heap) == "Heap<int>" && typeof(sum) == "int")
          until heap.size() == 0 {
            sum = sum + heap.pop()
          }
          return sum
        }
        
        let myHeap: MinHeap<int> = MinHeap()
        myHeap.push(10)
        myHeap.push(20)
        myHeap.push(30)
        print(extractAll(myHeap))
      `;

      expect(expectBothToEqual(code)).toEqual(['60']);
    });
  });

  describe('HeapMap Type Refinement', () => {
    it('should refine weak MinHeapMap parameter', () => {
      const code = `
        do getMinKey(hm) {
          let heapMap = hm

          @assert(typeof(heapMap) == "HeapMap<string, int>")
          return heapMap.peek()
        }
        
        let myHeapMap: MinHeapMap<string, int> = MinHeapMap()
        myHeapMap.push("a", 10)
        myHeapMap.push("b", 5)
        myHeapMap.push("c", 15)
        print(getMinKey(myHeapMap))
      `;

      expect(expectBothToEqual(code)).toEqual(['b']);
    });

    it('should refine weak MaxHeapMap parameter with operations', () => {
      const code = `
        do getMaxValue(hm) {
          let heapMap = hm

          @assert(typeof(heapMap) == "HeapMap<string, int>")
          return heapMap.peek()
        }
        
        let myHeapMap: MaxHeapMap<string, int> = MaxHeapMap()
        myHeapMap.push("x", 100)
        myHeapMap.push("y", 200)
        myHeapMap.push("z", 150)
        print(getMaxValue(myHeapMap))
      `;

      expect(expectBothToEqual(code)).toEqual(['y']);
    });
  });

  describe('Graph Type Refinement', () => {
    it('should refine weak Graph parameter to Graph<int>', () => {
      const code = `
        do addEdgeToGraph(g, from, to) {
          let graph = g
          let f = from
          let t = to

          @assert(typeof(f) == "int")
          @assert(typeof(t) == "int")
          @assert(typeof(graph) == "Graph<int>")

          graph.addEdge(f, t, 1)
          return graph.hasEdge(f, t)
        }
        
        let myGraph: Graph<int> = Graph(true)
        myGraph.addVertex(1)
        myGraph.addVertex(2)
        print(addEdgeToGraph(myGraph, 1, 2))
      `;

      expect(expectBothToEqual(code)).toEqual(['true']);
    });

    it('should refine weak Graph parameter with graph operations', () => {
      const code = `
        do getNeighborCount(g, node) {
          let graph = g
          let n = node
          
          @assert(typeof(n) == "string")
          @assert(typeof(graph) == "Graph<string>")

          let neighbors = graph.getNeighbors(n)
          return neighbors.length()
        }
        
        let myGraph: Graph<string> = Graph(true)
        myGraph.addVertex("A")
        myGraph.addVertex("B")
        myGraph.addVertex("C")
        myGraph.addEdge("A", "B", 1)
        myGraph.addEdge("A", "C", 2)
        print(getNeighborCount(myGraph, "A"))
      `;

      expect(expectBothToEqual(code)).toEqual(['2']);
    });
  });

  //   describe('BinaryTree Type Refinement', () => {
  //     it('should refine weak BinaryTree parameter', () => {
  //       const code = `
  //         do getTreeRoot(tree) {
  //           let t = tree
  //           return t.value
  //         }

  //         let myTree: BinaryTree<int> = BinaryTree(10)
  //         print(getTreeRoot(myTree))
  //       `;

  //       expect(expectBothToEqual(code)).toEqual(['10']);
  //     });

  //     it('should refine weak BinaryTree parameter with tree operations', () => {
  //       const code = `
  //         do getTreeValue(tree) {
  //           let t = tree
  //           let val = t.value
  //           return val * 2
  //         }

  //         let myTree: BinaryTree<int> = BinaryTree(10)
  //         myTree.left = BinaryTree(5)
  //         print(getTreeValue(myTree))
  //         print(getTreeValue(myTree.left))
  //       `;

  //       expect(expectBothToEqual(code)).toEqual(['20', '10']);
  //     });
  //   }); TODO: add left() and right() methods to BinaryTree first

  describe('Multiple Parameters with Weak Types', () => {
    it('should throw error when the arguments between multiple calls are inconsistent', () => {
      const code = `
        do add(a, b) {
          let x = a
          let y = b
          return x + y
        }
        
        print(add(10, 20))
        print(add(1.5, 2.5))
      `;

      expectBothToThrow(code, /expected int, got float/);
    });

    it('should refine mixed weak parameters', () => {
      const code = `
        do combine(num, arr) {
          let n = num
          let a = arr
          let sum = n
          for x in a {
            sum = sum + x
          }
          return sum
        }
        
        print(combine(10, [1, 2, 3]))
      `;

      expect(expectBothToEqual(code)).toEqual(['16']);
    });
  });

  describe('Complex Refinement Scenarios', () => {
    it('should refine weak types in nested function calls', () => {
      const code = `
        do inner(x) {
          let val = x
          return val * 2
        }
        
        do outer(y) {
          let value = y
          return inner(value) + 10
        }
        
        print(outer(5))
      `;

      expect(expectBothToEqual(code)).toEqual(['20']);
    });

    it('should refine weak types with multiple calls', () => {
      const code = `
        do process(value) {
          let v = value
          return v + 1
        }
        
        print(process(10))
        print(process(20))
        print(process(30))
      `;

      expect(expectBothToEqual(code)).toEqual(['11', '21', '31']);
    });

    it('should refine weak array parameter used in range iteration', () => {
      const code = `
        do processArray(arr) {
          let a = arr
          let len = a.length()
          let sum = 0
          for i in 0..len {
            sum = sum + a[i]
          }
          return sum
        }
        
        print(processArray([5, 10, 15, 20]))
      `;

      expect(expectBothToEqual(code)).toEqual(['50']);
    });

    it('should refine weak parameter in complex conditional', () => {
      const code = `
        do classify(num) {
          let n = num
          if n < 0 {
            return "negative"
          } else {
            if n > 0 {
              return "positive"
            } else {
              return "zero"
            }
          }
        }
        
        print(classify(-5))
        print(classify(0))
        print(classify(10))
      `;

      expect(expectBothToEqual(code)).toEqual(['negative', 'zero', 'positive']);
    });

    it('should refine weak parameter used in until loop', () => {
      const code = `
        do countDown(start) {
          let i = start
          let count = 0
          until i <= 0 {
            count = count + 1
            i = i - 1
          }
          return count
        }
        
        print(countDown(5))
      `;

      expect(expectBothToEqual(code)).toEqual(['5']);
    });

    it('should refine weak parameter with arithmetic operations', () => {
      const code = `
        do calculate(a, b, c) {
          let x = a
          let y = b
          let z = c
          return (x + y) * z
        }
        
        print(calculate(2, 3, 4))
      `;

      expect(expectBothToEqual(code)).toEqual(['20']);
    });

    it('should refine weak parameter passed to builtin methods', () => {
      const code = `
        do appendToArray(arr, value) {
          let a = arr
          let v = value
          a.push(v)
          return a.length()
        }
        
        let myArr: Array<int> = [1, 2, 3]
        print(appendToArray(myArr, 4))
      `;

      expect(expectBothToEqual(code)).toEqual(['4']);
    });

    it('should refine weak parameter in chained operations', () => {
      const code = `
        do doubleAndAdd(x, y) {
          let a = x
          let b = y
          let doubled = a * 2
          return doubled + b
        }
        
        print(doubleAndAdd(5, 3))
      `;

      expect(expectBothToEqual(code)).toEqual(['13']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle weak parameter assigned to multiple variables', () => {
      const code = `
        do duplicate(value) {
          let x = value
          let y = value
          let z = x
          return x + y + z
        }
        
        print(duplicate(10))
      `;

      expect(expectBothToEqual(code)).toEqual(['30']);
    });

    it('should throw error when the arguments between multiple calls are inconsistent', () => {
      const code = `
        do identity(x) {
          let val = x
          return val
        }
        
        print(identity(42))
        print(identity("test"))
      `;

      expectBothToThrow(code, /expected int, got string/);
    });

    it('should throw error when the arguments between multiple calls are inconsistent', () => {
      const code = `
        do identity(x) {
          let val = x
          return val
        }
        let a = ["a"]
        let b = [1, 2, 3]
        print(identity(a))
        print(identity(b))
      `;

      expectBothToThrow(code, /expected Array<string>, got Array<int>/);
    });

    it('should handle weak parameter with reassignment', () => {
      const code = `
        do increment(start) {
          let i = start
          i = i + 1
          i = i + 1
          return i
        }
        
        print(increment(5))
      `;

      expect(expectBothToEqual(code)).toEqual(['7']);
    });

    it('should refine weak parameter used in comparison chains', () => {
      const code = `
        do inRange(value, min, max) {
          let v = value
          let mn = min
          let mx = max
          return v >= mn && v <= mx
        }
        
        print(inRange(5, 1, 10))
        print(inRange(15, 1, 10))
      `;

      expect(expectBothToEqual(code)).toEqual(['true', 'false']);
    });
  });

  describe('Type Refinement with Invariants', () => {
    it('should check invariants with refined weak parameters', () => {
      const code = `
        do process(start) {
          let i = start
          while i > 0 {
            @invariant(i <= start, "i exceeded start")
            i = i - 1
          }
          return i
        }
        
        print(process(5))
      `;

      expect(expectBothToEqual(code)).toEqual(['0']);
    });

    it('should detect invariant violations with refined types', () => {
      const code = `
        do badProcess(start) {
          let i = start
          while i > 0 {
            @invariant(i > start, "should fail")
            i = i - 1
          }
          return i
        }
        
        badProcess(5)
      `;
      expectBothToThrow(code, /should fail/);
    });

    it('should check invariants in loops with array parameters', () => {
      const code = `
        do sumWithInvariant(arr) {
          let a = arr
          let sum = 0
          let count = 0
          for x in a {
            @invariant(sum >= 0, "sum went negative")
            sum = sum + x
            count = count + 1
          }
          return sum
        }
        
        print(sumWithInvariant([1, 2, 3, 4, 5]))
      `;

      expect(expectBothToEqual(code)).toEqual(['15']);
    });
  });
});
