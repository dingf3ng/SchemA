// SchemA diagnostics worker
// Using dynamic import to avoid bundling issues
let schemaCore: any = null;
let currentExecutionId = 0;
let isExecuting = false;

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'analyze') {
    const { source } = payload;

    // Increment execution ID to invalidate any in-progress execution
    currentExecutionId++;
    const executionId = currentExecutionId;

    // If already executing, the previous execution will be abandoned
    if (isExecuting) {
      console.log('Cancelling previous execution');
    }

    // Lazy load the core library
    if (!schemaCore) {
      try {
        // This will be bundled by Vite
        const coreModule = await import('@schema/core');
        schemaCore = coreModule;
      } catch (error) {
        console.error('Failed to load @schema/core:', error);
        self.postMessage({
          type: 'diagnostics',
          payload: {
            diagnostics: [{
              message: 'Failed to load SchemA runtime. Using mock mode.',
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 2,
              severity: 'warning'
            }],
            summary: 'Runtime unavailable',
            output: ['SchemA runtime not loaded. Showing mock output.']
          }
        });
        return;
      }
    }

    const result = analyzeSchemaSource(source);

    // Only send result if this execution hasn't been superseded
    if (executionId === currentExecutionId) {
      self.postMessage({
        type: 'diagnostics',
        payload: result
      });
    }
  }
};

function analyzeSchemaSource(source: string) {
  if (!source || !source.trim()) {
    return {
      diagnostics: [],
      summary: 'Waiting for input…',
      output: []
    };
  }

  const diagnostics: any[] = [];
  let output: string[] = [];

  try {
    isExecuting = true;

    // Run the SchemA code
    if (schemaCore && schemaCore.run) {
      output = schemaCore.run(source);
    } else {
      // Fallback: just echo the input
      output = [`Code ready to run (${source.split('\n').length} lines)`];
    }

    isExecuting = false;

    // No errors means success
    return {
      diagnostics: [],
      summary: 'Success',
      output: output
    };
  } catch (error: any) {
    isExecuting = false;

    // Parse the error and create diagnostic
    const diagnostic = parseError(error, source);
    diagnostics.push(diagnostic);

    return {
      diagnostics: diagnostics,
      summary: 'Errors detected.',
      output: []
    };
  }
}

function parseError(error: any, source: string) {
  const message = error.message || 'Unknown error';

  // Try to extract line/column info from error message
  // Common patterns: "line X, column Y" or "at X:Y"
  const lineColMatch = message.match(/line (\d+),?\s*column (\d+)/i) ||
                       message.match(/at (\d+):(\d+)/) ||
                       message.match(/\((\d+),(\d+)\)/);

  let startLineNumber = 1;
  let startColumn = 1;

  if (lineColMatch) {
    startLineNumber = parseInt(lineColMatch[1], 10);
    startColumn = parseInt(lineColMatch[2], 10);
  }

  // Check for ANTLR syntax errors
  const antlrMatch = message.match(/line (\d+):(\d+)/);
  if (antlrMatch) {
    startLineNumber = parseInt(antlrMatch[1], 10);
    startColumn = parseInt(antlrMatch[2], 10) + 1; // ANTLR is 0-indexed for columns
  }

  // Clean up the error message
  let cleanMessage = message
    .replace(/^Error:\s*/i, '')
    .replace(/line \d+,?\s*column \d+:?\s*/i, '')
    .replace(/at \d+:\d+:?\s*/, '')
    .trim();

  return {
    message: cleanMessage || 'Syntax error',
    startLineNumber: Math.max(1, startLineNumber),
    startColumn: Math.max(1, startColumn),
    endLineNumber: startLineNumber,
    endColumn: startColumn + 1,
    severity: 'error'
  };
}
