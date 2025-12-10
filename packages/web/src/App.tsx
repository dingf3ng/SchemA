import { useState } from 'react'
import './App.css'
import { Parser, Interpreter } from '@schema/core'

function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')

  const handleRun = () => {
    const parser = new Parser()
    const interpreter = new Interpreter()
    const parsed = parser.parse(input)
    const evaluated = interpreter.evaluate(input)
    setOutput(`${parsed}\n${evaluated}`)
  }

  return (
    <div className="container">
      <h1>Schema Language Playground</h1>
      <div className="editor">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter code here..."
          rows={10}
          cols={50}
          style={{ width: '100%', padding: '10px', fontFamily: 'monospace' }}
        />
      </div>
      <div style={{ margin: '10px 0' }}>
        <button onClick={handleRun}>Run</button>
      </div>
      <div className="output" style={{ border: '1px solid #ccc', padding: '10px', minHeight: '100px', textAlign: 'left' }}>
        <h3>Output:</h3>
        <pre>{output}</pre>
      </div>
    </div>
  )
}

export default App
