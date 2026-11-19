/** Minimal ordered registry used for elements, triggers, actions, animations and drag modes. */
export class Registry<T extends { id: string }> {
  private items = new Map<string, T>();
  constructor(readonly kind: string) {}
  register(item: T): T {
    this.items.set(item.id, item);
    return item;
  }
  get(id: string): T | undefined {
    return this.items.get(id);
  }
  has(id: string): boolean {
    return this.items.has(id);
  }
  all(): T[] {
    return [...this.items.values()];
  }
}
