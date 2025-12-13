// SchemA diagnostics worker
import { run } from '@schema/core';

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'analyze') {
    const { source } = payload;
    const result = analyzeSchemaSource(source);
    self.postMessage({
      type: 'diagnostics',
      payload: result
    });
  }
};

function analyzeSchemaSource(source) {
  if (!source || !source.trim()) {
    return {
      diagnostics: [],
      summary: 'Waiting for input…',
      output: []
    };
  }

  const diagnostics = [];
  let output = [];

  try {
    // Run the SchemA code
    output = run(source);

    // No errors means success
    return {
      diagnostics: [],
      summary: 'Success',
      output: output
    };
  } catch (error) {
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

function parseError(error, source) {
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
