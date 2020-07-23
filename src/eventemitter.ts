"use strict";

export type EventListener<T> = (event: T) => void;

/**
 * Simple class for handling event listeners.
 */
export default class EventEmitter<TEvent> {
  private listeners: EventListener<TEvent>[] | null = null;

  /**
   * Fires an event to every listener. (This within the events will be the
   * event emitter itself.)
   */
  fire(event: TEvent): void {
    if (this.listeners !== null) {
      for (const listener of this.listeners) {
        try {
          listener.call(this, event);
        } catch (ex) {
          console.log('Listener failed:');
          console.log(ex);
        }
      }
    }
  }

  addListener(listener: EventListener<TEvent>): void {
    if (this.listeners === null) {
      this.listeners = [];
    }
    this.listeners.push(listener);
  }

  removeListener(listener: EventListener<TEvent>): void {
    if (this.listeners !== null) {
      for (let i = 0; i < this.listeners.length; i++) {
        if (this.listeners[i] === listener) {
          this.listeners.splice(i, 1);
          break;
        }
      }
    }
  }
}
