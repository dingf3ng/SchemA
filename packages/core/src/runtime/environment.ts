import { RuntimeTypedBinder } from './runtime-utils';

export class Environment {
  private bindings: Map<string, RuntimeTypedBinder> = new Map();
  private parent: Environment | null = null;

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  define(name: string, value: RuntimeTypedBinder): void {
    this.bindings.set(name, value);
  }

  get(name: string): RuntimeTypedBinder {
    if (this.bindings.has(name)) {
      return this.bindings.get(name)!;
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    throw new Error(`Undefined variable: ${name}`);
  }

  set(name: string, value: RuntimeTypedBinder): void {
    if (this.bindings.has(name)) {
      this.bindings.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new Error(`Cannot assign to undeclared variable: ${name}`);
  }

  has(name: string): boolean {
    if (this.bindings.has(name)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(name);
    }
    return false;
  }

  // For compatibility with existing code that uses Map methods
  entries(): IterableIterator<[string, RuntimeTypedBinder]> {
    const allEntries = new Map<string, RuntimeTypedBinder>();
    this.collectAllBindings(allEntries);
    return allEntries.entries();
  }

  /**
   * Get all bindings from this environment and parent scopes
   * Returns a Map with all variable bindings
   */
  getAllBindings(): Map<string, RuntimeTypedBinder> {
    const bindings = new Map<string, RuntimeTypedBinder>();

    // Walk up the environment chain
    let currentEnv: Environment | null = this;
    while (currentEnv) {
      const envBindings = (currentEnv as any).bindings;
      if (envBindings instanceof Map) {
        for (const [name, binding] of envBindings.entries()) {
          if (!bindings.has(name)) {
            bindings.set(name, binding);
          }
        }
      }
      currentEnv = currentEnv.parent || null;
    }

    return bindings;
  }

  private collectAllBindings(result: Map<string, RuntimeTypedBinder>): void {
    if (this.parent) {
      // @ts-ignore - private method access
      this.parent.collectAllBindings(result);
    }
    for (const [key, value] of this.bindings.entries()) {
      result.set(key, value);
    }
  }
}
