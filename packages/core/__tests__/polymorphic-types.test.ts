import { run } from '../src/index';

describe('Polymorphic Types', () => {
  describe('Tuples', () => {
    it('should return tuples from Map.entries()', () => {
      const code = `
        let m = Map()
        m.set("x", 10)
        m.set("y", 20)
        let entries = m.entries()
        print(entries)
      `;
      const output = run(code);
      // Tuples should be displayed as (key, value)
      expect(output.some(line => line.includes('(x, 10)'))).toBe(true);
      expect(output.some(line => line.includes('(y, 20)'))).toBe(true);
    });

    it('should support tuple indexing', () => {
      const code = `
        let m = Map()
        m.set("key", "value")
        let entries = m.entries()
        for entry in entries {
          let key = entry[0]
          let val = entry[1]
          print(key, "->", val)
        }
      `;
      const output = run(code);
      expect(output.some(line => line.includes('key -> value'))).toBe(true);
    });
  });

  describe('Records', () => {
    it('should return records from graph.getNeighbors()', () => {
      const code = `
        let g = Graph(false)
        g.addVertex(1)
        g.addVertex(2)
        g.addEdge(1, 2, 100)
        let neighbors = g.getNeighbors(1)
        for edge in neighbors {
          print("to:", edge["to"], "weight:", edge["weight"])
        }
      `;
      const output = run(code);
      expect(output.some(line => line.includes('to: 2 weight: 100'))).toBe(true);
    });

    it('should return records from graph.getEdges()', () => {
      const code = `
        let g = Graph(true)
        g.addVertex(1)
        g.addVertex(2)
        g.addEdge(1, 2, 50)
        let edges = g.getEdges()
        for edge in edges {
          print("from:", edge["from"], "to:", edge["to"], "weight:", edge["weight"])
        }
      `;
      const output = run(code);
      expect(output.some(line => line.includes('from: 1 to: 2 weight: 50'))).toBe(true);
    });

    it('should support records with string node types', () => {
      const code = `
        let g = Graph(false)
        g.addVertex("A")
        g.addVertex("B")
        g.addEdge("A", "B", 10)
        let neighbors = g.getNeighbors("A")
        for edge in neighbors {
          print("to:", edge["to"], "weight:", edge["weight"])
        }
      `;
      const output = run(code);
      expect(output.some(line => line.includes('to: B weight: 10'))).toBe(true);
    });

    it('should display record toString correctly', () => {
      const code = `
        let g = Graph(false)
        g.addVertex(1)
        g.addVertex(2)
        g.addEdge(1, 2, 99)
        let neighbors = g.getNeighbors(1)
        for edge in neighbors {
          print(edge)
        }
      `;
      const output = run(code);
      // Record toString should show { to: 2, weight: 99 }
      expect(output.some(line => line.includes('to:') && line.includes('weight:'))).toBe(true);
    });
  });

  describe('Polymorphic Graph Types', () => {
    it('should handle integer graph nodes', () => {
      const code = `
        let g = Graph(false)
        g.addVertex(100)
        g.addVertex(200)
        g.addEdge(100, 200, 5)
        let vertices = g.getVertices()
        print(vertices)
      `;
      const output = run(code);
      expect(output.some(line => line.includes('100') && line.includes('200'))).toBe(true);
    });

    it('should handle string graph nodes', () => {
      const code = `
        let g = Graph(true)
        g.addVertex("Alice")
        g.addVertex("Bob")
        g.addEdge("Alice", "Bob", 3)
        let edges = g.getEdges()
        for edge in edges {
          print(edge["from"], "->", edge["to"])
        }
      `;
      const output = run(code);
      expect(output.some(line => line.includes('Alice -> Bob'))).toBe(true);
    });
  });

  describe('Map Methods', () => {
    it('should return correct types from keys()', () => {
      const code = `
        let m = Map()
        m.set("a", 1)
        m.set("b", 2)
        let keys = m.keys()
        print(keys)
      `;
      const output = run(code);
      expect(output.some(line => line.includes('a') && line.includes('b'))).toBe(true);
    });

    it('should return correct types from values()', () => {
      const code = `
        let m = Map()
        m.set("x", 10)
        m.set("y", 20)
        let values = m.values()
        print(values)
      `;
      const output = run(code);
      expect(output.some(line => line.includes('10') && line.includes('20'))).toBe(true);
    });
  });
});
