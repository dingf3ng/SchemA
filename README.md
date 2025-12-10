# SchemA

A domain-specific language (DSL) designed for teaching data structures and algorithms.

## Overview

SchemA is a simple, focused programming language that removes unnecessary complexity and helps students concentrate on learning algorithms and data structures. It features:

- Clean, minimal syntax
- Built-in data structures (Array, Map, Set, Heap, Graph)
- Type system with inference
- No OOP complexity - just functions and data structures
- Perfect for implementing classic algorithms

## Language Features

### Built-in Data Structures

- **Array**: Dynamic arrays with push/pop operations
- **Map**: Key-value hash maps
- **Set**: Unique element collections
- **MinHeap/MaxHeap**: Priority queues for efficient algorithms
- **Graph**: Directed/undirected weighted graphs

### Syntax Examples

```schema
// Variables
let x = 10
let name = "Alice"

// Arrays
let arr = [1, 2, 3, 4, 5]
arr.push(6)

// Maps
let map = Map()
map.set("key", 100)
let value = map.get("key")

// Sets
let set = Set()
set.add(1)
set.add(2)

// Heaps
let minHeap = MinHeap()
minHeap.push(5)
minHeap.push(3)
let min = minHeap.pop()

// Graphs
let g = Graph(true)  // directed graph
g.addVertex(0)
g.addVertex(1)
g.addEdge(0, 1, 5)  // edge with weight 5

// Functions
fn dijkstra(graph, start, n) {
  let dist = Map()
  let visited = Set()
  // ... algorithm implementation
  return dist
}

// Control Flow
if condition {
  // then branch
} else {
  // else branch
}

while condition {
  // loop body
}

for item in collection {
  // iterate
}
```

## Project Structure

```
SchemA/
├── packages/
│   ├── core/           # Core language implementation
│   │   └── src/
│   │       ├── lexer.ts          # Tokenization
│   │       ├── parser.ts         # AST generation
│   │       ├── type-checker.ts   # Type system
│   │       ├── interpreter.ts    # Evaluation
│   │       └── runtime/
│   │           ├── data-structures.ts  # Built-in structures
│   │           └── values.ts          # Runtime values
│   └── web/            # Web playground (future)
└── examples/           # Example algorithms
    ├── dijkstra.schema
    ├── bellman-ford.schema
    ├── segment-tree.schema
    └── data-structures.schema
```

## Example Algorithms

The `examples/` directory contains implementations of classic algorithms:

### Dijkstra's Algorithm
Finds shortest paths in weighted graphs with non-negative edges.

### Bellman-Ford Algorithm
Finds shortest paths and detects negative cycles.

### Segment Tree
Efficient range query data structure.

## Installation

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

## Language Design Principles

1. **Simplicity**: Only features needed for DSA learning
2. **Clarity**: Syntax that reads like pseudocode
3. **Focus**: No distractions from the algorithms
4. **Practicality**: Can implement real algorithms (Dijkstra, Bellman-Ford, etc.)

## Type System

SchemA has a simple type system with the following types:

- `number` - numeric values
- `string` - text strings
- `boolean` - true/false values
- `Array<T>` - arrays of type T
- `Map<K, V>` - maps from K to V
- `Set<T>` - sets of type T
- `MinHeap<T>` / `MaxHeap<T>` - heaps
- `Graph<T>` - graphs with nodes of type T

Types are inferred automatically in most cases:

```schema
let x = 10              // inferred as number
let name = "Alice"      // inferred as string
let arr = [1, 2, 3]     // inferred as Array<number>
```

You can also add explicit type annotations:

```schema
fn add(x: number, y: number) -> number {
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

## Future Enhancements

- [ ] Interactive web playground
- [ ] Step-by-step debugger
- [ ] Visualization of data structures
- [ ] More built-in algorithms
- [ ] Performance profiling
- [ ] Standard library expansion

## License

ISC

## Contributing

This is an educational project. Contributions welcome!
