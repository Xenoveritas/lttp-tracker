"use strict";
/**
 * Describes the various locations.
 */

import EventEmitter from './eventemitter.js';

const Rule = require('../../lib/rule');

/**
 * Describes a location.
 */
export default class Location extends EventEmitter {
  /**
   * Creates a new location. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the location DB.
   */
  constructor(id, name, required, visible, x, y, items, type) {
    super();
    this._id = id;
    this._name = name;
    this._required = Rule.parse(required);
    this._visible = Rule.parse(visible);
    this.x = x;
    this.y = y;
    this.items = items;
    this.type = type ? type : 'item';
    this.cleared = false;
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
    return this._required.evaluate(environment);
  }

  /**
   * Determines if this location has items that are visible.
   */
  isVisible(environment) {
    if (!environment) {
      environment = this._env;
    }
    return this._visible.evaluate(environment);
  }

  /**
   * Gets the state of this location, as one of:
   * Location.UNAVAILABLE - item is both unavailable and not visible
   * Location.VISIBLE - item cannot be retrieved but it is possible to see
   *   what it is
   * Location.AVAILABLE - item can be retrieved
   * Location.PARTIALLY_AVAILABLE - some items are available, but not all
   */
  getState(environment) {
    if (!environment) {
      environment = this._env;
    }
    return this.isAvailable(environment) ? Location.AVAILABLE
      : (this.isVisible(environment) ? Location.VISIBLE : Location.UNAVAILABLE);
  }

  /**
   * Bind to the given environment. This makes it so that the environment's
   * field with the same name as the id reflects the state of the "required"
   * rule, and the name of id + ".visible" reflects the visible status.
   */
  bind(environment) {
    this._env = environment;
    environment.set(this._id, this._required);
    environment.set(this._id + '.visible', this._visible);
    let listener = () => { this._checkFlags(); };
    environment.addListener(this._id, listener);
    environment.addListener(this._id + ".visible", listener);
  }

  _checkFlags() {
    let newState = this.getState(this._env);
    if (this._oldState != newState) {
      this.fire(this._id, newState, this._oldState);
      this._oldState = newState;
    }
  }
}

/**
 * State when a location is entirely unavailable.
 */
Location.UNAVAILABLE = 'unavailable';
/**
 * State when items at a location are visible but not obtainable.
 */
Location.VISIBLE = 'visible';
/**
 * State when items at a location are all available.
 */
Location.AVAILABLE = 'available';
/**
 * State when items at a location are partially available.
 */
Location.PARTIALLY_AVAILABLE = 'partial';

/**
 * A "Merge Location" is a special location that merges multiple locations into
 * a single location on the map. It becomes "available" when its child locations
 * are available.
 */
export class MergeLocation extends Location {
  constructor(id, name, x, y, locations) {
    super(id, name, false, false, x, y);
    this._subLocations = locations;
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(db) {
    return this._subLocations.every(location => location.isAvailable(db));
  }

  /**
   * Determines if this location has items that are visible.
   */
  isVisible(db) {
    return this._subLocations.every(location => location.isVisible(db));
  }

  /**
   * Gets the state of this location, as one of:
   * Location.UNAVAILABLE - item is both unavailable and not visible
   * Location.VISIBLE - item cannot be retrieved but it is possible to see
   *   what it is
   * Location.AVAILABLE - item can be retrieved
   * Location.PARTIALLY_AVAILABLE - some items are available, but not all
   */
  getState(environment) {
    if (!environment) {
      environment = this._env;
    }
    let partial = false, available = true, visible = true;
    for (let location of this._subLocations) {
      if (location.isAvailable(environment)) {
        partial = true;
      } else {
        available = false;
      }
      if (!location.isVisible(environment)) {
        visible = false;
      }
    }
    return available ? Location.AVAILABLE
      : (partial ? Location.PARTIALLY_AVAILABLE : (visible ? Location.VISIBLE : Location.UNAVAILABLE));
  }

  bind(environment) {
    super.bind(environment);
    // Bind a listener for all of our sub locations
    let listener = () => { this._checkFlags(); };
    for (let subloc of this._subLocations) {
      environment.addListener(subloc.id, listener);
      environment.addListener(subloc.id + ".visible", listener);
    }
  }
}

/**
 * Merge multiple locations into one. Generates a new MergeLocation.
 */
Location.merge = function(id, name, x, y, locations) {
  return new MergeLocation(id, name, x, y, locations);
}
