export * from './heap-map';

export class SchemaArray<T> {
  private data: T[] = [];

  constructor(initialData?: T[]) {
    if (initialData) {
      this.data = [...initialData];
    }
  }

  get length(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
  }

  pop(): T | undefined {
    return this.data.pop();
  }

  get(index: number): T | undefined {
    return this.data[index];
  }

  set(index: number, value: T): void {
    this.data[index] = value;
  }

  forEach(fn: (item: T, index: number) => void): void {
    this.data.forEach(fn);
  }

  map<U>(fn: (item: T) => U): SchemaArray<U> {
    return new SchemaArray(this.data.map(fn));
  }

  filter(fn: (item: T) => boolean): SchemaArray<T> {
    return new SchemaArray(this.data.filter(fn));
  }

  toArray(): T[] {
    return [...this.data];
  }

  toString(): string {
    const items = this.data.map(item => {
      if (typeof item === 'object' && item !== null && 'type' in item) {
        // Handle RuntimeValue objects - import runtimeValueToString if needed
        const rv = item as any;
        if (rv.type === 'tuple' || rv.type === 'record') {
          // For complex types, use their own toString or a simplified representation
          if (rv.type === 'tuple') {
            const elements = rv.elements.map((el: any) => {
              if (el.type === 'int' || el.type === 'float') return el.value;
              if (el.type === 'string') return el.value;
              if (el.type === 'boolean') return el.value;
              return el;
            });
            return `(${elements.join(', ')})`;
          }
          if (rv.type === 'record') {
            const entries = Array.from(rv.fields.entries()) as Array<[string, any]>;
            const fields = entries
              .map(([k, v]) => {
                let val = v;
                if (v.type === 'int' || v.type === 'float') val = v.value;
                else if (v.type === 'string') val = v.value;
                else if (v.type === 'boolean') val = v.value;
                return `${k}: ${val}`;
              })
              .join(', ');
            return `{ ${fields} }`;
          }
        }
        if (rv.type === 'int' || rv.type === 'float' || rv.type === 'string' || rv.type === 'boolean') {
          return rv.value;
        }
      }
      return item;
    });
    return `[${items.join(', ')}]`;
  }
}

export class SchemaMap<K, V> {
  private data: Map<K, V> = new Map();

  get size(): number {
    return this.data.size;
  }

  get(key: K): V | undefined {
    return this.data.get(key);
  }

  set(key: K, value: V): void {
    this.data.set(key, value);
  }

  has(key: K): boolean {
    return this.data.has(key);
  }

  delete(key: K): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  keys(): K[] {
    return Array.from(this.data.keys());
  }

  values(): V[] {
    return Array.from(this.data.values());
  }

  entries(): Array<[K, V]> {
    return Array.from(this.data.entries());
  }

  forEach(fn: (value: V, key: K) => void): void {
    this.data.forEach(fn);
  }

  toString(): string {
    const entries = this.entries()
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `{${entries}}`;
  }
}

export class SchemaSet<T> {
  private data: Set<T> = new Set();

  get size(): number {
    return this.data.size;
  }

  add(item: T): void {
    this.data.add(item);
  }

  has(item: T): boolean {
    return this.data.has(item);
  }

  delete(item: T): boolean {
    return this.data.delete(item);
  }

  clear(): void {
    this.data.clear();
  }

  forEach(fn: (item: T) => void): void {
    this.data.forEach(fn);
  }

  toArray(): T[] {
    return Array.from(this.data);
  }

  toString(): string {
    return `{${this.toArray().join(', ')}}`;
  }
}

export class MinHeap<T> {
  private data: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn?: (a: T, b: T) => number) {
    this.compareFn =
      compareFn ||
      ((a: any, b: any) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });
  }

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  private parent(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChild(i: number): number {
    return 2 * i + 1;
  }

  private rightChild(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    [this.data[i], this.data[j]] = [this.data[j], this.data[i]];
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = this.parent(index);
      if (this.compareFn(this.data[index], this.data[parentIndex]) < 0) {
        this.swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private heapifyDown(index: number): void {
    while (true) {
      let smallest = index;
      const left = this.leftChild(index);
      const right = this.rightChild(index);

      if (
        left < this.data.length &&
        this.compareFn(this.data[left], this.data[smallest]) < 0
      ) {
        smallest = left;
      }

      if (
        right < this.data.length &&
        this.compareFn(this.data[right], this.data[smallest]) < 0
      ) {
        smallest = right;
      }

      if (smallest !== index) {
        this.swap(index, smallest);
        index = smallest;
      } else {
        break;
      }
    }
  }

  push(item: T): void {
    this.data.push(item);
    this.heapifyUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    if (this.data.length === 1) return this.data.pop();

    const min = this.data[0];
    this.data[0] = this.data.pop()!;
    this.heapifyDown(0);
    return min;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  toString(): string {
    return `MinHeap[${this.data.join(', ')}]`;
  }
}

export class MaxHeap<T> {
  private data: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn?: (a: T, b: T) => number) {
    this.compareFn =
      compareFn ||
      ((a: any, b: any) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      });
  }

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  private parent(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChild(i: number): number {
    return 2 * i + 1;
  }

  private rightChild(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    [this.data[i], this.data[j]] = [this.data[j], this.data[i]];
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = this.parent(index);
      if (this.compareFn(this.data[index], this.data[parentIndex]) < 0) {
        this.swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private heapifyDown(index: number): void {
    while (true) {
      let largest = index;
      const left = this.leftChild(index);
      const right = this.rightChild(index);

      if (
        left < this.data.length &&
        this.compareFn(this.data[left], this.data[largest]) < 0
      ) {
        largest = left;
      }

      if (
        right < this.data.length &&
        this.compareFn(this.data[right], this.data[largest]) < 0
      ) {
        largest = right;
      }

      if (largest !== index) {
        this.swap(index, largest);
        index = largest;
      } else {
        break;
      }
    }
  }

  push(item: T): void {
    this.data.push(item);
    this.heapifyUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    if (this.data.length === 1) return this.data.pop();

    const max = this.data[0];
    this.data[0] = this.data.pop()!;
    this.heapifyDown(0);
    return max;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  toString(): string {
    return `MaxHeap[${this.data.join(', ')}]`;
  }
}

export interface Edge<T> {
  to: T;
  weight: number;
}

export class LazyRange {
  private start: number;
  private end: number | undefined;
  private inclusive: boolean;

  constructor(start: number, end: number | undefined, inclusive: boolean) {
    this.start = start;
    this.end = end;
    this.inclusive = inclusive;
  }

  get isInfinite(): boolean {
    return this.end === undefined;
  }

  // Generate values up to a limit (for iteration)
  *generate(): Generator<number> {
    if (this.end === undefined) {
      // Infinite range
      let current = this.start;
      while (true) {
        yield current;
        current++;
      }
    } else {
      // Finite range
      const endValue = this.inclusive ? this.end : this.end - 1;
      for (let i = this.start; i <= endValue; i++) {
        yield i;
      }
    }
  }

  // Convert to array (only for finite ranges)
  toArray(): number[] {
    if (this.isInfinite) {
      throw new Error('Cannot convert infinite range to array');
    }
    const result: number[] = [];
    for (const value of this.generate()) {
      result.push(value);
    }
    return result;
  }

  toString(): string {
    if (this.isInfinite) {
      return `Range(${this.start}..)`;
    }
    const op = this.inclusive ? '...' : '..';
    return `Range(${this.start}${op}${this.end})`;
  }
}

export class Graph<T> {
  private adjacencyList: Map<T, Edge<T>[]> = new Map();
  private directed: boolean;

  constructor(directed: boolean = false) {
    this.directed = directed;
  }

  addVertex(vertex: T): void {
    if (!this.adjacencyList.has(vertex)) {
      this.adjacencyList.set(vertex, []);
    }
  }

  addEdge(from: T, to: T, weight: number = 1): void {
    this.addVertex(from);
    this.addVertex(to);

    this.adjacencyList.get(from)!.push({ to, weight });

    if (!this.directed) {
      this.adjacencyList.get(to)!.push({ to: from, weight });
    }
  }

  getNeighbors(vertex: T): Edge<T>[] {
    return this.adjacencyList.get(vertex) || [];
  }

  hasVertex(vertex: T): boolean {
    return this.adjacencyList.has(vertex);
  }

  getVertices(): T[] {
    return Array.from(this.adjacencyList.keys());
  }

  getEdgeWeight(from: T, to: T): number | undefined {
    const neighbors = this.adjacencyList.get(from);
    if (!neighbors) return undefined;

    const edge = neighbors.find((e) => e.to === to);
    return edge?.weight;
  }

  isDirected(): boolean {
    return this.directed;
  }

  hasEdge(from: T, to: T): boolean {
    const neighbors = this.adjacencyList.get(from);
    if (!neighbors) return false;

    return neighbors.some((e) => e.to === to);
  }

  getEdges(): Array<{ from: T; to: T; weight: number }> {
    const edges: Array<{ from: T; to: T; weight: number }> = [];
    for (const [from, neighbors] of this.adjacencyList.entries()) {
      for (const edge of neighbors) {
        edges.push({ from, to: edge.to, weight: edge.weight });
      }
    }
    return edges;
  }

  toString(): string {
    let result = 'Graph:\n';
    for (const [vertex, edges] of this.adjacencyList.entries()) {
      const edgeStr = edges
        .map((e) => `${e.to}(${e.weight})`)
        .join(', ');
      result += `  ${vertex} -> [${edgeStr}]\n`;
    }
    return result;
  }
}

export class TreeNode<T> {
  value: T;
  left: TreeNode<T> | null = null;
  right: TreeNode<T> | null = null;
  height: number = 1;

  constructor(value: T) {
    this.value = value;
  }
}

export class BinaryTree<T> {
  root: TreeNode<T> | null = null;
  protected compareFn: (a: T, b: T) => number;

  constructor(compareFn?: (a: T, b: T) => number) {
    this.compareFn =
      compareFn ||
      ((a: any, b: any) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });
  }

  insert(value: T): void {
    this.root = this.insertNode(this.root, value);
  }

  protected insertNode(node: TreeNode<T> | null, value: T): TreeNode<T> {
    if (!node) {
      return new TreeNode(value);
    }

    if (this.compareFn(value, node.value) < 0) {
      node.left = this.insertNode(node.left, value);
    } else {
      node.right = this.insertNode(node.right, value);
    }
    return node;
  }

  search(value: T): boolean {
    return this.searchNode(this.root, value);
  }

  private searchNode(node: TreeNode<T> | null, value: T): boolean {
    if (!node) return false;
    const cmp = this.compareFn(value, node.value);
    if (cmp === 0) return true;
    if (cmp < 0) return this.searchNode(node.left, value);
    return this.searchNode(node.right, value);
  }

  getHeight(): number {
    return this.calculateHeight(this.root);
  }

  private calculateHeight(node: TreeNode<T> | null): number {
    if (!node) return 0;
    return 1 + Math.max(this.calculateHeight(node.left), this.calculateHeight(node.right));
  }

  preOrderTraversal(): T[] {
    const result: T[] = [];
    this.preOrder(this.root, result);
    return result;
  }

  // Iterative preOrder traversal using explicit stack (optimization)
  private preOrder(node: TreeNode<T> | null, result: T[]): void {
    if (!node) return;
    
    const stack: TreeNode<T>[] = [node];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current.value);
      
      // Push right first so left is processed first (LIFO)
      if (current.right) stack.push(current.right);
      if (current.left) stack.push(current.left);
    }
  }

  inOrderTraversal(): T[] {
    const result: T[] = [];
    this.inOrder(this.root, result);
    return result;
  }

  // Iterative inOrder traversal using explicit stack (optimization)
  private inOrder(node: TreeNode<T> | null, result: T[]): void {
    if (!node) return;
    
    const stack: TreeNode<T>[] = [];
    let current: TreeNode<T> | null = node;
    
    while (current !== null || stack.length > 0) {
      // Traverse to the leftmost node
      while (current !== null) {
        stack.push(current);
        current = current.left;
      }
      
      // Current is null here, pop from stack
      current = stack.pop()!;
      result.push(current.value);
      
      // Visit right subtree
      current = current.right;
    }
  }

  postOrderTraversal(): T[] {
    const result: T[] = [];
    this.postOrder(this.root, result);
    return result;
  }

  // Iterative postOrder traversal using two stacks (optimization)
  private postOrder(node: TreeNode<T> | null, result: T[]): void {
    if (!node) return;
    
    const stack1: TreeNode<T>[] = [node];
    const stack2: TreeNode<T>[] = [];
    
    // First pass: reverse postorder (root, right, left)
    while (stack1.length > 0) {
      const current = stack1.pop()!;
      stack2.push(current);
      
      // Push left first, then right (so right is processed first)
      if (current.left) stack1.push(current.left);
      if (current.right) stack1.push(current.right);
    }
    
    // Second pass: pop from stack2 to get correct postorder
    while (stack2.length > 0) {
      result.push(stack2.pop()!.value);
    }
  }


  toString(): string {
    return `BinaryTree[${this.inOrderTraversal().join(', ')}]`;
  }
}

export class AVLTree<T> extends BinaryTree<T> {

  insert(value: T): void {
    this.root = this.insertNode(this.root, value);
  }

  protected insertNode(node: TreeNode<T> | null, value: T): TreeNode<T> {
    if (!node) {
      return new TreeNode(value);
    }

    const cmp = this.compareFn(value, node.value);

    if (cmp < 0) {
      node.left = this.insertNode(node.left, value);
    } else if (cmp > 0) {
      node.right = this.insertNode(node.right, value);
    } else {
      return node;
    }

    node.height = 1 + Math.max(this.height(node.left), this.height(node.right));

    const balance = this.getBalance(node);

    // Left Left Case
    if (balance > 1 && this.compareFn(value, node.left!.value) < 0) {
      return this.rightRotate(node);
    }

    // Right Right Case
    if (balance < -1 && this.compareFn(value, node.right!.value) > 0) {
      return this.leftRotate(node);
    }

    // Left Right Case
    if (balance > 1 && this.compareFn(value, node.left!.value) > 0) {
      node.left = this.leftRotate(node.left!);
      return this.rightRotate(node);
    }

    // Right Left Case
    if (balance < -1 && this.compareFn(value, node.right!.value) < 0) {
      node.right = this.rightRotate(node.right!);
      return this.leftRotate(node);
    }

    return node;
  }

  private height(node: TreeNode<T> | null): number {
    return node ? node.height : 0;
  }

  private getBalance(node: TreeNode<T> | null): number {
    if (!node) return 0;
    return this.height(node.left) - this.height(node.right);
  }

  private rightRotate(y: TreeNode<T>): TreeNode<T> {
    const x = y.left!;
    const T2 = x.right;

    x.right = y;
    y.left = T2;

    y.height = Math.max(this.height(y.left), this.height(y.right)) + 1;
    x.height = Math.max(this.height(x.left), this.height(x.right)) + 1;

    return x;
  }

  private leftRotate(x: TreeNode<T>): TreeNode<T> {
    const y = x.right!;
    const T2 = y.left;

    y.left = x;
    x.right = T2;

    x.height = Math.max(this.height(x.left), this.height(x.right)) + 1;
    y.height = Math.max(this.height(y.left), this.height(y.right)) + 1;

    return y;
  }

  getHeight(): number {
    return this.height(this.root);
  }

  toString(): string {
    return `AVLTree[${this.inOrderTraversal().join(', ')}]`;
  }
}

export class TreeMap<K, V> {
  private avlTree: AVLTree<{ key: K; value: V }>;
  private compareFn: (a: K, b: K) => number;

  constructor(compareFn?: (a: K, b: K) => number) {
    this.compareFn =
      compareFn ||
      ((a: any, b: any) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });
    this.avlTree = new AVLTree<{ key: K; value: V }>((a, b) =>
      this.compareFn(a.key, b.key)
    );
  }

  set(key: K, value: V): void {
    this.avlTree.insert({ key, value });
  }

  // Note: This is a simple implementation and may not retrieve the latest value if duplicate keys are inserted.
  get(key: K): V | undefined {
    const nodes = this.avlTree.inOrderTraversal();
    for (const node of nodes) {
      if (this.compareFn(node.key, key) === 0) {
        return node.value;
      }
    }
    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  toString(): string {
    const entries = this.avlTree
      .inOrderTraversal()
      .map((kv) => `${kv.key}: ${kv.value}`)
      .join(', ');
    return `TreeMap{${entries}}`;
  }
}
