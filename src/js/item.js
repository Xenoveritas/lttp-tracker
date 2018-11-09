"use strict";

import EventEmitter from './eventemitter.js';

/**
 * An item.
 */
export default class Item extends EventEmitter {
  /**
   * Creates a new item. These are generally created via the DB and should not
   * need to be created directly.
   */
  constructor(id, name) {
    super();
    this._id = id;
    this._name = name;
    this._held = false;
    this._env = null;
  }

  get id() { return this._id; }
  get name() { return this._name; }

  get held() { return this._held; }
  set held(value) {
    value = !!value;
    if (value !== this._held) {
      let old = this._held;
      this._held = value;
      this.fire(this.id, old, value);
      if (this._env) {
        this._env.set(this.id, value);
      }
    }
  }

  bind(environment) {
    this._env = environment;
    environment.set(this._id, this._held);
    environment.addListener(this._id, () => {
      this.held = environment.isTrue(this._id);
    });
  }
}
