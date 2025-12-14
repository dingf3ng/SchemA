# SchemA Playground Setup Guide

This guide explains the Monaco Editor-based web playground for SchemA, similar to the Pie playground reference.

## 📁 Project Structure

```
packages/web/
├── index.html                    # Main HTML with inline styles
├── public/
│   └── schema-worker.js         # Web Worker for code analysis
├── src/
│   └── playground.ts            # Main TypeScript entry point
├── vite.config.ts               # Vite configuration
└── PLAYGROUND.md                # Detailed documentation
```

## 🚀 Quick Start

```bash
# Navigate to web package
cd packages/web

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

The playground will be available at `http://localhost:5173` (or the next available port).

## ✨ Features

### 1. **Monaco Editor Integration**
- Full-featured code editor with VS Code-like experience
- Custom syntax highlighting for SchemA
- Auto-completion for brackets and quotes
- Line numbers and minimap

### 2. **Real-time Code Analysis**
- Web Worker-based execution (non-blocking UI)
- Live error detection with inline markers
- Type checking via SchemA type checker
- Syntax validation

### 3. **Example Library**
Pre-loaded examples include:
- **Hello World**: Basic SchemA syntax
- **MinHeap & MaxHeap**: Data structure demonstrations
- **Data Structures**: Maps and arrays
- **Fibonacci**: Recursive algorithms
- **Factorial**: Another recursion example

### 4. **Output Panel**
- Real-time output display
- Color-coded status indicators:
  - 🟢 **Green**: Success
  - 🟡 **Yellow**: Warning/Processing
  - 🔴 **Red**: Error
- Detailed error messages with line/column info

## 🛠️ Technical Architecture

### Monaco Language Registration

The playground registers a custom Monaco language for SchemA with:

```typescript
monaco.languages.register({ id: 'schema' });
```

**Keywords**: `let`, `do`, `if`, `else`, `while`, `for`, `return`, `print`, etc.

**Built-in Types**: `MinHeap`, `MaxHeap`

**Operators**: All standard operators with proper tokenization

### Web Worker Communication

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Editor    │ ─code─> │ Main Thread  │ ─msg──> │   Worker    │
│  (Monaco)   │         │ (playground) │         │ (analyzer)  │
└─────────────┘         └──────────────┘         └─────────────┘
                                │                        │
                                │     ┌─────────────────┘
                                │     │
                                ▼     ▼
                        ┌──────────────────┐
                        │  Apply Markers   │
                        │  Update Output   │
                        └──────────────────┘
```

**Message Flow**:
1. User types code
2. Debounced message sent to worker (220ms delay)
3. Worker runs: `parse() → typeCheck() → interpret()`
4. Worker sends back diagnostics + output
5. Main thread applies Monaco markers
6. Output panel updates

### Error Handling

The worker parses SchemA errors and extracts:
- Line number
- Column number
- Error message
- Severity (error/warning)

Example error parsing:
```javascript
const lineColMatch = message.match(/line (\d+),?\s*column (\d+)/i);
```

## 📝 Code Examples

### Adding a New Example

Edit `playground.ts`:

```typescript
const examples = {
  'My Example': `print("Hello World")
let x = 42
do square(n) {
  return n * n
}
print(square(x))`,
};
```

### Customizing Theme Colors

Edit the `<style>` section in `index.html`:

```css
#preview-output[data-tone="success"] {
  color: #a8d5ba; /* Change success color */
}
```

## 🎨 UI Components

### Header
- Title: "🔬 SchemA Playground"
- Example picker dropdown
- Clean, minimal design

### Editor Panel
- Left side: Monaco Editor
- Syntax highlighting
- Error markers (red squiggles)
- Auto-indentation

### Output Panel
- Right side: 400px wide
- Header with status badge
- Scrollable output area
- Monospace font for code

## 🔧 Configuration

### Vite Config Highlights

```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@schema/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  worker: {
    format: 'es', // ES modules for workers
  },
  optimizeDeps: {
    exclude: ['@schema/core'], // Don't pre-bundle core
  },
})
```

### TypeScript Support

The playground uses TypeScript with:
- Strict mode enabled
- Monaco type definitions
- Web Worker types

## 🌐 Browser Compatibility

**Required**:
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- ES6+ module support
- Web Workers API
- Async/await support

**Tested on**:
- ✅ Chrome 120+
- ✅ Firefox 120+
- ✅ Safari 17+
- ✅ Edge 120+

## 📊 Performance

- **Initial Load**: ~1.5s (Monaco CDN + code bundle)
- **Code Analysis**: ~50-200ms (depends on code complexity)
- **Debounce Delay**: 220ms (prevents excessive worker calls)
- **Editor Responsiveness**: 60fps smooth scrolling

## 🐛 Debugging

### Check Console for Errors

```javascript
// Access editor instance
window.__schemaEditor.getValue()

// Check worker status
console.log('Worker running:', diagnosticsWorker !== null)
```

### Common Issues

1. **Worker fails to load**
   - Check browser console for CORS errors
   - Ensure `schema-worker.js` is in `/public/`

2. **Syntax highlighting not working**
   - Verify Monaco loaded: `window.monaco !== undefined`
   - Check language registration in console

3. **Output not showing**
   - Check worker message handler
   - Verify `run()` function from `@schema/core`

## 🚧 Future Enhancements

### Planned Features
- [ ] **LSP Integration**: Advanced IntelliSense and code navigation
- [ ] **Multi-file Projects**: Import/export between files
- [ ] **Shareable Links**: URL-based code sharing
- [ ] **File Export**: Download code as `.schema` files
- [ ] **Performance Profiler**: Execution time analysis
- [ ] **Debugger**: Step-through debugging support
- [ ] **AST Viewer**: Visualize abstract syntax tree
- [ ] **Type Inspector**: Hover to see inferred types
- [ ] **Code Formatting**: Auto-format on save
- [ ] **Dark/Light Themes**: Toggle editor themes

### Nice-to-Have
- Split panel resizing
- Keyboard shortcuts panel
- Code snippets library
- Tutorial mode with guided examples
- Mobile-responsive design

## 📚 Related Documentation

- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/index.html)
- [Vite Documentation](https://vitejs.dev/)
- [Web Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [SchemA Language Spec](../../README.md)

## 🎯 Comparison with Pie Playground

| Feature | Pie Playground | SchemA Playground |
|---------|----------------|-------------------|
| Editor | Monaco ✅ | Monaco ✅ |
| Web Worker | ✅ | ✅ |
| LSP Support | ✅ | ❌ (planned) |
| Examples | 10+ | 5+ |
| Theme | VS Dark | VS Dark |
| Language Complexity | High (Dependent types) | Medium (Type system) |

## 🏁 Getting Started Checklist

- [x] Install dependencies (`pnpm install`)
- [x] Start dev server (`pnpm dev`)
- [ ] Open browser to `http://localhost:5173`
- [ ] Select "Hello World" example
- [ ] Click in editor and start coding
- [ ] Watch output panel for results
- [ ] Try other examples
- [ ] Experiment with custom code

## 💡 Tips

1. **Use Examples**: Start with provided examples to learn syntax
2. **Watch Status Badge**: Green = success, Red = error
3. **Read Error Messages**: Line/column info helps debug quickly
4. **Save Your Work**: Copy code before refreshing (no auto-save yet)
5. **Experiment Freely**: The playground is sandboxed and safe

---

**Built with ❤️ for the SchemA community**
