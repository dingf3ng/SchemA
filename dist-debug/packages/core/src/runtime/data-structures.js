"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeMap = exports.AVLTree = exports.BinaryTree = exports.TreeNode = exports.Graph = exports.LazyRange = exports.MaxHeap = exports.MinHeap = exports.SchemaSet = exports.SchemaMap = exports.SchemaArray = void 0;
__exportStar(require("./heap-map"), exports);
class SchemaArray {
    constructor(initialData) {
        this.data = [];
        if (initialData) {
            this.data = [...initialData];
        }
    }
    get length() {
        return this.data.length;
    }
    push(item) {
        this.data.push(item);
    }
    pop() {
        return this.data.pop();
    }
    get(index) {
        return this.data[index];
    }
    set(index, value) {
        this.data[index] = value;
    }
    forEach(fn) {
        this.data.forEach(fn);
    }
    map(fn) {
        return new SchemaArray(this.data.map(fn));
    }
    filter(fn) {
        return new SchemaArray(this.data.filter(fn));
    }
    toArray() {
        return [...this.data];
    }
    toString() {
        const items = this.data.map(item => {
            const rv = item;
            if (rv && typeof rv === 'object' && rv.type && rv.type.static && rv.type.static.kind) {
                const kind = rv.type.static.kind;
                if (kind === 'int' || kind === 'float' || kind === 'string' || kind === 'boolean') {
                    return rv.value;
                }
                if (kind === 'tuple') {
                    const values = rv.value;
                    const elements = values.map((v) => {
                        if (v && v.type && v.type.static && (v.type.static.kind === 'int' || v.type.static.kind === 'float' || v.type.static.kind === 'string' || v.type.static.kind === 'boolean')) {
                            return v.value;
                        }
                        return v;
                    });
                    return `(${elements.join(', ')})`;
                }
                if (kind === 'record') {
                    const map = rv.value;
                    const entries = Array.from(map.entries());
                    const fields = entries.map(([k, v]) => {
                        let keyStr = k;
                        if (k && k.type && k.type.static && k.type.static.kind === 'string')
                            keyStr = k.value;
                        let valStr = v;
                        if (v && v.type && v.type.static && (v.type.static.kind === 'int' || v.type.static.kind === 'float' || v.type.static.kind === 'string' || v.type.static.kind === 'boolean')) {
                            valStr = v.value;
                        }
                        return `${keyStr}: ${valStr}`;
                    });
                    return `{ ${fields.join(', ')} }`;
                }
            }
            return item;
        });
        return `[${items.join(', ')}]`;
    }
}
exports.SchemaArray = SchemaArray;
class SchemaMap {
    constructor() {
        this.data = new Map();
    }
    get size() {
        return this.data.size;
    }
    get(key) {
        return this.data.get(key);
    }
    set(key, value) {
        this.data.set(key, value);
    }
    has(key) {
        return this.data.has(key);
    }
    delete(key) {
        return this.data.delete(key);
    }
    clear() {
        this.data.clear();
    }
    keys() {
        return Array.from(this.data.keys());
    }
    values() {
        return Array.from(this.data.values());
    }
    entries() {
        return Array.from(this.data.entries());
    }
    forEach(fn) {
        this.data.forEach(fn);
    }
    toString() {
        const entries = this.entries()
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        return `{${entries}}`;
    }
}
exports.SchemaMap = SchemaMap;
class SchemaSet {
    constructor() {
        this.data = new Set();
    }
    get size() {
        return this.data.size;
    }
    add(item) {
        this.data.add(item);
    }
    has(item) {
        return this.data.has(item);
    }
    delete(item) {
        return this.data.delete(item);
    }
    clear() {
        this.data.clear();
    }
    forEach(fn) {
        this.data.forEach(fn);
    }
    toArray() {
        return Array.from(this.data);
    }
    toString() {
        return `{${this.toArray().join(', ')}}`;
    }
}
exports.SchemaSet = SchemaSet;
class MinHeap {
    constructor(compareFn) {
        this.data = [];
        this.compareFn =
            compareFn ||
                ((a, b) => {
                    if (a < b)
                        return -1;
                    if (a > b)
                        return 1;
                    return 0;
                });
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
            if (this.compareFn(this.data[index], this.data[parentIndex]) < 0) {
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
                this.compareFn(this.data[left], this.data[smallest]) < 0) {
                smallest = left;
            }
            if (right < this.data.length &&
                this.compareFn(this.data[right], this.data[smallest]) < 0) {
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
    push(item) {
        this.data.push(item);
        this.heapifyUp(this.data.length - 1);
    }
    pop() {
        if (this.data.length === 0)
            return undefined;
        if (this.data.length === 1)
            return this.data.pop();
        const min = this.data[0];
        this.data[0] = this.data.pop();
        this.heapifyDown(0);
        return min;
    }
    peek() {
        return this.data[0];
    }
    forEach(fn) {
        this.data.forEach(fn);
    }
    toString() {
        return `MinHeap[${this.data.join(', ')}]`;
    }
}
exports.MinHeap = MinHeap;
class MaxHeap {
    constructor(compareFn) {
        this.data = [];
        this.compareFn =
            compareFn ||
                ((a, b) => {
                    if (a > b)
                        return -1;
                    if (a < b)
                        return 1;
                    return 0;
                });
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
            if (this.compareFn(this.data[index], this.data[parentIndex]) < 0) {
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
            let largest = index;
            const left = this.leftChild(index);
            const right = this.rightChild(index);
            if (left < this.data.length &&
                this.compareFn(this.data[left], this.data[largest]) < 0) {
                largest = left;
            }
            if (right < this.data.length &&
                this.compareFn(this.data[right], this.data[largest]) < 0) {
                largest = right;
            }
            if (largest !== index) {
                this.swap(index, largest);
                index = largest;
            }
            else {
                break;
            }
        }
    }
    push(item) {
        this.data.push(item);
        this.heapifyUp(this.data.length - 1);
    }
    pop() {
        if (this.data.length === 0)
            return undefined;
        if (this.data.length === 1)
            return this.data.pop();
        const max = this.data[0];
        this.data[0] = this.data.pop();
        this.heapifyDown(0);
        return max;
    }
    peek() {
        return this.data[0];
    }
    forEach(fn) {
        this.data.forEach(fn);
    }
    toString() {
        return `MaxHeap[${this.data.join(', ')}]`;
    }
}
exports.MaxHeap = MaxHeap;
class LazyRange {
    constructor(start, end, inclusive) {
        this.start = start;
        this.end = end;
        this.inclusive = inclusive;
    }
    get isInfinite() {
        return this.end === undefined;
    }
    // Generate values up to a limit (for iteration)
    *generate() {
        if (this.end === undefined) {
            // Infinite range
            let current = this.start;
            while (true) {
                yield current;
                current++;
            }
        }
        else {
            // Finite range
            const endValue = this.inclusive ? this.end : this.end - 1;
            for (let i = this.start; i <= endValue; i++) {
                yield i;
            }
        }
    }
    // Convert to array (only for finite ranges)
    toArray() {
        if (this.isInfinite) {
            throw new Error('Cannot convert infinite range to array');
        }
        const result = [];
        for (const value of this.generate()) {
            result.push(value);
        }
        return result;
    }
    toString() {
        if (this.isInfinite) {
            return `Range(${this.start}..)`;
        }
        const op = this.inclusive ? '...' : '..';
        return `Range(${this.start}${op}${this.end})`;
    }
}
exports.LazyRange = LazyRange;
/**
 * Problem: Graph was using RuntimeTypedBinder objects directly as keys in its
 * internal Map. Since RuntimeTypedBinders are objects, Map uses reference equality.
 * This meant that g.addVertex(1) and g.getNeighbors(1) were treating the two 1s
 * as different vertices because they were different object instances wrapping
 * the same value.
 * Fix: Modified Graph in data-structures.ts to accept a keyFn in its constructor.
 * This function is used to extract a canonical key for node storage and lookup.
 */
class Graph {
    constructor(directed = false, keyFn) {
        this.adjacencyList = new Map();
        this.directed = directed;
        this.keyFn = keyFn || ((node) => node);
    }
    addVertex(vertex) {
        const key = this.keyFn(vertex);
        if (!this.adjacencyList.has(key)) {
            this.adjacencyList.set(key, { node: vertex, edges: [] });
        }
    }
    addEdge(from, to, weight = 1) {
        this.addVertex(from);
        this.addVertex(to);
        const fromKey = this.keyFn(from);
        const toKey = this.keyFn(to);
        this.adjacencyList.get(fromKey).edges.push({ to, weight });
        if (!this.directed) {
            this.adjacencyList.get(toKey).edges.push({ to: from, weight });
        }
    }
    getNeighbors(vertex) {
        const key = this.keyFn(vertex);
        const entry = this.adjacencyList.get(key);
        return entry ? entry.edges : [];
    }
    hasVertex(vertex) {
        const key = this.keyFn(vertex);
        return this.adjacencyList.has(key);
    }
    getVertices() {
        return Array.from(this.adjacencyList.values()).map(entry => entry.node);
    }
    getEdgeWeight(from, to) {
        const key = this.keyFn(from);
        const entry = this.adjacencyList.get(key);
        if (!entry)
            return undefined;
        const toKey = this.keyFn(to);
        const edge = entry.edges.find((e) => this.keyFn(e.to) === toKey);
        return edge === null || edge === void 0 ? void 0 : edge.weight;
    }
    isDirected() {
        return this.directed;
    }
    hasEdge(from, to) {
        const key = this.keyFn(from);
        const entry = this.adjacencyList.get(key);
        if (!entry)
            return false;
        const toKey = this.keyFn(to);
        return entry.edges.some((e) => this.keyFn(e.to) === toKey);
    }
    getEdges() {
        const edges = [];
        for (const entry of this.adjacencyList.values()) {
            const from = entry.node;
            for (const edge of entry.edges) {
                edges.push({ from, to: edge.to, weight: edge.weight });
            }
        }
        return edges;
    }
    toString() {
        let result = 'Graph:\n';
        for (const entry of this.adjacencyList.values()) {
            const vertex = entry.node;
            const edges = entry.edges;
            const edgeStr = edges
                .map((e) => {
                const toVal = e.to.value !== undefined ? e.to.value : e.to;
                return `${toVal}(${e.weight})`;
            })
                .join(', ');
            const vertexVal = vertex.value !== undefined ? vertex.value : vertex;
            result += `  ${vertexVal} -> [${edgeStr}]\n`;
        }
        return result;
    }
}
exports.Graph = Graph;
class TreeNode {
    constructor(value) {
        this.left = null;
        this.right = null;
        this.height = 1;
        this.value = value;
    }
}
exports.TreeNode = TreeNode;
class BinaryTree {
    constructor(compareFn) {
        this.root = null;
        this.compareFn =
            compareFn ||
                ((a, b) => {
                    if (a < b)
                        return -1;
                    if (a > b)
                        return 1;
                    return 0;
                });
    }
    insert(value) {
        this.root = this.insertNode(this.root, value);
    }
    insertNode(node, value) {
        if (!node) {
            return new TreeNode(value);
        }
        if (this.compareFn(value, node.value) < 0) {
            node.left = this.insertNode(node.left, value);
        }
        else {
            node.right = this.insertNode(node.right, value);
        }
        return node;
    }
    search(value) {
        return this.searchNode(this.root, value);
    }
    searchNode(node, value) {
        if (!node)
            return false;
        const cmp = this.compareFn(value, node.value);
        if (cmp === 0)
            return true;
        if (cmp < 0)
            return this.searchNode(node.left, value);
        return this.searchNode(node.right, value);
    }
    getHeight() {
        return this.calculateHeight(this.root);
    }
    calculateHeight(node) {
        if (!node)
            return 0;
        return 1 + Math.max(this.calculateHeight(node.left), this.calculateHeight(node.right));
    }
    preOrderTraversal() {
        const result = [];
        this.preOrder(this.root, result);
        return result;
    }
    // Iterative preOrder traversal using explicit stack (optimization)
    preOrder(node, result) {
        if (!node)
            return;
        const stack = [node];
        while (stack.length > 0) {
            const current = stack.pop();
            result.push(current.value);
            // Push right first so left is processed first (LIFO)
            if (current.right)
                stack.push(current.right);
            if (current.left)
                stack.push(current.left);
        }
    }
    inOrderTraversal() {
        const result = [];
        this.inOrder(this.root, result);
        return result;
    }
    // Iterative inOrder traversal using explicit stack (optimization)
    inOrder(node, result) {
        if (!node)
            return;
        const stack = [];
        let current = node;
        while (current !== null || stack.length > 0) {
            // Traverse to the leftmost node
            while (current !== null) {
                stack.push(current);
                current = current.left;
            }
            // Current is null here, pop from stack
            current = stack.pop();
            result.push(current.value);
            // Visit right subtree
            current = current.right;
        }
    }
    postOrderTraversal() {
        const result = [];
        this.postOrder(this.root, result);
        return result;
    }
    // Iterative postOrder traversal using two stacks (optimization)
    postOrder(node, result) {
        if (!node)
            return;
        const stack1 = [node];
        const stack2 = [];
        // First pass: reverse postorder (root, right, left)
        while (stack1.length > 0) {
            const current = stack1.pop();
            stack2.push(current);
            // Push left first, then right (so right is processed first)
            if (current.left)
                stack1.push(current.left);
            if (current.right)
                stack1.push(current.right);
        }
        // Second pass: pop from stack2 to get correct postorder
        while (stack2.length > 0) {
            result.push(stack2.pop().value);
        }
    }
    toString() {
        return `BinaryTree[${this.inOrderTraversal().join(', ')}]`;
    }
}
exports.BinaryTree = BinaryTree;
class AVLTree extends BinaryTree {
    insert(value) {
        this.root = this.insertNode(this.root, value);
    }
    insertNode(node, value) {
        if (!node) {
            return new TreeNode(value);
        }
        const cmp = this.compareFn(value, node.value);
        if (cmp < 0) {
            node.left = this.insertNode(node.left, value);
        }
        else if (cmp > 0) {
            node.right = this.insertNode(node.right, value);
        }
        else {
            return node;
        }
        node.height = 1 + Math.max(this.height(node.left), this.height(node.right));
        const balance = this.getBalance(node);
        // Left Left Case
        if (balance > 1 && this.compareFn(value, node.left.value) < 0) {
            return this.rightRotate(node);
        }
        // Right Right Case
        if (balance < -1 && this.compareFn(value, node.right.value) > 0) {
            return this.leftRotate(node);
        }
        // Left Right Case
        if (balance > 1 && this.compareFn(value, node.left.value) > 0) {
            node.left = this.leftRotate(node.left);
            return this.rightRotate(node);
        }
        // Right Left Case
        if (balance < -1 && this.compareFn(value, node.right.value) < 0) {
            node.right = this.rightRotate(node.right);
            return this.leftRotate(node);
        }
        return node;
    }
    height(node) {
        return node ? node.height : 0;
    }
    getBalance(node) {
        if (!node)
            return 0;
        return this.height(node.left) - this.height(node.right);
    }
    rightRotate(y) {
        const x = y.left;
        const T2 = x.right;
        x.right = y;
        y.left = T2;
        y.height = Math.max(this.height(y.left), this.height(y.right)) + 1;
        x.height = Math.max(this.height(x.left), this.height(x.right)) + 1;
        return x;
    }
    leftRotate(x) {
        const y = x.right;
        const T2 = y.left;
        y.left = x;
        x.right = T2;
        x.height = Math.max(this.height(x.left), this.height(x.right)) + 1;
        y.height = Math.max(this.height(y.left), this.height(y.right)) + 1;
        return y;
    }
    getHeight() {
        return this.height(this.root);
    }
    toString() {
        return `AVLTree[${this.inOrderTraversal().join(', ')}]`;
    }
}
exports.AVLTree = AVLTree;
class TreeMap {
    constructor(compareFn) {
        this.compareFn =
            compareFn ||
                ((a, b) => {
                    if (a < b)
                        return -1;
                    if (a > b)
                        return 1;
                    return 0;
                });
        this.avlTree = new AVLTree((a, b) => this.compareFn(a.key, b.key));
    }
    set(key, value) {
        this.avlTree.insert({ key, value });
    }
    // Note: This is a simple implementation and may not retrieve the latest value if duplicate keys are inserted.
    get(key) {
        const nodes = this.avlTree.inOrderTraversal();
        for (const node of nodes) {
            if (this.compareFn(node.key, key) === 0) {
                return node.value;
            }
        }
        return undefined;
    }
    has(key) {
        return this.get(key) !== undefined;
    }
    toString() {
        const entries = this.avlTree
            .inOrderTraversal()
            .map((kv) => `${kv.key}: ${kv.value}`)
            .join(', ');
        return `TreeMap{${entries}}`;
    }
}
exports.TreeMap = TreeMap;
