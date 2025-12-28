import { InvariantTracker } from '../src/synthesizer';
import { RuntimeTypedBinder, Predicate } from '../src/runtime/values';
import { SchemaSet, SchemaMap, Graph } from '../src/runtime/data-structures';

describe('Advanced Predicate Checking', () => {
  describe('Graph Predicates', () => {
    test('all_weights_non_negative should pass for graph with non-negative weights', () => {
      const tracker = new InvariantTracker();
      const graph = new Graph<RuntimeTypedBinder>(true);
      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      graph.addEdge(v1, v2, 5);
      graph.addEdge(v2, v3, 3);
      graph.addEdge(v1, v3, 8);

      const graphBinder: RuntimeTypedBinder = {
        value: graph,
        type: { static: { kind: 'graph', nodeType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'all_weights_non_negative' };
      expect(tracker.check(predicate, graphBinder)).toBe(true);
    });

    test('all_weights_non_negative should fail for graph with negative weights', () => {
      const graph = new Graph<RuntimeTypedBinder>(true);
      const tracker = new InvariantTracker();
      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };

      graph.addEdge(v1, v2, -5);

      const graphBinder: RuntimeTypedBinder = {
        value: graph,
        type: { static: { kind: 'graph', nodeType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'all_weights_non_negative' };
      expect(tracker.check(predicate, graphBinder)).toBe(false);
    });

    test('no_negative_cycles should pass for graph without negative cycles', () => {
      const graph = new Graph<RuntimeTypedBinder>(true);
      const tracker = new InvariantTracker();
      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      graph.addEdge(v1, v2, 5);
      graph.addEdge(v2, v3, 3);
      graph.addEdge(v1, v3, 8);

      const graphBinder: RuntimeTypedBinder = {
        value: graph,
        type: { static: { kind: 'graph', nodeType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'no_negative_cycles' };
      expect(tracker.check(predicate, graphBinder)).toBe(true);
    });

    test('no_negative_cycles should detect negative cycles', () => {
      const tracker = new InvariantTracker();
      const graph = new Graph<RuntimeTypedBinder>(true);
      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      // Create a negative cycle: 1 -> 2 -> 3 -> 1 with total weight = 5 + 3 + (-10) = -2
      graph.addEdge(v1, v2, 5);
      graph.addEdge(v2, v3, 3);
      graph.addEdge(v3, v1, -10);

      const graphBinder: RuntimeTypedBinder = {
        value: graph,
        type: { static: { kind: 'graph', nodeType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'no_negative_cycles' };
      expect(tracker.check(predicate, graphBinder)).toBe(false);
    });
  });

  describe('Set Predicates', () => {
    test('subset_of should pass when set is a subset', () => {
      const set1 = new SchemaSet<RuntimeTypedBinder>();
      const tracker = new InvariantTracker();
      const set2 = new SchemaSet<RuntimeTypedBinder>();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      set1.add(v1);
      set1.add(v2);

      set2.add(v1);
      set2.add(v2);
      set2.add(v3);

      const setBinder: RuntimeTypedBinder = {
        value: set1,
        type: { static: { kind: 'set', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'subset_of', superset: set2 };
      expect(tracker.check(predicate, setBinder)).toBe(true);
    });

    test('subset_of should fail when set is not a subset', () => {
      const set1 = new SchemaSet<RuntimeTypedBinder>();
      const tracker = new InvariantTracker();
      const set2 = new SchemaSet<RuntimeTypedBinder>();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };
      const v4: RuntimeTypedBinder = { value: 4, type: { static: { kind: 'int' }, refinements: [] } };

      set1.add(v1);
      set1.add(v2);
      set1.add(v4);

      set2.add(v1);
      set2.add(v2);
      set2.add(v3);

      const setBinder: RuntimeTypedBinder = {
        value: set1,
        type: { static: { kind: 'set', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'subset_of', superset: set2 };
      expect(tracker.check(predicate, setBinder)).toBe(false);
    });

    test('disjoint_from should pass when sets are disjoint', () => {
      const tracker = new InvariantTracker();
      const set1 = new SchemaSet<RuntimeTypedBinder>();
      const set2 = new SchemaSet<RuntimeTypedBinder>();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };
      const v4: RuntimeTypedBinder = { value: 4, type: { static: { kind: 'int' }, refinements: [] } };

      set1.add(v1);
      set1.add(v2);

      set2.add(v3);
      set2.add(v4);

      const setBinder: RuntimeTypedBinder = {
        value: set1,
        type: { static: { kind: 'set', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'disjoint_from', other: set2 };
      expect(tracker.check(predicate, setBinder)).toBe(true);
    });

    test('disjoint_from should fail when sets have common elements', () => {
      const set1 = new SchemaSet<RuntimeTypedBinder>();
      const set2 = new SchemaSet<RuntimeTypedBinder>();
      const tracker = new InvariantTracker();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      set1.add(v1);
      set1.add(v2);

      set2.add(v2);
      set2.add(v3);

      const setBinder: RuntimeTypedBinder = {
        value: set1,
        type: { static: { kind: 'set', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'disjoint_from', other: set2 };
      expect(tracker.check(predicate, setBinder)).toBe(false);
    });
  });

  describe('Map/Distance Predicates', () => {
    test('distance_to_self_zero should pass for valid distance map', () => {
      const tracker = new InvariantTracker();
      const distMap = new SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };

      // Create nested map structure: dist[1][1] = 0, dist[2][2] = 0
      const innerMap1 = new SchemaMap<number, number>();
      innerMap1.set(1, 0);
      innerMap1.set(2, 5);

      const innerMap2 = new SchemaMap<number, number>();
      innerMap2.set(1, 5);
      innerMap2.set(2, 0);

      distMap.set(v1, innerMap1 as any);
      distMap.set(v2, innerMap2 as any);

      const mapBinder: RuntimeTypedBinder = {
        value: distMap,
        type: { static: { kind: 'map', keyType: { kind: 'int' }, valueType: { kind: 'map', keyType: { kind: 'int' }, valueType: { kind: 'int' } } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'distance_to_self_zero' };
      expect(tracker.check(predicate, mapBinder)).toBe(true);
    });

    test('triangle_inequality should pass for valid distance map', () => {
      const distMap = new SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>();
      const tracker = new InvariantTracker();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      // Create nested map: dist[1][2] = 5, dist[2][3] = 3, dist[1][3] = 7 (satisfies triangle inequality)
      const innerMap1 = new SchemaMap<number, number>();
      innerMap1.set(1, 0);
      innerMap1.set(2, 5);
      innerMap1.set(3, 7);

      const innerMap2 = new SchemaMap<number, number>();
      innerMap2.set(1, 5);
      innerMap2.set(2, 0);
      innerMap2.set(3, 3);

      const innerMap3 = new SchemaMap<number, number>();
      innerMap3.set(1, 7);
      innerMap3.set(2, 3);
      innerMap3.set(3, 0);

      distMap.set(v1, innerMap1 as any);
      distMap.set(v2, innerMap2 as any);
      distMap.set(v3, innerMap3 as any);

      const mapBinder: RuntimeTypedBinder = {
        value: distMap,
        type: { static: { kind: 'map', keyType: { kind: 'int' }, valueType: { kind: 'map', keyType: { kind: 'int' }, valueType: { kind: 'int' } } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'triangle_inequality' };
      expect(tracker.check(predicate, mapBinder)).toBe(true);
    });

    test('triangle_inequality should fail when violated', () => {
      const tracker = new InvariantTracker();
      const distMap = new SchemaMap<RuntimeTypedBinder, RuntimeTypedBinder>();

      const v1: RuntimeTypedBinder = { value: 1, type: { static: { kind: 'int' }, refinements: [] } };
      const v2: RuntimeTypedBinder = { value: 2, type: { static: { kind: 'int' }, refinements: [] } };
      const v3: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };

      // Create invalid map: dist[1][3] = 100 > dist[1][2] + dist[2][3] = 5 + 3 = 8
      const innerMap1 = new SchemaMap<number, number>();
      innerMap1.set(1, 0);
      innerMap1.set(2, 5);
      innerMap1.set(3, 100);

      const innerMap2 = new SchemaMap<number, number>();
      innerMap2.set(1, 5);
      innerMap2.set(2, 0);
      innerMap2.set(3, 3);

      const innerMap3 = new SchemaMap<number, number>();
      innerMap3.set(1, 100);
      innerMap3.set(2, 3);
      innerMap3.set(3, 0);

      distMap.set(v1, innerMap1 as any);
      distMap.set(v2, innerMap2 as any);
      distMap.set(v3, innerMap3 as any);

      const mapBinder: RuntimeTypedBinder = {
        value: distMap,
        type: { static: { kind: 'map', keyType: { kind: 'int' }, valueType: { kind: 'map', keyType: { kind: 'int' }, valueType: { kind: 'int' } } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'triangle_inequality' };
      expect(tracker.check(predicate, mapBinder)).toBe(false);
    });
  });

  describe('Frozen Predicate', () => {
    test('frozen predicate should return true (enforcement is at type-checker level)', () => {
      const arr = [1, 2, 3];
      const tracker = new InvariantTracker();
      const arrayBinder: RuntimeTypedBinder = {
        value: arr as any,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'frozen' };
      expect(tracker.check(predicate, arrayBinder)).toBe(true);
    });
  });
});
