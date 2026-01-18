import { run } from '../src/index';

function expectOutput(code: string, expected: string[]) {
  const output = run(code);
  expect(output).toEqual(expected);
}

describe('Built-in Data Structure Methods', () => {
  describe('Array Methods', () => {
    describe('existing methods', () => {
      it('should support length()', () => {
        expectOutput(`
          let arr = [1, 2, 3]
          print(arr.length())
        `, ['3']);
      });

      it('should support push()', () => {
        expectOutput(`
          let arr = [1, 2]
          arr.push(3)
          print(arr)
        `, ['[1, 2, 3]']);
      });

      it('should support pop()', () => {
        expectOutput(`
          let arr = [1, 2, 3]
          let x = arr.pop()
          print(x)
          print(arr)
        `, ['3', '[1, 2]']);
      });
    });

    describe('new methods', () => {
      it('should support isEmpty()', () => {
        expectOutput(`
          let arr = [1, 2, 3]
          print(arr.isEmpty())
          let empty: Array<int> = []
          print(empty.isEmpty())
        `, ['false', 'true']);
      });

      it('should support append()', () => {
        expectOutput(`
          let arr1 = [1, 2]
          let arr2 = [3, 4]
          let result = arr1.append(arr2)
          print(result)
        `, ['[1, 2, 3, 4]']);
      });

      it('should support reverse()', () => {
        expectOutput(`
          let arr = [1, 2, 3, 4, 5]
          arr.reverse()
          print(arr)
        `, ['[5, 4, 3, 2, 1]']);
      });

      it('should support clear()', () => {
        expectOutput(`
          let arr = [1, 2, 3]
          arr.clear()
          print(arr.length())
          print(arr.isEmpty())
        `, ['0', 'true']);
      });
    });
  });

  describe('Map Methods', () => {
    describe('existing methods', () => {
      it('should support size()', () => {
        expectOutput(`
          let m = {"a": 1, "b": 2}
          print(m.size())
        `, ['2']);
      });

      it('should support get() and set()', () => {
        expectOutput(`
          let m = Map()
          m.set("key", 42)
          print(m.get("key"))
        `, ['42']);
      });

      it('should support has()', () => {
        expectOutput(`
          let m = {"a": 1}
          print(m.has("a"))
          print(m.has("b"))
        `, ['true', 'false']);
      });

      it('should support keys()', () => {
        expectOutput(`
          let m = {"a": 1, "b": 2}
          let k = m.keys()
          print(k.length())
        `, ['2']);
      });

      it('should support values()', () => {
        expectOutput(`
          let m = {"a": 1, "b": 2}
          let v = m.values()
          print(v.length())
        `, ['2']);
      });

      it('should support entries()', () => {
        expectOutput(`
          let m = {"a": 1}
          let e = m.entries()
          print(e.length())
        `, ['1']);
      });
    });

    describe('new methods', () => {
      it('should support delete()', () => {
        expectOutput(`
          let m = {"a": 1, "b": 2}
          let deleted = m.delete("a")
          print(deleted)
          print(m.has("a"))
          print(m.size())
        `, ['true', 'false', '1']);
      });

      it('should support clear()', () => {
        expectOutput(`
          let m = {"a": 1, "b": 2}
          m.clear()
          print(m.size())
          print(m.isEmpty())
        `, ['0', 'true']);
      });

      it('should support isEmpty()', () => {
        expectOutput(`
          let m = {"a": 1}
          print(m.isEmpty())
          m.delete("a")
          print(m.isEmpty())
        `, ['false', 'true']);
      });

      it('should support getOrDefault()', () => {
        expectOutput(`
          let m = {"a": 1}
          print(m.getOrDefault("a", 99))
          print(m.getOrDefault("b", 99))
        `, ['1', '99']);
      });
    });
  });

  describe('Set Methods', () => {
    describe('existing methods', () => {
      it('should support size()', () => {
        expectOutput(`
          let s = {1, 2, 3}
          print(s.size())
        `, ['3']);
      });

      it('should support add()', () => {
        expectOutput(`
          let s = {1, 2}
          s.add(3)
          print(s.has(3))
        `, ['true']);
      });

      it('should support has()', () => {
        expectOutput(`
          let s = {1, 2, 3}
          print(s.has(2))
          print(s.has(99))
        `, ['true', 'false']);
      });

      it('should support delete()', () => {
        expectOutput(`
          let s = {1, 2, 3}
          s.delete(2)
          print(s.has(2))
        `, ['false']);
      });
    });

    describe('new methods', () => {
      it('should support clear()', () => {
        expectOutput(`
          let s = {1, 2, 3}
          s.clear()
          print(s.size())
          print(s.isEmpty())
        `, ['0', 'true']);
      });

      it('should support isEmpty()', () => {
        expectOutput(`
          let s = {1}
          print(s.isEmpty())
          s.delete(1)
          print(s.isEmpty())
        `, ['false', 'true']);
      });

      it('should support toArray()', () => {
        expectOutput(`
          let s = {1, 2, 3}
          let arr = s.toArray()
          print(arr.length())
        `, ['3']);
      });

      it('should support union()', () => {
        expectOutput(`
          let s1 = {1, 2, 3}
          let s2 = {3, 4, 5}
          let result = s1.union(s2)
          print(result.size())
        `, ['5']);
      });

      it('should support intersection()', () => {
        expectOutput(`
          let s1 = {1, 2, 3}
          let s2 = {2, 3, 4}
          let result = s1.intersection(s2)
          print(result.size())
          print(result.has(2))
          print(result.has(1))
        `, ['2', 'true', 'false']);
      });

      it('should support difference()', () => {
        expectOutput(`
          let s1 = {1, 2, 3}
          let s2 = {2, 3, 4}
          let result = s1.difference(s2)
          print(result.size())
          print(result.has(1))
          print(result.has(2))
        `, ['1', 'true', 'false']);
      });

      it('should support values()', () => {
        expectOutput(`
          let s = {1, 2, 3}
          let v = s.values()
          print(v.length())
        `, ['3']);
      });
    });
  });

  describe('Heap Methods', () => {
    describe('existing methods', () => {
      it('should support push() and pop() for MinHeap', () => {
        expectOutput(`
          let h = MinHeap()
          h.push(3)
          h.push(1)
          h.push(2)
          print(h.pop())
          print(h.pop())
          print(h.pop())
        `, ['1', '2', '3']);
      });

      it('should support push() and pop() for MaxHeap', () => {
        expectOutput(`
          let h = MaxHeap()
          h.push(1)
          h.push(3)
          h.push(2)
          print(h.pop())
          print(h.pop())
          print(h.pop())
        `, ['3', '2', '1']);
      });

      it('should support peek()', () => {
        expectOutput(`
          let h = MinHeap()
          h.push(3)
          h.push(1)
          print(h.peek())
          print(h.size())
        `, ['1', '2']);
      });

      it('should support size()', () => {
        expectOutput(`
          let h = MinHeap()
          h.push(1)
          h.push(2)
          print(h.size())
        `, ['2']);
      });
    });

    describe('new methods', () => {
      it('should support isEmpty()', () => {
        expectOutput(`
          let h = MinHeap()
          print(h.isEmpty())
          h.push(1)
          print(h.isEmpty())
        `, ['true', 'false']);
      });

      it('should support clear()', () => {
        expectOutput(`
          let h = MinHeap()
          h.push(1)
          h.push(2)
          h.push(3)
          h.clear()
          print(h.size())
          print(h.isEmpty())
        `, ['0', 'true']);
      });

      it('should support toArray()', () => {
        expectOutput(`
          let h = MinHeap()
          h.push(3)
          h.push(1)
          h.push(2)
          let arr = h.toArray()
          print(arr)
        `, ['[1, 2, 3]']);
      });
    });
  });

  describe('HeapMap Methods', () => {
    describe('existing methods', () => {
      it('should support push() and pop()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("c", 3)
          hm.push("a", 1)
          hm.push("b", 2)
          print(hm.pop())
          print(hm.pop())
        `, ['a', 'b']);
      });

      it('should support peek()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("x", 10)
          hm.push("y", 5)
          print(hm.peek())
        `, ['y']);
      });

      it('should support size()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 1)
          hm.push("b", 2)
          print(hm.size())
        `, ['2']);
      });

      it('should support entries()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 1)
          let e = hm.entries()
          print(e.length())
        `, ['1']);
      });
    });

    describe('new methods', () => {
      it('should support isEmpty()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          print(hm.isEmpty())
          hm.push("a", 1)
          print(hm.isEmpty())
        `, ['true', 'false']);
      });

      it('should support has()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 1)
          print(hm.has("a"))
          print(hm.has("b"))
        `, ['true', 'false']);
      });

      it('should support getPriority()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 42)
          print(hm.getPriority("a"))
        `, ['42']);
      });

      it('should support updatePriority()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 10)
          hm.push("b", 5)
          print(hm.peek())
          hm.updatePriority("a", 1)
          print(hm.peek())
        `, ['b', 'a']);
      });

      it('should support delete()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 1)
          hm.push("b", 2)
          hm.delete("a")
          print(hm.size())
          print(hm.has("a"))
        `, ['1', 'false']);
      });

      it('should support clear()', () => {
        expectOutput(`
          let hm = MinHeapMap()
          hm.push("a", 1)
          hm.push("b", 2)
          hm.clear()
          print(hm.size())
          print(hm.isEmpty())
        `, ['0', 'true']);
      });
    });
  });

  describe('BinaryTree Methods', () => {
    describe('existing methods', () => {
      it('should support insert() and search()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          print(t.search(3))
          print(t.search(99))
        `, ['true', 'false']);
      });

      it('should support getHeight()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          print(t.getHeight())
        `, ['2']);
      });
    });

    describe('new methods', () => {
      it('should support delete()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          let deleted = t.delete(3)
          print(deleted)
          print(t.search(3))
        `, ['true', 'false']);
      });

      it('should support min()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          t.insert(1)
          print(t.min())
        `, ['1']);
      });

      it('should support max()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          t.insert(10)
          print(t.max())
        `, ['10']);
      });

      it('should support size()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          print(t.size())
        `, ['3']);
      });

      it('should support isEmpty()', () => {
        expectOutput(`
          let t = BinaryTree()
          print(t.isEmpty())
          t.insert(1)
          print(t.isEmpty())
        `, ['true', 'false']);
      });

      it('should support inorder()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          t.insert(1)
          t.insert(4)
          let arr = t.inorder()
          print(arr)
        `, ['[1, 3, 4, 5, 7]']);
      });

      it('should support preorder()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          let arr = t.preorder()
          print(arr)
        `, ['[5, 3, 7]']);
      });

      it('should support postorder()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          let arr = t.postorder()
          print(arr)
        `, ['[3, 7, 5]']);
      });

      it('should support clear()', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          t.clear()
          print(t.size())
          print(t.isEmpty())
        `, ['0', 'true']);
      });

      it('should support left() to get left subtree', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          t.insert(2)
          t.insert(4)
          let leftTree = t.left()
          print(leftTree.size())
          let leftArr = leftTree.inorder()
          print(leftArr)
        `, ['3', '[2, 3, 4]']);
      });

      it('should support right() to get right subtree', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          t.insert(6)
          t.insert(8)
          let rightTree = t.right()
          print(rightTree.size())
          let rightArr = rightTree.inorder()
          print(rightArr)
        `, ['3', '[6, 7, 8]']);
      });

      it('should support value() to get root value', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          t.insert(3)
          t.insert(7)
          print(t.value())
        `, ['5']);
      });

      it('should support left() on empty tree returning empty tree', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          let leftTree = t.left()
          print(leftTree.isEmpty())
        `, ['true']);
      });

      it('should support right() on empty tree returning empty tree', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(5)
          let rightTree = t.right()
          print(rightTree.isEmpty())
        `, ['true']);
      });

      it('should support chained left() and right() calls', () => {
        expectOutput(`
          let t = BinaryTree()
          t.insert(10)
          t.insert(5)
          t.insert(15)
          t.insert(3)
          t.insert(7)
          t.insert(12)
          t.insert(20)
          // Navigate to left subtree of left subtree
          let leftLeft = t.left().left()
          print(leftLeft.value())
          // Navigate to right subtree of right subtree
          let rightRight = t.right().right()
          print(rightRight.value())
        `, ['3', '20']);
      });
    });
  });

  describe('AVLTree Methods', () => {
    it('should support all BinaryTree methods', () => {
      expectOutput(`
        let t = AVLTree()
        t.insert(5)
        t.insert(3)
        t.insert(7)
        print(t.search(3))
        print(t.size())
        print(t.min())
        print(t.max())
      `, ['true', '3', '3', '7']);
    });

    it('should support inorder traversal', () => {
      expectOutput(`
        let t = AVLTree()
        t.insert(3)
        t.insert(1)
        t.insert(5)
        t.insert(2)
        t.insert(4)
        let arr = t.inorder()
        print(arr)
      `, ['[1, 2, 3, 4, 5]']);
    });

    it('should support left() to get left subtree', () => {
      expectOutput(`
        let t = AVLTree()
        t.insert(5)
        t.insert(3)
        t.insert(7)
        t.insert(2)
        t.insert(4)
        let leftTree = t.left()
        print(leftTree.isEmpty())
        let leftArr = leftTree.inorder()
        print(leftArr)
      `, ['false', '[2, 3, 4]']);
    });

    it('should support right() to get right subtree', () => {
      expectOutput(`
        let t = AVLTree()
        t.insert(5)
        t.insert(3)
        t.insert(7)
        t.insert(6)
        t.insert(8)
        let rightTree = t.right()
        print(rightTree.isEmpty())
        let rightArr = rightTree.inorder()
        print(rightArr)
      `, ['false', '[6, 7, 8]']);
    });

    it('should support value() to get root value', () => {
      expectOutput(`
        let t = AVLTree()
        t.insert(5)
        t.insert(3)
        t.insert(7)
        print(t.value())
      `, ['5']);
    });

    it('should support chained left() and right() calls', () => {
      expectOutput(`
        let t = AVLTree()
        t.insert(10)
        t.insert(5)
        t.insert(15)
        t.insert(3)
        t.insert(7)
        // Navigate down
        let leftChild = t.left()
        print(leftChild.value())
        let leftLeft = leftChild.left()
        print(leftLeft.value())
      `, ['5', '3']);
    });
  });

  describe('Graph Methods', () => {
    describe('existing methods', () => {
      it('should support addVertex() and hasVertex()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          print(g.hasVertex(1))
          print(g.hasVertex(99))
        `, ['true', 'false']);
      });

      it('should support addEdge() and hasEdge()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 10)
          print(g.hasEdge(1, 2))
          print(g.hasEdge(2, 1))
        `, ['true', 'true']);
      });

      it('should support getNeighbors()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          g.addEdge(1, 2, 5)
          g.addEdge(1, 3, 10)
          let neighbors = g.getNeighbors(1)
          print(neighbors.length())
        `, ['2']);
      });

      it('should support size()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          print(g.size())
        `, ['3']);
      });

      it('should support isDirected()', () => {
        expectOutput(`
          let g1 = Graph(true)
          let g2 = Graph(false)
          print(g1.isDirected())
          print(g2.isDirected())
        `, ['true', 'false']);
      });

      it('should support getEdges()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 10)
          let edges = g.getEdges()
          print(edges.length())
        `, ['1']);
      });

      it('should support getVertices()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          let vertices = g.getVertices()
          print(vertices.length())
        `, ['3']);
      });
    });

    describe('new methods', () => {
      it('should support removeVertex()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          g.addEdge(1, 2, 5)
          g.removeVertex(2)
          print(g.hasVertex(2))
          print(g.size())
          print(g.hasEdge(1, 2))
        `, ['false', '2', 'false']);
      });

      it('should support removeEdge()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 10)
          g.removeEdge(1, 2)
          print(g.hasEdge(1, 2))
        `, ['false']);
      });

      it('should support getEdgeWeight()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 42)
          print(g.getEdgeWeight(1, 2))
        `, ['42']);
      });

      it('should support setEdgeWeight()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 10)
          g.setEdgeWeight(1, 2, 99)
          print(g.getEdgeWeight(1, 2))
        `, ['99']);
      });

      it('should support degree() for undirected graph', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          g.addEdge(1, 2, 5)
          g.addEdge(1, 3, 10)
          print(g.degree(1))
        `, ['2']);
      });

      it('should support inDegree() for directed graph', () => {
        expectOutput(`
          let g = Graph(true)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          g.addEdge(1, 2, 5)
          g.addEdge(3, 2, 10)
          print(g.inDegree(2))
        `, ['2']);
      });

      it('should support outDegree() for directed graph', () => {
        expectOutput(`
          let g = Graph(true)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          g.addEdge(1, 2, 5)
          g.addEdge(1, 3, 10)
          print(g.outDegree(1))
        `, ['2']);
      });

      it('should support edgeCount()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addVertex(3)
          g.addEdge(1, 2, 5)
          g.addEdge(2, 3, 10)
          print(g.edgeCount())
        `, ['2']);
      });

      it('should support isEmpty()', () => {
        expectOutput(`
          let g = Graph(false)
          print(g.isEmpty())
          g.addVertex(1)
          print(g.isEmpty())
        `, ['true', 'false']);
      });

      it('should support clear()', () => {
        expectOutput(`
          let g = Graph(false)
          g.addVertex(1)
          g.addVertex(2)
          g.addEdge(1, 2, 10)
          g.clear()
          print(g.size())
          print(g.isEmpty())
          print(g.edgeCount())
        `, ['0', 'true', '0']);
      });
    });
  });
});
