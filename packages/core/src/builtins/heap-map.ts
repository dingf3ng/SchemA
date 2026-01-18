export class HeapMap<K, V> {
  private data: { key: K; value: V }[] = [];
  private compareFn: (a: V, b: V) => number;

  constructor(compareFn: (a: V, b: V) => number) {
    this.compareFn = compareFn;
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
      if (this.compareFn(this.data[index].value, this.data[parentIndex].value) < 0) {
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
        this.compareFn(this.data[left].value, this.data[smallest].value) < 0
      ) {
        smallest = left;
      }

      if (
        right < this.data.length &&
        this.compareFn(this.data[right].value, this.data[smallest].value) < 0
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

  push(key: K, value: V): void {
    this.data.push({ key, value });
    this.heapifyUp(this.data.length - 1);
  }

  pop(): K | undefined {
    if (this.data.length === 0) return undefined;
    if (this.data.length === 1) return this.data.pop()?.key;

    const top = this.data[0];
    this.data[0] = this.data.pop()!;
    this.heapifyDown(0);
    return top.key;
  }

  peek(): K | undefined {
    return this.data[0]?.key;
  }

  forEach(fn: (item: { key: K; value: V }) => void): void {
    this.data.forEach(fn);
  }

  private findIndex(key: K): number {
    // For RuntimeTypedBinder keys, we need to compare by value
    const keyVal = (key as any)?.value !== undefined ? (key as any).value : key;
    return this.data.findIndex(item => {
      const itemKeyVal = (item.key as any)?.value !== undefined ? (item.key as any).value : item.key;
      return itemKeyVal === keyVal;
    });
  }

  has(key: K): boolean {
    return this.findIndex(key) !== -1;
  }

  getPriority(key: K): V | undefined {
    const index = this.findIndex(key);
    if (index === -1) return undefined;
    return this.data[index].value;
  }

  updatePriority(key: K, newValue: V): void {
    const index = this.findIndex(key);
    if (index === -1) {
      throw new Error('Key not found in HeapMap');
    }
    const oldValue = this.data[index].value;
    this.data[index].value = newValue;

    // Determine whether to heapify up or down
    if (this.compareFn(newValue, oldValue) < 0) {
      this.heapifyUp(index);
    } else {
      this.heapifyDown(index);
    }
  }

  delete(key: K): boolean {
    const index = this.findIndex(key);
    if (index === -1) return false;

    if (index === this.data.length - 1) {
      this.data.pop();
    } else {
      this.data[index] = this.data.pop()!;
      this.heapifyDown(index);
      this.heapifyUp(index);
    }
    return true;
  }

  clear(): void {
    this.data = [];
  }

  entries(): Array<[K, V]> {
    return this.data.map(item => [item.key, item.value]);
  }

  toString(): string {
    return `HeapMap[${this.data.map(item => `${item.key}:${item.value}`).join(', ')}]`;
  }
}

export class MinHeapMap<K, V> extends HeapMap<K, V> {
  constructor() {
    super((a: any, b: any) => {
      const aVal = a.value !== undefined ? a.value : a;
      const bVal = b.value !== undefined ? b.value : b;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  }
  
  toString(): string {
    return `MinHeapMap${super.toString().substring(7)}`;
  }
}

export class MaxHeapMap<K, V> extends HeapMap<K, V> {
  constructor() {
    super((a: any, b: any) => {
      const aVal = a.value !== undefined ? a.value : a;
      const bVal = b.value !== undefined ? b.value : b;
      if (aVal > bVal) return -1;
      if (aVal < bVal) return 1;
      return 0;
    });
  }

  toString(): string {
    return `MaxHeapMap${super.toString().substring(7)}`;
  }
}
