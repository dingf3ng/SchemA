import { InvariantTracker } from '../src/analyzer/synthesizer';
import { RuntimeTypedBinder } from '../src/runtime/runtime-utils';
import { Environment } from '../src/runtime/environment';
import { Predicate } from '../src/analyzer/analyzer-utils';
import { SchemaSet, SchemaMap, Graph, SchemaArray } from '../src/builtins/data-structures';

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

  describe('Numeric Predicates', () => {
    test('int_range should pass when value is within range', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 5, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'int_range', min: 0, max: 10 };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('int_range should fail when value is outside range', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 15, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'int_range', min: 0, max: 10 };
      expect(tracker.check(predicate, binder)).toBe(false);
    });

    test('positive should pass for positive numbers', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 5, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'positive', strict: true };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('positive should fail for negative numbers', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: -5, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'positive', strict: true };
      expect(tracker.check(predicate, binder)).toBe(false);
    });

    test('divisible_by should pass when divisible', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 10, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'divisible_by', divisor: 2 };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('divisible_by should fail when not divisible', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 10, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'divisible_by', divisor: 3 };
      expect(tracker.check(predicate, binder)).toBe(false);
    });

    test('parity should check for even numbers', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 4, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'parity', value: 'even' };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('parity should check for odd numbers', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'parity', value: 'odd' };
      expect(tracker.check(predicate, binder)).toBe(true);
    });
  });

  describe('Collection Predicates', () => {
    test('sorted should pass for sorted array', () => {
      const tracker = new InvariantTracker();
      const arr = new SchemaArray<RuntimeTypedBinder>();
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 2, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 3, type: { static: { kind: 'int' }, refinements: [] } });

      const binder: RuntimeTypedBinder = {
        value: arr,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'sorted', order: 'asc' };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('sorted should fail for unsorted array', () => {
      const tracker = new InvariantTracker();
      const arr = new SchemaArray<RuntimeTypedBinder>();
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 3, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 2, type: { static: { kind: 'int' }, refinements: [] } });

      const binder: RuntimeTypedBinder = {
        value: arr,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'sorted', order: 'asc' };
      expect(tracker.check(predicate, binder)).toBe(false);
    });

    test('unique_elements should pass for array with unique elements', () => {
      const tracker = new InvariantTracker();
      const arr = new SchemaArray<RuntimeTypedBinder>();
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 2, type: { static: { kind: 'int' }, refinements: [] } });

      const binder: RuntimeTypedBinder = {
        value: arr,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'unique_elements' };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('unique_elements should fail for array with duplicates', () => {
      const tracker = new InvariantTracker();
      const arr = new SchemaArray<RuntimeTypedBinder>();
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });

      const binder: RuntimeTypedBinder = {
        value: arr,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'unique_elements' };
      expect(tracker.check(predicate, binder)).toBe(false);
    });

    test('non_empty should pass for non-empty collection', () => {
      const tracker = new InvariantTracker();
      const arr = new SchemaArray<RuntimeTypedBinder>();
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });

      const binder: RuntimeTypedBinder = {
        value: arr,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'non_empty' };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('size_equals should check collection size', () => {
      const tracker = new InvariantTracker();
      const arr = new SchemaArray<RuntimeTypedBinder>();
      arr.push({ value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      arr.push({ value: 2, type: { static: { kind: 'int' }, refinements: [] } });

      const binder: RuntimeTypedBinder = {
        value: arr,
        type: { static: { kind: 'array', elementType: { kind: 'int' } }, refinements: [] }
      };

      const predicate: Predicate = { kind: 'size_equals', size: 2 };
      expect(tracker.check(predicate, binder)).toBe(true);
    });
  });

  describe('More Numeric Predicates', () => {
    test('greater_than should pass when value is greater', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 10, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'greater_than', threshold: 5 };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('greater_than should fail when value is smaller', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 3, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'greater_than', threshold: 5 };
      expect(tracker.check(predicate, binder)).toBe(false);
    });

    test('greater_equal_than should pass when value is equal', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 5, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'greater_equal_than', threshold: 5 };
      expect(tracker.check(predicate, binder)).toBe(true);
    });

    test('negative should pass for negative numbers', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: -5, type: { static: { kind: 'int' }, refinements: [] } };
      const predicate: Predicate = { kind: 'negative', strict: true };
      expect(tracker.check(predicate, binder)).toBe(true);
    });
  });

  describe('Logical Predicates', () => {
    test('not should negate predicate', () => {
      const tracker = new InvariantTracker();
      const binder: RuntimeTypedBinder = { value: 5, type: { static: { kind: 'int' }, refinements: [] } };
      const innerPredicate: Predicate = { kind: 'greater_than', threshold: 10 }; // False
      const predicate: Predicate = { kind: 'not', predicate: innerPredicate }; // True
      expect(tracker.check(predicate, binder)).toBe(true);
    });
  });

  describe('Temporal Predicates', () => {
    test('monotonic increasing should pass for increasing sequence', () => {
      const tracker = new InvariantTracker();
      const env = new Environment();
      
      // Iteration 0: x = 1
      env.define('x', { value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      tracker.recordState(env, 0);

      // Iteration 1: x = 2
      env.set('x', { value: 2, type: { static: { kind: 'int' }, refinements: [] } });
      tracker.recordState(env, 1);

      // Iteration 2: x = 3
      env.set('x', { value: 3, type: { static: { kind: 'int' }, refinements: [] } });
      tracker.recordState(env, 2);

      const predicate: Predicate = { kind: 'monotonic', direction: 'increasing', strict: true };
      const currentVal = env.get('x');
      expect(tracker.check(predicate, currentVal, 'x')).toBe(true);
    });

    test('monotonic increasing should fail for non-increasing sequence', () => {
      const tracker = new InvariantTracker();
      const env = new Environment();
      
      env.define('x', { value: 1, type: { static: { kind: 'int' }, refinements: [] } });
      tracker.recordState(env, 0);

      env.set('x', { value: 3, type: { static: { kind: 'int' }, refinements: [] } });
      tracker.recordState(env, 1);

      env.set('x', { value: 2, type: { static: { kind: 'int' }, refinements: [] } });
      tracker.recordState(env, 2);

      const predicate: Predicate = { kind: 'monotonic', direction: 'increasing', strict: true };
      const currentVal = env.get('x');
      expect(tracker.check(predicate, currentVal, 'x')).toBe(false);
    });
  });
});
