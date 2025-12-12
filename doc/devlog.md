```haskell
data BinaryTree<T> {
    Leaf
  | TNode {
    T val
    BinaryTree<T> left
    BinaryTree<T> right
  }
} 

impl BinaryTree<T> {
  BinaryTree<T> init(T val) {
    return TNode<T>(val, Leaf, Leaf)
  }

  void insert
}
  
```
