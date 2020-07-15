"use strict";
import EventEmitter from './eventemitter';
import Rule from '../lib/rule';

/**
 * Describes a region of the map.
 */
export default class Region extends EventEmitter {
  private _requires: Rule;
  private _env: Rule.Environment;

  /**
   * Creates a new region. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the region DB.
   */
  constructor(public readonly id: string, public readonly name: string, requires: Rule.RuleDefinition) {
    super();
    this._requires = Rule.parse(requires);
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment: Rule.Environment): boolean {
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
  bind(environment: Rule.Environment): void {
    this._env = environment;
    environment.set(this.id, this._requires);
    let oldState = this._requires.evaluate(environment);
    let listener = () => {
      let newState = this._requires.evaluate(environment);
      if (oldState !== newState) {
        this.fire(newState, oldState);
        oldState = newState;
      }
    };
    environment.addListener(this.id, listener);
  }
}
