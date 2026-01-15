# Schema - Towards Zero-Cost DS&A Experiment

> A domain-specific language (DSL) designed for teaching data structures and algorithms.

## Overview

SchemA is a simple, focused programming language that removes all unnecessary complexity and helps students concentrate on learning, experimenting and debugging algorithms and data structures. It features:

- Clean, minimal syntax
- Built-in data structures (Array, Map, Set, Heap, HeapMap, Graph, Tree)
- Gradual type system with full static inference - no annotation is needed
- No OOP/FP complexity - just algorithms and data structures
- Built-in debug toolbox - debugger is no longer a additional tool beyond language itself
- Dynamic refinement - automated invariant synthesis and checking

## Online Playground
Click [Here](https://dingf3ng.github.io/SchemA/) to play with SchemA now

## Language Features

### Built-in Data Structures

- **Array**: Dynamic arrays with push/pop operations
- **Map**: Key-value hash maps
- **Set**: Unique element collections
- **MinHeap/MaxHeap**: Priority queues for efficient algorithms
- **MinHeapMap/MaxHeapMap**: Priority queues with key-value pairs as elements.
- **Graph**: Directed/undirected weighted graphs
- **Binary Tree:** Standard binary tree
- **AVL Tree:** Self-balanced binary tree

### Syntax Example

```schema
// Dijkstra's shortest path algorithm

do dijkstra(graph, start) {
  let dist = Map(),
      visited = Set(),
      pq = MinHeapMap(),
      n = graph.size()
  
  for i in ..n {
    dist.set(i, int_inf)
  }
  dist.set(start, 0)
  pq.push(start, 0)

  until pq.size() == 0 {
    let current = pq.pop()
    if visited.has(current) {
      return dist
    }
    visited.add(current)
    let adjs = graph.getNeighbors(current)
    for adj in adjs {
      let neighbor = adj["to"],
          weight = adj["weight"]
      let newDist = dist.get(current) + weight
      if newDist < dist.get(neighbor) {
        dist.set(neighbor, newDist)
        pq.push(neighbor, newDist)
      }
    }
  }
  return dist
}

// Create a weighted graph
let g = Graph(true)

// Add vertices
g.addVertex(0)
...

// Add edges with weights
g.addEdge(0, 1, 2)
...

print("Running Dijkstra from node 0:")
let distances = dijkstra(g, 0)

for i in ..g.size() {
  print("Distance to node", i, ":", distances.get(i))
}
```

## Language Design Principles

1. **Focus**: Only features needed for DSA learning
2. **Clarity**: Syntax that reads like pseudocode, no explicit type annotations
3. **Debugging-As-Primitive**: Easy to debug with built-in tools 
4. **Completeness**: Can implement any algorithms covered in typical courses

## Type System

SchemA has a simple gradual type system with the following static types:

- `int` - integer values
- `float` - non-integer numurics
- `string` - text strings
- `boolean` - true/false values
- `void` - contains the only undefined value
- `Array<T>` - arrays of type T
- `Map<K, V>` - maps from K to V
- `Set<T>` - sets of type T
- `BinaryTree` - binary trees
- `AVLTree` - self-balanced trees
- `MinHeap<T>` / `MaxHeap<T>` - heaps
- `Graph<T>` - graphs with nodes of type T
- `tuple` - can be a sum of multiple types
- `record` - can be a tagged sum of multiple types

Beyond these schemA features a dynamic resolution for tuple and record access, as it is sometimes impossible to get the type statically. For example:

```schema
do proc(idx) {
  let tup = (1, false, "string")
  print(tup[idx])       // Cannot be determined statically
}
```

Annotating programs with types might be painful, but luckily, (almost, if statically) all types can be **automatically inferred** in SchemA:

```schema
let x = 10              // inferred as int
let name = "Alice"      // inferred as string
let arr = [1, 2, 3]     // inferred as Array<int>
```
For more complex ones,
```schema
let x = 10              // inferred as int
let name = "Alice"      // inferred as string
let arr = [1, 2, 3]     // inferred as Array<int>
```

You can also add explicit type annotations:

```schema
do add(x: int, y: int) -> int {
  return x + y
}
```

## Educational Use Cases

SchemA is ideal for:

- Teaching algorithm design and analysis
- Data structures courses
- Competitive programming practice
- Algorithm visualization tools
- Interview preparation
- **Anyone want play with algorithm but want no administrative overhead**

## Future Enhancements

- [ ] Visualization of data structures
- [ ] Better interactive programming experience

## License

ISC

## Local Installation

```bash
# Install dependencies
npm install

# Build the core package
cd packages/core
npm run build
```

## Usage

```bash
# Run a SchemA program
node packages/core/dist/cli.js examples/simple-test.schema

# Or from the core package directory
cd packages/core
node dist/cli.js ../../examples/simple-test.schema

# Run tests
npm test
```

## Quick Start

Try the examples:

```bash
# Simple test with all data structures
node packages/core/dist/cli.js examples/simple-test.schema

# MinHeap and MaxHeap
node packages/core/dist/cli.js examples/simple-heap.schema

# Data structures showcase
node packages/core/dist/cli.js examples/data-structures.schema

# Minimal example
node packages/core/dist/cli.js examples/minimal.schema
```

## Contributing

Any contribution is welcome!
