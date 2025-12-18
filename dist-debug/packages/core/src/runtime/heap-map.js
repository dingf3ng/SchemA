"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxHeapMap = exports.MinHeapMap = exports.HeapMap = void 0;
class HeapMap {
    constructor(compareFn) {
        this.data = [];
        this.compareFn = compareFn;
    }
    get size() {
        return this.data.length;
    }
    isEmpty() {
        return this.data.length === 0;
    }
    parent(i) {
        return Math.floor((i - 1) / 2);
    }
    leftChild(i) {
        return 2 * i + 1;
    }
    rightChild(i) {
        return 2 * i + 2;
    }
    swap(i, j) {
        [this.data[i], this.data[j]] = [this.data[j], this.data[i]];
    }
    heapifyUp(index) {
        while (index > 0) {
            const parentIndex = this.parent(index);
            if (this.compareFn(this.data[index].value, this.data[parentIndex].value) < 0) {
                this.swap(index, parentIndex);
                index = parentIndex;
            }
            else {
                break;
            }
        }
    }
    heapifyDown(index) {
        while (true) {
            let smallest = index;
            const left = this.leftChild(index);
            const right = this.rightChild(index);
            if (left < this.data.length &&
                this.compareFn(this.data[left].value, this.data[smallest].value) < 0) {
                smallest = left;
            }
            if (right < this.data.length &&
                this.compareFn(this.data[right].value, this.data[smallest].value) < 0) {
                smallest = right;
            }
            if (smallest !== index) {
                this.swap(index, smallest);
                index = smallest;
            }
            else {
                break;
            }
        }
    }
    push(key, value) {
        this.data.push({ key, value });
        this.heapifyUp(this.data.length - 1);
    }
    pop() {
        var _a;
        if (this.data.length === 0)
            return undefined;
        if (this.data.length === 1)
            return (_a = this.data.pop()) === null || _a === void 0 ? void 0 : _a.key;
        const top = this.data[0];
        this.data[0] = this.data.pop();
        this.heapifyDown(0);
        return top.key;
    }
    peek() {
        var _a;
        return (_a = this.data[0]) === null || _a === void 0 ? void 0 : _a.key;
    }
    forEach(fn) {
        this.data.forEach(fn);
    }
    toString() {
        return `HeapMap[${this.data.map(item => `${item.key}:${item.value}`).join(', ')}]`;
    }
}
exports.HeapMap = HeapMap;
class MinHeapMap extends HeapMap {
    constructor() {
        super((a, b) => {
            if (a < b)
                return -1;
            if (a > b)
                return 1;
            return 0;
        });
    }
    toString() {
        return `MinHeapMap${super.toString().substring(7)}`;
    }
}
exports.MinHeapMap = MinHeapMap;
class MaxHeapMap extends HeapMap {
    constructor() {
        super((a, b) => {
            if (a > b)
                return -1;
            if (a < b)
                return 1;
            return 0;
        });
    }
    toString() {
        return `MaxHeapMap${super.toString().substring(7)}`;
    }
}
exports.MaxHeapMap = MaxHeapMap;
