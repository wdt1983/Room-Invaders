// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (...args: any[]) => void;

class CustomEventEmitter {
  private events: Record<string, EventHandler[]> = {};

  on(event: string, listener: EventHandler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: unknown[]) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(...args));
    }
  }

  off(event: string, listener: EventHandler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((l) => l !== listener);
  }
}

/**
 * Simple typed event emitter for React <-> Phaser communication.
 * Avoids importing Phaser to prevent SSR "window is not defined" crashes.
 */
export const EventBus = new CustomEventEmitter();
