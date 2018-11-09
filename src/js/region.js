"use strict";
import EventEmitter from './eventemitter.js';

const Rule = require('../../lib/rule');

/**
 * Describes a region of the map.
 */
export default class Region extends EventEmitter {
  /**
   * Creates a new region. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the region DB.
   */
  constructor(id, name, requires, points) {
    super();
    this._id = id;
    this._name = name;
    this._requires = Rule.parse(requires);
    this._points = points;
  }

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment) {
    if (!environment) {
      environment = this._env;
    }
    return this._requires.evaluate(environment);
  }

  /**
   * Bind to the given environment. This makes it so that the environment's
   * field with the same name as the id reflects the state of the "requires"
   * rule.
   */
  bind(environment) {
    this._env = environment;
    environment.set(this._id, this._requires);
    let oldState = this._requires.evaluate(environment);
    let listener = () => {
      let newState = this._requires.evaluate(environment);
      if (oldState !== newState) {
        this.fire(newState, oldState);
        oldState = newState;
      }
    };
    environment.addListener(this._id, listener);
  }
}
