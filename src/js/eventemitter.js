"use strict";

/**
 * Simple class for handling event listeners.
 */
export default class EventEmitter {
  constructor() {
    this._listeners = null;
    /**
     * The object that listeners receive as <code>this</code>. Defaults to
     * <code>this</code> - that's the EventEmitter instance, to be specific.
     */
    this.listenerThis = this;
  }

  /**
   * Fires an event to every listener. (This within the events will be the
   * event emitter itself.)
   */
  fire(event) {
    if (this._listeners !== null) {
      for (let listener of this._listeners) {
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
    if (this._listeners === null) {
      this._listeners = [];
    }
    this._listeners.push(listener);
  }

  removeListener(listener) {
    if (this._listeners !== null) {
      for (let i = 0; i < this._listeners.length; i++) {
        if (this._listeners[i] === listener) {
          this._listeners.splice(i, 1);
          break;
        }
      }
    }
  }
}
