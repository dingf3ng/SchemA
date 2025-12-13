import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@schema/core': path.resolve(__dirname, '../core/src/index.ts'),
      // Provide browser-compatible stubs for Node modules
      'util': 'util',
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'assert': path.resolve(__dirname, 'node_modules/assert/build/assert.js'),
    },
  },
  define: {
    // Define Node.js globals for browser
    'process.env': {},
    'global': 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  optimizeDeps: {
    include: ['antlr4ts'],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
      alias: {
        assert: path.resolve(__dirname, 'node_modules/assert/build/assert.js'),
        util: 'util',
        stream: 'stream-browserify',
        buffer: 'buffer',
      },
    },
  },
})
