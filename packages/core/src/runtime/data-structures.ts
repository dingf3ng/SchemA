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
        // Handle RuntimeValue objects
        const rv = item as any;
        if (rv.type === 'number' || rv.type === 'string' || rv.type === 'boolean') {
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
