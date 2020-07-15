"use strict";

export type EventListener = (event: object) => void;

/**
 * Simple class for handling event listeners.
 */
export default class EventEmitter {
  private listeners: EventListener[] | null = null;
  /**
   * The object that listeners receive as <code>this</code>. Defaults to
   * <code>this</code> - that's the EventEmitter instance, to be specific.
   */
  listenerThis: object;

  /**
   * Fires an event to every listener. (This within the events will be the
   * event emitter itself.)
   */
  fire(...args): void {
    if (this.listeners !== null) {
      for (let listener of this.listeners) {
        try {
          listener.apply(this.listenerThis, arguments);
        } catch (ex) {
          console.log('Listener failed:');
          console.log(ex);
        }
      }
    }
  }

  addListener(listener) {
    if (this.listeners === null) {
      this.listeners = [];
    }
    this.listeners.push(listener);
  }

  removeListener(listener) {
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
