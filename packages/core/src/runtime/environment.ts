import { RuntimeTypedBinder } from './values';

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
