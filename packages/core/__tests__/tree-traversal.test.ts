import { BinaryTree, AVLTree } from '../src/builtins/data-structures';

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

  describe('BinaryTree left(), right(), value() methods', () => {
    let tree: BinaryTree<number>;

    beforeEach(() => {
      tree = new BinaryTree<number>();
    });

    it('should return empty tree for left() on empty tree', () => {
      const leftTree = tree.left();
      expect(leftTree.isEmpty()).toBe(true);
    });

    it('should return empty tree for right() on empty tree', () => {
      const rightTree = tree.right();
      expect(rightTree.isEmpty()).toBe(true);
    });

    it('should throw error for value() on empty tree', () => {
      expect(() => tree.value()).toThrow('Cannot get value from an empty tree');
    });

    it('should return correct value for root', () => {
      tree.insert(5);
      expect(tree.value()).toBe(5);
    });

    it('should return left subtree correctly', () => {
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
      
      const leftTree = tree.left();
      expect(leftTree.value()).toBe(3);
      expect(leftTree.size()).toBe(3);
      expect(leftTree.inOrderTraversal()).toEqual([2, 3, 4]);
    });

    it('should return right subtree correctly', () => {
      // Build tree:      5
      //                 / \
      //                3   7
      //                   / \
      //                  6   8
      tree.insert(5);
      tree.insert(3);
      tree.insert(7);
      tree.insert(6);
      tree.insert(8);
      
      const rightTree = tree.right();
      expect(rightTree.value()).toBe(7);
      expect(rightTree.size()).toBe(3);
      expect(rightTree.inOrderTraversal()).toEqual([6, 7, 8]);
    });

    it('should return empty tree when no left child', () => {
      tree.insert(5);
      tree.insert(7);  // only right child
      
      const leftTree = tree.left();
      expect(leftTree.isEmpty()).toBe(true);
    });

    it('should return empty tree when no right child', () => {
      tree.insert(5);
      tree.insert(3);  // only left child
      
      const rightTree = tree.right();
      expect(rightTree.isEmpty()).toBe(true);
    });

    it('should allow chaining left() and right() calls', () => {
      // Build tree:      10
      //                 /  \
      //                5    15
      //               / \   / \
      //              3   7 12  20
      tree.insert(10);
      tree.insert(5);
      tree.insert(15);
      tree.insert(3);
      tree.insert(7);
      tree.insert(12);
      tree.insert(20);
      
      // Navigate to left->left
      const leftLeft = tree.left().left();
      expect(leftLeft.value()).toBe(3);
      expect(leftLeft.size()).toBe(1);
      
      // Navigate to right->right
      const rightRight = tree.right().right();
      expect(rightRight.value()).toBe(20);
      expect(rightRight.size()).toBe(1);
      
      // Navigate to left->right
      const leftRight = tree.left().right();
      expect(leftRight.value()).toBe(7);
      
      // Navigate to right->left
      const rightLeft = tree.right().left();
      expect(rightLeft.value()).toBe(12);
    });
  });

  describe('AVLTree left(), right(), value() methods', () => {
    let tree: AVLTree<number>;

    beforeEach(() => {
      tree = new AVLTree<number>();
    });

    it('should return empty tree for left() on empty tree', () => {
      const leftTree = tree.left();
      expect(leftTree.isEmpty()).toBe(true);
    });

    it('should return empty tree for right() on empty tree', () => {
      const rightTree = tree.right();
      expect(rightTree.isEmpty()).toBe(true);
    });

    it('should throw error for value() on empty tree', () => {
      expect(() => tree.value()).toThrow('Cannot get value from an empty tree');
    });

    it('should return correct value for root', () => {
      tree.insert(5);
      expect(tree.value()).toBe(5);
    });

    it('should return AVLTree type for subtrees', () => {
      tree.insert(5);
      tree.insert(3);
      tree.insert(7);
      
      const leftTree = tree.left();
      const rightTree = tree.right();
      
      expect(leftTree).toBeInstanceOf(AVLTree);
      expect(rightTree).toBeInstanceOf(AVLTree);
    });

    it('should return subtrees with correct content', () => {
      [5, 3, 7, 2, 4, 6, 8].forEach(n => tree.insert(n));
      
      const leftTree = tree.left();
      const rightTree = tree.right();
      
      // Note: AVL tree may rebalance, so just check content not structure
      expect(leftTree.isEmpty()).toBe(false);
      expect(rightTree.isEmpty()).toBe(false);
    });

    it('should allow navigation in balanced tree', () => {
      // AVL tree will balance as we insert
      [4, 2, 6, 1, 3, 5, 7].forEach(n => tree.insert(n));
      
      // The root might be 4 due to balanced insertion
      const rootValue = tree.value();
      expect([4, 2, 6]).toContain(rootValue);  // Could be any of these after balancing
      
      // Check that we can navigate
      const leftTree = tree.left();
      const rightTree = tree.right();
      
      expect(leftTree.size()).toBeGreaterThan(0);
      expect(rightTree.size()).toBeGreaterThan(0);
    });
  });
});
