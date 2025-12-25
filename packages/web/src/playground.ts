import type * as Monaco from 'monaco-editor';
import { examples } from './examples';

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

const defaultSource = examples['Hello World'];

const previewSummary = document.getElementById('preview-summary') as HTMLElement;
const previewOutput = document.getElementById('preview-output') as HTMLElement;

let diagnosticsWorker: Worker | null = null;
let monacoApi: typeof Monaco | null = null;
let workerTimeout: number | null = null;
let currentAnalysisId = 0;

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

function createWorker() {
  const worker = new Worker(new URL('./schema-worker.ts', import.meta.url), { type: 'module' });

  worker.onmessage = event => {
    if (workerTimeout !== null) {
      window.clearTimeout(workerTimeout);
      workerTimeout = null;
    }

    const { type, payload } = event.data;
    if (type === 'diagnostics' && monacoApi) {
      applyDiagnostics(monacoApi, (window as any).__schemaEditor, payload);
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

function initializeDiagnostics(editor: Monaco.editor.IStandaloneCodeEditor) {
  if (!('Worker' in window)) {
    setSummary('Diagnostics unavailable in this browser.', 'warning');
    return null;
  }

  return createWorker();
}

function registerSchemaLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: 'schema' });

  monaco.languages.setMonarchTokensProvider('schema', {
    keywords: [
      'let', 'do', 'if', 'else', 'while', 'until', 'for','in', 'return',
      'print', 'true', 'false', 'null', 'typeof', 'assert', 'invariant'
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
    currentAnalysisId++;

    // Terminate the previous worker if it's taking too long (likely stuck in infinite loop)
    if (workerTimeout !== null) {
      window.clearTimeout(workerTimeout);
      workerTimeout = null;
    }

    if (diagnosticsWorker) {
      diagnosticsWorker.terminate();
      diagnosticsWorker = createWorker();
    }

    setSummary('Running checks…', 'warning');

    if (diagnosticsWorker) {
      diagnosticsWorker.postMessage({
        type: 'analyze',
        payload: { source: text }
      });

      // Set a timeout to detect infinite loops
      workerTimeout = window.setTimeout(() => {
        if (diagnosticsWorker) {
          diagnosticsWorker.terminate();
          diagnosticsWorker = createWorker();
          setSummary('TIMEOUT', 'error');
          renderPreviewText('Execution timeout: possible infinite loop detected (exceeded 3 seconds)', 'error');
        }
      }, 3000);
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

function initializeResizer() {
  const resizer = document.getElementById('resizer');
  const preview = document.querySelector('.preview') as HTMLElement;
  const editor = document.getElementById('editor') as HTMLElement;

  if (!resizer || !preview || !editor) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = preview.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = startX - e.clientX;
    const newWidth = Math.max(200, Math.min(window.innerWidth - 200, startWidth + deltaX));
    preview.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
    initializeResizer();

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
