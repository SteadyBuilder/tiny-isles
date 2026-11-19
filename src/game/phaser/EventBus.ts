type StoredEventHandler = (payload: never) => void;

class SimpleEventEmitter {
  private listeners = new Map<string, Set<StoredEventHandler>>();

  public on<T = unknown>(event: string, handler: (payload: T) => void): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as StoredEventHandler);
    return this;
  }

  public once<T = unknown>(event: string, handler: (payload: T) => void): this {
    const wrapper = (payload: T) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  public off<T = unknown>(event: string, handler?: (payload: T) => void): this {
    if (!handler) {
      this.listeners.delete(event);
      return this;
    }
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler as StoredEventHandler);
      if (set.size === 0) this.listeners.delete(event);
    }
    return this;
  }

  public emit(event: string, payload?: unknown): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const handler of Array.from(set)) {
      (handler as (arg: unknown) => void)(payload);
    }
    return true;
  }

  public removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

export const EventBus = new SimpleEventEmitter();
