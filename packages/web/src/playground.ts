import type * as Monaco from 'monaco-editor';

// Extend Window interface to include Monaco globals
declare global {
  interface Window {
    monaco: typeof Monaco;
    require: {
      (modules: string[], callback: (...args: any[]) => void): void;
      config(config: { paths: Record<string, string> }): void;
    };
  }
}

const examples = {
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

print("\nFibonacci sequence:")
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

print("\n=== Binary Search ===")
let sortedArr = [1, 3, 5, 7, 9, 11, 13, 15]
print("Array:")
print(sortedArr)
print("Searching for 7...")
let index = binarySearch(sortedArr, 7)
print("Found at index:")
print(index)

// Priority Queue (MinHeap) example
print("\n=== Priority Queue (MinHeap) ===")
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

print("\n=== Set Operations ===")
let uniqueNumbers = Set()
let numbers = [1, 2, 3, 2, 1, 4, 3, 5]
for num in numbers {
  uniqueNumbers.add(num)
}
print("Original array:")
print(numbers)
print("Unique count:")
print(uniqueNumbers.size())

print("\n=== Map (Dictionary) ===")
let grades = Map()
grades.set("Alice", 95)
grades.set("Bob", 87)
grades.set("Charlie", 92)

print("Alice's grade:")
print(grades.get("Alice"))
print("Total students:")
print(grades.size())

print("\nSchemA language demo complete!")
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
'Dijkstra\'s Algorithm':`
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
'Bellman-Ford Algorithm':`
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

`
};

const defaultSource = examples['Hello World'];

const previewSummary = document.getElementById('preview-summary') as HTMLElement;
const previewOutput = document.getElementById('preview-output') as HTMLElement;

let diagnosticsWorker: Worker | null = null;
let monacoApi: typeof Monaco | null = null;

function setSummary(message: string, tone: 'neutral' | 'success' | 'warning' | 'error' = 'neutral') {
  if (previewSummary) {
    previewSummary.textContent = message;
    previewSummary.dataset.tone = tone;
  }
}

function renderPreviewText(text: string | undefined, tone?: 'neutral' | 'success' | 'warning' | 'error') {
  if (tone) {
    previewOutput.dataset.tone = tone;
  } else {
    delete previewOutput.dataset.tone;
  }

  if (text === undefined) {
    previewOutput.textContent = 'Program is empty.';
  } else {
    previewOutput.textContent = text;
  }
}

function applyDiagnostics(monaco: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor, payload: any) {
  const { diagnostics, output } = payload;
  const model = editor.getModel();

  if (!model) return;

  const markers = diagnostics.map((d: any) => ({
    startLineNumber: d.startLineNumber,
    startColumn: d.startColumn,
    endLineNumber: d.endLineNumber,
    endColumn: d.endColumn,
    message: d.message,
    severity: d.severity === 'warning'
      ? monaco.MarkerSeverity.Warning
      : monaco.MarkerSeverity.Error
  }));

  monaco.editor.setModelMarkers(model, 'schema-playground', markers);

  if (diagnostics.length === 0) {
    setSummary('SUCCESS', 'success');
    renderPreviewText(output?.join('\n') ?? 'No output', 'success');
    return;
  }

  const primary = diagnostics[0];
  const tone = primary.severity === 'warning' ? 'warning' : 'error';
  const label = tone === 'warning' ? 'WARNING' : 'ERROR';

  setSummary(label, tone);
  const location = `Line ${primary.startLineNumber}, Col ${primary.startColumn}`;
  renderPreviewText(`${location}\n${primary.message}`, tone);
}

function initializeDiagnostics(editor: Monaco.editor.IStandaloneCodeEditor) {
  if (!('Worker' in window)) {
    setSummary('Diagnostics unavailable in this browser.', 'warning');
    return null;
  }

  const worker = new Worker(new URL('./schema-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = event => {
    const { type, payload } = event.data;
    if (type === 'diagnostics' && monacoApi) {
      applyDiagnostics(monacoApi, editor, payload);
    }
  };

  worker.onerror = (error) => {
    console.error('Worker error event:', error);
    setSummary('Diagnostics worker crashed.', 'error');
    renderPreviewText(
      `Worker failed to load. Check browser console for details.\nError: ${error.message || 'Unknown error'}`,
      'error'
    );
  };

  return worker;
}

function registerSchemaLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: 'schema' });

  monaco.languages.setMonarchTokensProvider('schema', {
    keywords: [
      'let', 'do', 'if', 'else', 'while', 'until', 'for','in', 'return',
      'print', 'true', 'false', 'null', 'typeof', 'assert'
    ],
    
    typeKeywords: [
      'int', 'float', 'string', 'bool', 'void', 'Map', 'Array', 'Graph',
      'MinHeap', 'MaxHeap', 'Set', 'BinaryTree', 'AVLTree', 'MinHeapMap',
      'MaxHeapMap'
    ],
    operators: [
      '=', '>', '<', '!', ':', '==', '<=', '>=', '!=',
      '&&', '||', '+', '-', '*', '/', '/.', '&', '|', '^', '%',
      '<<', '>>', '.', '..', '...', '_'
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        [/[a-z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'keyword.type',
            '@default': 'identifier'
          }
        }],
        [/[A-Z][\w\$]*/, 'type.identifier'],

        { include: '@whitespace' },

        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],

        [/[;,.]/, 'delimiter'],

        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        ["\\*/", 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
    },
  });

  monaco.languages.setLanguageConfiguration('schema', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/']
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}

function initializeEditor(monaco: typeof Monaco) {
  // Register Schema language
  registerSchemaLanguage(monaco);

  const editor = monaco.editor.create(document.getElementById('editor')!, {
    value: defaultSource,
    language: 'schema',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: {
      enabled: false
    },
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 6,
      verticalSliderSize: 4
    },
    padding: { top: 16 },
    fontSize: 14,
    fontFamily: "Menlo, 'Fira Code', 'JetBrains Mono', monospace",
    smoothScrolling: true
  });

  renderPreviewText(defaultSource.trim());
  setSummary('Ready for analysis.', 'neutral');

  const debounced = debounce((text: string) => {
    if (text.trim().length === 0) {
      setSummary('Waiting for input…', 'neutral');
      renderPreviewText(undefined);
    } else {
      setSummary('Running checks…', 'warning');
      renderPreviewText('Analyzing…');
    }
  }, 120);

  const queueDiagnostics = debounce((text: string) => {
    setSummary('Running checks…', 'warning');
    if (diagnosticsWorker) {
      diagnosticsWorker.postMessage({
        type: 'analyze',
        payload: { source: text }
      });
    }
  }, 220);

  editor.onDidChangeModelContent(() => {
    const content = editor.getValue();
    debounced(content);
    queueDiagnostics(content);
  });

  return editor;
}

function initializeExamplePicker(editor: Monaco.editor.IStandaloneCodeEditor) {
  const picker = document.getElementById('example-picker') as HTMLSelectElement;

  if (!picker) return;

  // Populate the dropdown
  Object.keys(examples).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    picker.appendChild(option);
  });

  // Set initial value
  picker.value = 'Hello World';

  // Handle selection
  picker.addEventListener('change', (e) => {
    const exampleName = (e.target as HTMLSelectElement).value;
    if (exampleName && examples[exampleName as keyof typeof examples]) {
      editor.setValue(examples[exampleName as keyof typeof examples]);
    }
  });
}

async function boot() {
  if (!window.require) {
    console.error('Monaco loader not available');
    return;
  }

  window.require.config({
    paths: {
      vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs'
    }
  });

  window.require(['vs/editor/editor.main'], async () => {
    monacoApi = window.monaco;
    const editor = initializeEditor(monacoApi);
    diagnosticsWorker = initializeDiagnostics(editor);
    initializeExamplePicker(editor);

    if (diagnosticsWorker) {
      diagnosticsWorker.postMessage({
        type: 'analyze',
        payload: { source: editor.getValue() }
      });
    }

    (window as any).__schemaEditor = editor;
  });
}

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let handle: number;
  return function debounced(this: any, ...args: Parameters<T>) {
    window.clearTimeout(handle);
    handle = window.setTimeout(() => fn.apply(this, args), delay);
  };
}

boot();
