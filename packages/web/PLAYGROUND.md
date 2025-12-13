# SchemA Playground

A Monaco Editor-based web playground for the SchemA language.

## Features

- **Real-time Syntax Highlighting**: Custom Monaco language definition for SchemA syntax
- **Live Error Detection**: Diagnostics worker that provides real-time error checking
- **Code Execution**: Run SchemA code directly in the browser
- **Example Library**: Pre-loaded examples to help you get started
- **Clean UI**: VS Code-inspired dark theme interface

## Getting Started

### Development

```bash
# From the packages/web directory
pnpm install
pnpm dev
```

The playground will be available at `http://localhost:5173`

### Build

```bash
pnpm build
```

The built files will be in the `dist` directory.

## Architecture

### Main Components

1. **playground.ts**: Main entry point that initializes Monaco Editor and manages the UI
2. **schema-worker.js**: Web Worker that runs SchemA code analysis and execution in the background
3. **index.html**: UI layout with editor and output panel

### How It Works

1. User types SchemA code in the Monaco editor
2. Code changes are debounced and sent to the web worker
3. Worker runs the code through the SchemA parser, type checker, and interpreter
4. Results (or errors) are sent back to the main thread
5. Monaco markers are updated for error highlighting
6. Output is displayed in the preview panel

### Example Structure

Examples are defined in `playground.ts` as an object:

```typescript
const examples = {
  'Example Name': `code here`,
  // ...
};
```

## Language Features

The Monaco editor provides:

- Syntax highlighting for SchemA keywords (`let`, `al`, `if`, `while`, etc.)
- Auto-closing brackets and quotes
- Comment support (`//` and `/* */`)
- Type detection for built-in data structures (`MinHeap`, `MaxHeap`)

## Customization

### Adding New Examples

Edit the `examples` object in [playground.ts](src/playground.ts:21):

```typescript
const examples = {
  'Your Example': `print("Hello SchemA")
let x = 42
print(x)`,
};
```

### Modifying the Theme

The playground uses inline CSS for styling. Edit the `<style>` section in [index.html](index.html:7) to customize colors and layout.

### Extending Language Support

The language definition is in the `registerSchemaLanguage` function in [playground.ts](src/playground.ts:182). You can add:

- New keywords
- Custom operators
- Advanced tokenization rules

## Browser Compatibility

Requires a modern browser with:
- Web Workers support
- ES6+ module support
- Monaco Editor compatibility (Chrome, Firefox, Safari, Edge)

## Future Enhancements

- [ ] LSP integration for advanced IntelliSense
- [ ] Multiple file support
- [ ] Shareable playground links
- [ ] Export to file functionality
- [ ] Performance profiling
- [ ] Step-through debugging
- [ ] AST visualization
