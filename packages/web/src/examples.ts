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
// ============================================================================
// Debugging Algorithms with @invariant, @assert, and |- (turnstile operator)
// ============================================================================
// This example demonstrates how SchemA's verification features help catch bugs

// ============================================================================
// Example 1: Binary Search - Catching Index Out of Bounds
// ============================================================================
// BUGGY VERSION: Incorrect loop invariant catches the bug
do binarySearchBuggy(arr, target) {
  @assert(arr |- @sorted, "Array must be sorted for binary search")

  let left = 0, right = arr.length() - 1  // BUG: should be arr.length()

  until left > right {
    // This invariant catches array access violations
    @invariant(left >= 0 && right < arr.length())

    let mid = (left + right) / 2
    let midVal = arr[mid]

    if midVal == target {
      return mid
    } else if midVal < target {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  return -1
}

// CORRECT VERSION: With proper invariants
do binarySearchCorrect(arr, target) {
  @assert(arr |- @sorted, "Array must be sorted")
  @assert(arr |- @non_empty, "Array must be non-empty")

  let left = 0, right = arr.length()

  until left >= right {
    // Invariant: search space is valid
    @invariant(left >= 0 && left <= arr.length())
    @invariant(right >= 0 && right <= arr.length())
    @invariant(left <= right)

    let mid = (left + right) / 2

    // Assert we won't go out of bounds
    @assert(mid >= 0 && mid < arr.length(), "Mid index must be valid")

    let midVal = arr[mid]

    if midVal == target {
      return mid
    } else if midVal < target {
      left = mid + 1
    } else {
      right = mid
    }
  }
  return -1
}


// ============================================================================
// Example 2: Insertion Sort - Debugging with Invariants
// ============================================================================
// BUGGY VERSION: Off-by-one error
do insertionSortBuggy(arr) {
  let i = 1
  while i <= arr.length() {  // BUG: should be < not <=
    // This invariant will catch when i goes out of bounds
    @invariant(i > 0 && i < arr.length())

    let key = arr[i]
    let j = i - 1

    while j >= 0 && arr[j] > key {
      arr[j + 1] = arr[j]
      j = j - 1
    }
    arr[j + 1] = key
    i = i + 1
  }
}

// CORRECT VERSION: With comprehensive invariants
do insertionSortCorrect(arr) {
  let i = 1
  while i < arr.length() {
    // Invariant: the subarray [0..i-1] is sorted
    @invariant(i > 0 && i <= arr.length())

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


// ============================================================================
// Example 3: Finding Maximum - Using Turnstile for Verification
// ============================================================================
do findMax(arr) {
  // Pre-condition checks using turnstile operator
  @assert(arr |- @non_empty, "Cannot find max of empty array")

  let max = arr[0]
  let i = 1

  while i < arr.length() {
    // Invariant: max is the maximum of arr[0..i-1]
    @invariant(i >= 1 && i <= arr.length())

    if arr[i] > max {
      max = arr[i]
    }
    i = i + 1
  }

  // Verify the result makes sense
  // max should be positive if all elements are positive
  let allPositive = true
  for x in arr {
    if !(x |- @positive) {
      allPositive = false
    }
  }

  if allPositive {
    @assert(max |- @positive, "Max should be positive if all elements are positive")
  }

  return max
}


// ============================================================================
// Example 4: Array Reversal - Catching Swap Logic Errors
// ============================================================================
// BUGGY VERSION: Swaps too many times
do reverseArrayBuggy(arr) {
  let left = 0
  let right = arr.length() - 1

  // BUG: should be left < right, not left <= right
  while left <= right {
    // This will fail when left == right (swapping element with itself is wasteful)
    @invariant(left < right)

    let temp = arr[left]
    arr[left] = arr[right]
    arr[right] = temp

    left = left + 1
    right = right - 1
  }
}

// CORRECT VERSION
do reverseArrayCorrect(arr) {
  let left = 0
  let right = arr.length() - 1

  while left < right {
    @invariant(left >= 0 && left < arr.length())
    @invariant(right >= 0 && right < arr.length())
    @invariant(left <= right)

    let temp = arr[left]
    arr[left] = arr[right]
    arr[right] = temp

    left = left + 1
    right = right - 1
  }
}


// ============================================================================
// Example 5: Partition (for QuickSort) - Complex Invariants
// ============================================================================
do partition(arr, low, high) {
  @assert(low >= 0 && low < arr.length(), "Low index must be valid")
  @assert(high >= 0 && high < arr.length(), "High index must be valid")
  @assert(low <= high, "Low must be <= high")

  let pivot = arr[high]
  let i = low - 1
  let j = low

  while j < high {
    // Invariant: all elements in [low..i] are <= pivot
    // Invariant: all elements in [i+1..j-1] are > pivot
    @invariant(i >= low - 1 && i < high)
    @invariant(j >= low && j <= high)

    if arr[j] <= pivot {
      i = i + 1

      @assert(i >= 0 && i < arr.length(), "i must be valid for swap")
      @assert(j >= 0 && j < arr.length(), "j must be valid for swap")

      let temp = arr[i]
      arr[i] = arr[j]
      arr[j] = temp
    }
    j = j + 1
  }

  // Place pivot in correct position
  i = i + 1
  @assert(i >= 0 && i < arr.length(), "Final i must be valid")
  @assert(high >= 0 && high < arr.length(), "High must be valid")

  let temp = arr[i]
  arr[i] = arr[high]
  arr[high] = temp

  return i
}


// ============================================================================
// Example 6: Removing Duplicates - Turnstile Verification
// ============================================================================
do removeDuplicates(arr) {
  @assert(arr |- @sorted, "Array must be sorted to remove duplicates efficiently")

  if arr.length() == 0 {
    return arr
  }

  let result: Array<int> = []
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
// Example 7: Two Sum Problem - Using Assertions for Logic Validation
// ============================================================================
do twoSum(arr, target) {
  @assert(arr |- @sorted, "Array must be sorted for two-pointer approach")

  let left = 0
  let right = arr.length() - 1

  while left < right {
    @invariant(left >= 0 && left < arr.length())
    @invariant(right >= 0 && right < arr.length())
    @invariant(left < right)

    let sum = arr[left] + arr[right]

    if sum == target {
      // Found the pair!
      @assert(arr[left] + arr[right] == target, "Sum must equal target")
      print("Found pair: ")
      print(arr[left])
      print(arr[right])
      return true
    } else if sum < target {
      left = left + 1
    } else {
      right = right - 1
    }
  }

  return false
}


// ============================================================================
// TESTING THE EXAMPLES
// ============================================================================

print("=== Example 1: Binary Search ===")
let sortedArr = [1, 3, 5, 7, 9, 11, 13, 15]
print("Searching for 7 in sorted array:")
print(binarySearchCorrect(sortedArr, 7))

print("")
print("=== Example 2: Insertion Sort ===")
let unsorted = [5, 2, 8, 1, 9, 3]
print("Before sort:")
print(unsorted)
insertionSortCorrect(unsorted)
print("After sort:")
print(unsorted)

print("")
print("=== Example 3: Find Maximum ===")
let numbers = [3, 7, 2, 9, 1, 5]
print("Finding max of:")
print(numbers)
print("Max is:")
print(findMax(numbers))

print("")
print("=== Example 4: Reverse Array ===")
let toReverse = [1, 2, 3, 4, 5]
print("Before reverse:")
print(toReverse)
reverseArrayCorrect(toReverse)
print("After reverse:")
print(toReverse)

print("")
print("=== Example 6: Remove Duplicates ===")
let withDups = [1, 1, 2, 2, 3, 4, 4, 5]
print("Array with duplicates:")
print(withDups)
let unique = removeDuplicates(withDups)
print("After removing duplicates:")
print(unique)

print("")
print("=== Example 7: Two Sum ===")
let twoSumArr = [1, 2, 3, 4, 5, 6, 7, 8, 9]
print("Finding two numbers that sum to 10:")
twoSum(twoSumArr, 10)
`
};
