export const examples = {
    'Hello World': `
// SchemA Quickstart Example
// A simple program demonstrating the language basics

print("=== Welcome to SchemA ===")
print("A DSL for Data Structures and Algorithms")

// Variables
let x = 42
let message = "Hello from SchemA!"
print(message)

// Functions
do fibonacci(n) {
  if n <= 1 {
    return n
  }
  return fibonacci(n - 1) + fibonacci(n - 2)
}

print("\\nFibonacci sequence:")
let i = 0
until i == 10 {
  print(fibonacci(i))
  i = i + 1
}

// Binary Search
do binarySearch(arr, target) {
  let left = -1, right = arr.length()

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

print("\\n=== Binary Search ===")
let sortedArr = [1, 3, 5, 7, 9, 11, 13, 15]
print("Array:")
print(sortedArr)
print("Searching for 7...")
let index = binarySearch(sortedArr, 7)
print("Found at index:")
print(index)

// Priority Queue (MinHeap) example
print("\\n=== Priority Queue (MinHeap) ===")
let pq = MinHeap()
pq.push(10)
pq.push(5)
pq.push(20)
pq.push(1)
pq.push(15)

print("Processing tasks by priority:")
while pq.size() > 0 {
  print(pq.pop())
}

print("\\n=== Set Operations ===")
let uniqueNumbers = Set()
let numbers = [1, 2, 3, 2, 1, 4, 3, 5]
for num in numbers {
  uniqueNumbers.add(num)
}
print("Original array:")
print(numbers)
print("Unique count:")
print(uniqueNumbers.size())

print("\\n=== Map (Dictionary) ===")
let grades = Map()
grades.set("Alice", 95)
grades.set("Bob", 87)
grades.set("Charlie", 92)

print("Alice's grade:")
print(grades.get("Alice"))
print("Total students:")
print(grades.size())

print("\\nSchemA language demo complete!")
`,

    'MinHeap & MaxHeap': `// Simple heap example

print("MinHeap example:")
let minHeap = MinHeap()

minHeap.push(5)
minHeap.push(3)
minHeap.push(7)
minHeap.push(1)
minHeap.push(9)

print("Heap size:")
print(minHeap.size())

print("Popping elements in sorted order:")
while minHeap.size() > 0 {
  print(minHeap.pop())
}

print("\\nMaxHeap example:")
let maxHeap = MaxHeap()

maxHeap.push(5)
maxHeap.push(3)
maxHeap.push(7)
maxHeap.push(1)
maxHeap.push(9)

print("Popping elements in reverse sorted order:")
while maxHeap.size() > 0 {
  print(maxHeap.pop())
}`,

    'Data Structures': `// Data structures demo
let myMap = Map()
myMap["name"] = "Alice"
myMap["age"] = 30
myMap["city"] = "New York"

print("Map contents:")
print(myMap["name"])
print(myMap["age"])
print(myMap["city"])

print("\\nArray operations:")
let numbers = [10, 20, 30, 40, 50]
print(numbers)
print("First element:")
print(numbers[0])
print("Last element:")
print(numbers[4])

print("\\nArray modification:")
numbers[2] = 99
print(numbers)`,
    'Dijkstra\'s Algorithm': `
// Dijkstra's shortest path algorithm

do dijkstra(graph, start) -> Map<int, int> {
  let dist = Map(),
      visited = Set(),
      pq = MinHeapMap(),
      n = graph.size()
  
  for i in ..n {
    dist.set(i, inf)
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
g.addVertex(1)
g.addVertex(2)
g.addVertex(3)
g.addVertex(4)
g.addVertex(5)
g.addVertex(6)

// Add edges with weights
g.addEdge(0, 1, 2)
g.addEdge(0, 3, 5)
g.addEdge(0, 5, 3)
g.addEdge(1, 2, 7)
g.addEdge(1, 4, 1)
g.addEdge(1, 5, 4)
g.addEdge(2, 4, 3)
g.addEdge(2, 6, 4)
g.addEdge(3, 4, 1)
g.addEdge(3, 6, 1)
g.addEdge(4, 6, 3)


print("Running Dijkstra from node 0:")
let distances = dijkstra(g, 0)

for i in ..g.size() {
  print("Distance to node", i, ":", distances.get(i))
}
`,
    'Bellman-Ford Algorithm': `
// Bellman-Ford algorithm for shortest paths (handles negative weights)

do bellmanFord(graph, start) {
  let dist = Map(),
      edges = graph.getEdges(),
      n = graph.size()
  for i in ..n {
    dist.set(i, inf)
  }

  dist.set(start, 0)

  // Relax edges n-1 times
  for _  in ..n {
    for edge in edges {
      let u = edge["from"],
          v = edge["to"],
          w = edge["weight"]

      if dist.get(u) != inf {
        let newDist = dist.get(u) + w
        if newDist < dist.get(v) {
          dist.set(v, newDist)
        }
      }
    }
  }

  // Check for negative cycles
  for edge in edges {
    let u = edge["from"],
        v = edge["to"],
        w = edge["weight"]
    if dist.get(u) != inf {
      let newDist = dist.get(u) + w
      if newDist < dist.get(v) {
        print("Negative cycle detected!")
        return dist
      }
    }
  }

  return dist
}

// Create a weighted graph
let g = Graph(true)

// Add vertices
g.addVertex(0)
g.addVertex(1)
g.addVertex(2)
g.addVertex(3)
g.addVertex(4)
g.addVertex(5)
g.addVertex(6)

// Add edges with weights
g.addEdge(0, 1, 2)
g.addEdge(0, 3, 5)
g.addEdge(0, 5, 3)
g.addEdge(1, 2, 7)
g.addEdge(1, 4, 1)
g.addEdge(1, 5, 4)
g.addEdge(2, 4, 3)
g.addEdge(2, 6, 4)
g.addEdge(3, 4, 1)
g.addEdge(3, 6, 1)
g.addEdge(4, 6, 3)

print("Running Bellman-Ford from node 0:")
let distances = bellmanFord(g, 0)

for i in ..g.size() {
  print("Distance to node", i, ":", distances.get(i))
}
`,
    'Meta Debugging':
        `
do insertionSortCorrect(arr) {
  let i = 1
  while i < arr.length() {
    // Invariant: the subarray [0..i-1] is sorted
    @invariant(i > 0 && i <= arr.length())
    @invariant(arr[0..i] |- @sorted)

    let key = arr[i]
    let j = i - 1

    // Find the correct position for key
    while j >= 0 && arr[j] > key {
      @invariant(j >= -1 && j < arr.length())
      @invariant(j + 1 >= 0 && j + 1 < arr.length())

      arr[j + 1] = arr[j]
      j = j - 1
    }
    arr[j + 1] = key
    i = i + 1
  }

  // Post-condition: array is sorted
  @assert(arr |- @sorted, "Array must be sorted after insertion sort")
}

do removeDuplicates(arr) {
  @assert(arr |- @sorted, "Array must be sorted to remove duplicates efficiently")

  if arr.length() == 0 {
    return arr
  }
  let result = []
  print(typeof(result))
  result.push(arr[0])

  let i = 1
  while i < arr.length() {
    @invariant(result |- @non_empty)
    @invariant(result |- @unique)
    @invariant(i > 0 && i <= arr.length())

    // Only add if different from last element in result
    let lastIdx = result.length() - 1
    if arr[i] != result[lastIdx] {
      result.push(arr[i])
    }
    i = i + 1
  }

  // Post-conditions
  @assert(result |- @unique, "Result must have unique elements")
  @assert(result |- @sorted, "Result must maintain sorted order")
  @assert(result |- @non_empty, "Result should not be empty if input wasn't")

  return result
}

// ============================================================================
// TESTING THE EXAMPLES
// ============================================================================

print("=== Example 2: Insertion Sort ===")
let unsorted = [5, 2, 8, 1, 9, 3]
print("Before sort:")
print(unsorted)
insertionSortCorrect(unsorted)
print("After sort:")
print(unsorted)

print("")
print("=== Example 6: Remove Duplicates ===")
let withDups = [1, 1, 2, 2, 3, 4, 4, 5]
print("Array with duplicates:")
print(withDups)
let unique = removeDuplicates(withDups)
print("After removing duplicates:")
print(unique)

`
};
