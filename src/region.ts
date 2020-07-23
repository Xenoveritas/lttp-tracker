"use strict";
import Rule, { Environment, RuleDefinition } from './rule';

/**
 * Describes a region of the map.
 */
export default class Region {
  private _requires: Rule;

  /**
   * Creates a new region. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the region DB.
   */
  constructor(public readonly id: string, public readonly name: string, requires: RuleDefinition) {
    this._requires = Rule.parse(requires);
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment: Environment): boolean {
    return this._requires.evaluate(environment);
  }

  /**
   * Bind to the given environment. This makes it so that the environment's
   * field with the same name as the id reflects the state of the "requires"
   * rule.
   */
  bind(environment: Environment): void {
    environment.set(this.id, this._requires);
  }
}
