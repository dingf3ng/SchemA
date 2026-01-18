# Built-in Data Structures Reference

This document describes the built-in data structures available in SchemA and their methods.

## Array\<T>

A dynamic array/list that holds elements of type `T`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `length` | `() -> int` | Returns the number of elements |
| `push` | `(T) -> void` | Appends an element to the end |
| `pop` | `() -> T` | Removes and returns the last element |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `isEmpty` | `() -> boolean` | Check if array is empty |
| `append` | `(Array<T>) -> Array<T>` | Concatenate two arrays |
| `reverse` | `() -> void` | Reverse array in place |
| `clear` | `() -> void` | Remove all elements |

---

## Map\<K, V>

A hash map/dictionary mapping keys of type `K` to values of type `V`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `size` | `() -> int` | Returns the number of key-value pairs |
| `get` | `(K) -> V` | Returns the value for a key |
| `set` | `(K, V) -> void` | Sets a key-value pair |
| `has` | `(K) -> boolean` | Checks if a key exists |
| `keys` | `() -> Array<K>` | Returns all keys as an array |
| `values` | `() -> Array<V>` | Returns all values as an array |
| `entries` | `() -> Array<(K, V)>` | Returns all key-value pairs as tuples |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `delete` | `(K) -> boolean` | Remove a key-value pair, return true if existed |
| `clear` | `() -> void` | Remove all entries |
| `isEmpty` | `() -> boolean` | Check if map is empty |
| `getOrDefault` | `(K, V) -> V` | Get value or return default if key missing |

---

## Set\<T>

A hash set containing unique elements of type `T`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `size` | `() -> int` | Returns the number of elements |
| `add` | `(T) -> void` | Adds an element to the set |
| `has` | `(T) -> boolean` | Checks if an element exists |
| `delete` | `(T) -> void` | Removes an element from the set |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `clear` | `() -> void` | Remove all elements |
| `isEmpty` | `() -> boolean` | Check if set is empty |
| `toArray` | `() -> Array<T>` | Convert set to array |
| `union` | `(Set<T>) -> Set<T>` | Return union of two sets |
| `intersection` | `(Set<T>) -> Set<T>` | Return intersection of two sets |
| `difference` | `(Set<T>) -> Set<T>` | Return elements in this but not other |

---

## Heap\<T>

A min-heap (priority queue) containing elements of type `T`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `push` | `(T) -> void` | Adds an element to the heap |
| `pop` | `() -> T` | Removes and returns the minimum element |
| `peek` | `() -> T` | Returns the minimum element without removing |
| `size` | `() -> int` | Returns the number of elements |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `isEmpty` | `() -> boolean` | Check if heap is empty |
| `clear` | `() -> void` | Remove all elements |
| `toArray` | `() -> Array<T>` | Convert heap to sorted array |

---

## HeapMap<K, V>

A priority queue where elements are keyed by `K` and prioritized by `V`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `push` | `(K, V) -> void` | Adds a key with priority value |
| `pop` | `() -> K` | Removes and returns the key with minimum priority |
| `peek` | `() -> K` | Returns the key with minimum priority without removing |
| `size` | `() -> int` | Returns the number of elements |
| `entries` | `() -> Array<(K, V)>` | Returns all key-value pairs as tuples |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `isEmpty` | `() -> boolean` | Check if heapmap is empty |
| `has` | `(K) -> boolean` | Check if key exists |
| `getPriority` | `(K) -> V` | Get priority value for a key |
| `updatePriority` | `(K, V) -> void` | Update priority for existing key |
| `delete` | `(K) -> void` | Remove a specific key |
| `clear` | `() -> void` | Remove all elements |

---

## BinaryTree\<T> & AVLTree\<T>

A binary search tree containing elements of type `T`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `insert` | `(T) -> void` | Inserts an element |
| `search` | `(T) -> boolean` | Checks if an element exists |
| `getHeight` | `() -> int` | Returns the height of the tree |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `delete` | `(T) -> boolean` | Remove an element, return true if found |
| `min` | `() -> T` | Get minimum element |
| `max` | `() -> T` | Get maximum element |
| `size` | `() -> int` | Get number of nodes |
| `isEmpty` | `() -> boolean` | Check if tree is empty |
| `inorder` | `() -> Array<T>` | Return elements in sorted order |
| `preorder` | `() -> Array<T>` | Return elements in preorder |
| `postorder` | `() -> Array<T>` | Return elements in postorder |
| `clear` | `() -> void` | Remove all elements |
| `left` | `() -> BinaryTree<T>` | Get the left subtree |
| `right` | `() -> BinaryTree<T>` | Get the right subtree |
| `value` | `() -> T` | Get the value at the root node |

---

## Graph<N>

A weighted graph with nodes of type `N`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `addVertex` | `(N) -> void` | Adds a vertex to the graph |
| `addEdge` | `(N, N, int) -> void` | Adds a weighted edge between two vertices |
| `getNeighbors` | `(N) -> Array<{to: N, weight: int}>` | Returns neighbors of a vertex with edge weights |
| `hasVertex` | `(N) -> boolean` | Checks if a vertex exists |
| `hasEdge` | `(N, N) -> boolean` | Checks if an edge exists between two vertices |
| `size` | `() -> int` | Returns the number of vertices |
| `isDirected` | `() -> boolean` | Returns whether the graph is directed |
| `getEdges` | `() -> Array<{from: N, to: N, weight: int}>` | Returns all edges |
| `getVertices` | `() -> Array<N>` | Returns all vertices |

### Suggested Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `removeVertex` | `(N) -> void` | Remove a vertex and all its edges (in and out) |
| `removeEdge` | `(N, N) -> void` | Remove an edge between two vertices |
| `getEdgeWeight` | `(N, N) -> int` | Get weight of edge between vertices |
| `setEdgeWeight` | `(N, N, int) -> void` | Update weight of existing edge |
| `degree` | `(N) -> int` | Get degree of a vertex |
| `inDegree` | `(N) -> int` | Get in-degree (directed graphs) |
| `outDegree` | `(N) -> int` | Get out-degree (directed graphs) |
| `edgeCount` | `() -> int` | Get total number of edges |
| `isEmpty` | `() -> boolean` | Check if graph has no vertices |
| `clear` | `() -> void` | Remove all vertices and edges |

---

## Iteration Support

The `for...in` loop supports iteration over the following types:

| Type | Iteration Variable Type | Description |
|------|------------------------|-------------|
| `Array<T>` | `T` | Iterates over elements |
| `Set<T>` | `T` | Iterates over elements |
| `Map<K, V>` | `K` | Iterates over keys |
| `range` | `int` | Iterates over (possibly infinite) integers |

### Examples

```
// Array iteration
let arr = [1, 2, 3]
for elem in arr {
    // elem is int
}

// Set iteration
let s = {1, 2, 3}
for elem in s {
    // elem is int
}

// Map iteration (iterates over keys)
let m = Map()
m.set("a", 1)
m.set("b", 2)
for key in m {
    let value = m.get(key)
    // key is string, value is int
}

// Range iteration
for i in 0..10 {
    // i is int, from 0 to 9
}

for i in 0...10 {
    // i is int, from 0 to 10 (inclusive)
}
```

### Discard Variable

Use `_` to discard the loop variable when you only need to iterate a certain number of times:

```
for _ in 0..5 {
    // execute 5 times, variable not bound
}
```

---

## Type Signatures Summary

| Type | Declaration |
|------|-------------|
| Array | `Array<T>` |
| Map | `Map<K, V>` |
| Set | `Set<T>` |
| Heap | `Heap<T>` |
| HeapMap | `HeapMap<K, V>` |
| BinaryTree | `BinaryTree<T>` |
| Graph | `Graph<N>` |
