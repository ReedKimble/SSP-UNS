import { MicrostateSpace } from "../types/uns.js";

export class SpaceBuilder<K extends object> {
  private readonly indexByKey = new Map<string, number>();
  private readonly keys: K[] = [];

  register(key: K): number {
    const hash = JSON.stringify(key);
    if (this.indexByKey.has(hash)) {
      return this.indexByKey.get(hash)!;
    }
    const index = this.keys.length;
    this.keys.push(key);
    this.indexByKey.set(hash, index);
    return index;
  }

  get size(): number {
    return this.keys.length;
  }

  finalize(): MicrostateSpace<K> {
    return {
      size: this.keys.length,
      keys: [...this.keys],
      indexByKey: new Map(this.indexByKey),
    };
  }
}
