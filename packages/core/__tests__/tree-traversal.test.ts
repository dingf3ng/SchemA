import { BinaryTree, AVLTree } from '../src/runtime/data-structures';

describe('Tree Traversal Tests', () => {
  describe('BinaryTree Traversals', () => {
    let tree: BinaryTree<number>;

    beforeEach(() => {
      tree = new BinaryTree<number>();
    });

    it('should correctly perform preOrder traversal on empty tree', () => {
      expect(tree.preOrderTraversal()).toEqual([]);
    });

    it('should correctly perform inOrder traversal on empty tree', () => {
      expect(tree.inOrderTraversal()).toEqual([]);
    });

    it('should correctly perform postOrder traversal on empty tree', () => {
      expect(tree.postOrderTraversal()).toEqual([]);
    });

    it('should correctly perform preOrder traversal on single node', () => {
      tree.insert(5);
      expect(tree.preOrderTraversal()).toEqual([5]);
    });

    it('should correctly perform inOrder traversal on single node', () => {
      tree.insert(5);
      expect(tree.inOrderTraversal()).toEqual([5]);
    });

    it('should correctly perform postOrder traversal on single node', () => {
      tree.insert(5);
      expect(tree.postOrderTraversal()).toEqual([5]);
    });

    it('should correctly perform preOrder traversal', () => {
      // Build tree:      5
      //                 / \
      //                3   7
      //               / \
      //              2   4
      tree.insert(5);
      tree.insert(3);
      tree.insert(7);
      tree.insert(2);
      tree.insert(4);
      
      // PreOrder: Root -> Left -> Right
      expect(tree.preOrderTraversal()).toEqual([5, 3, 2, 4, 7]);
    });

    it('should correctly perform inOrder traversal', () => {
      tree.insert(5);
      tree.insert(3);
      tree.insert(7);
      tree.insert(2);
      tree.insert(4);
      
      // InOrder: Left -> Root -> Right (sorted order for BST)
      expect(tree.inOrderTraversal()).toEqual([2, 3, 4, 5, 7]);
    });

    it('should correctly perform postOrder traversal', () => {
      tree.insert(5);
      tree.insert(3);
      tree.insert(7);
      tree.insert(2);
      tree.insert(4);
      
      // PostOrder: Left -> Right -> Root
      expect(tree.postOrderTraversal()).toEqual([2, 4, 3, 7, 5]);
    });

    it('should handle large tree without stack overflow', () => {
      // Insert 1000 elements in a balanced way
      const elements = Array.from({ length: 1000 }, (_, i) => i);
      // Shuffle to create a more balanced tree
      for (let i = elements.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [elements[i], elements[j]] = [elements[j], elements[i]];
      }
      
      elements.forEach(e => tree.insert(e));
      
      expect(() => tree.preOrderTraversal()).not.toThrow();
      expect(() => tree.inOrderTraversal()).not.toThrow();
      expect(() => tree.postOrderTraversal()).not.toThrow();
      
      // InOrder should give sorted result
      const inOrder = tree.inOrderTraversal();
      expect(inOrder.length).toBe(1000);
      expect(inOrder).toEqual(Array.from({ length: 1000 }, (_, i) => i));
    });

    it('should handle skewed tree (worst case)', () => {
      // Build a completely skewed tree (linked list)
      for (let i = 1; i <= 100; i++) {
        tree.insert(i);
      }
      
      expect(() => tree.preOrderTraversal()).not.toThrow();
      expect(() => tree.inOrderTraversal()).not.toThrow();
      expect(() => tree.postOrderTraversal()).not.toThrow();
      
      const expected = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(tree.inOrderTraversal()).toEqual(expected);
    });
  });

  describe('AVLTree Traversals', () => {
    let tree: AVLTree<number>;

    beforeEach(() => {
      tree = new AVLTree<number>();
    });

    it('should correctly perform preOrder traversal', () => {
      [5, 3, 7, 2, 4, 6, 8].forEach(n => tree.insert(n));
      
      const preOrder = tree.preOrderTraversal();
      expect(preOrder.length).toBe(7);
      expect(preOrder).toContain(2);
      expect(preOrder).toContain(3);
      expect(preOrder).toContain(4);
      expect(preOrder).toContain(5);
      expect(preOrder).toContain(6);
      expect(preOrder).toContain(7);
      expect(preOrder).toContain(8);
    });

    it('should correctly perform inOrder traversal', () => {
      [5, 3, 7, 2, 4, 6, 8].forEach(n => tree.insert(n));
      
      // InOrder should give sorted result
      expect(tree.inOrderTraversal()).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('should correctly perform postOrder traversal', () => {
      [5, 3, 7, 2, 4, 6, 8].forEach(n => tree.insert(n));
      
      const postOrder = tree.postOrderTraversal();
      expect(postOrder.length).toBe(7);
      // Just verify all elements are present
      expect(postOrder).toContain(2);
      expect(postOrder).toContain(3);
      expect(postOrder).toContain(4);
      expect(postOrder).toContain(5);
      expect(postOrder).toContain(6);
      expect(postOrder).toContain(7);
      expect(postOrder).toContain(8);
    });

    it('should handle large AVL tree without stack overflow', () => {
      // Insert 1000 sequential elements (AVL will keep it balanced)
      for (let i = 0; i < 1000; i++) {
        tree.insert(i);
      }
      
      expect(() => tree.preOrderTraversal()).not.toThrow();
      expect(() => tree.inOrderTraversal()).not.toThrow();
      expect(() => tree.postOrderTraversal()).not.toThrow();
      
      // InOrder should give sorted result
      const inOrder = tree.inOrderTraversal();
      expect(inOrder.length).toBe(1000);
      expect(inOrder).toEqual(Array.from({ length: 1000 }, (_, i) => i));
    });
  });

  describe('Custom compareFn', () => {
    it('should work with custom comparison function', () => {
      // Reverse order comparison
      const tree = new BinaryTree<number>((a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      });

      [5, 3, 7, 2, 4].forEach(n => tree.insert(n));

      // With reverse comparison, inOrder should be descending
      expect(tree.inOrderTraversal()).toEqual([7, 5, 4, 3, 2]);
      
      const preOrder = tree.preOrderTraversal();
      expect(preOrder.length).toBe(5);
      
      const postOrder = tree.postOrderTraversal();
      expect(postOrder.length).toBe(5);
    });
  });
});
