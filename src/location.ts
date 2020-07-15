/**
 * Describes the various locations.
 */

import EventEmitter from './eventemitter';
import Rule from '../lib/rule';

export type LocationState = 'unavailable' | 'visible' | 'available' | 'partial';

/**
 * Describes a location.
 */
export default class Location extends EventEmitter {
  private _required: Rule;
  private _visible: Rule;
  x: number;
  y: number;
  items: number;
  type: string;
  cleared = false;
  protected _env: Rule.Environment | null = null;
  _oldState: LocationState;

  /**
   * State when a location is entirely unavailable.
   */
  static readonly UNAVAILABLE: LocationState = 'unavailable';

  /**
   * State when items at a location are visible but not obtainable.
   */
  static readonly VISIBLE: LocationState = 'visible';

  /**
   * State when items at a location are all available.
   */
  static readonly AVAILABLE: LocationState = 'available';

  /**
   * State when items at a location are partially available.
   */
  static readonly PARTIALLY_AVAILABLE: LocationState = 'partial';

  /**
   * Creates a new location. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the location DB.
   */
  constructor(
    public readonly id: string,
    public readonly name: string,
    required: Rule.RuleDefinition,
    visible: Rule.RuleDefinition,
    x: number,
    y: number,
    items: number,
    type: string = 'item'
  ) {
    super();
    this._required = Rule.parse(required);
    this._visible = Rule.parse(visible);
    this.x = x;
    this.y = y;
    this.items = items;
    this.type = type;
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment?: Rule.Environment): boolean {
    if (!environment) {
      environment = this._env;
    }
    return this._required.evaluate(environment);
  }

  /**
   * Determines if this location has items that are visible.
   */
  isVisible(environment?: Rule.Environment): boolean {
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
  getState(environment?: Rule.Environment): LocationState {
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
  bind(environment: Rule.Environment) {
    this._env = environment;
    environment.set(this.id, this._required);
    environment.set(this.id + '.visible', this._visible);
    let listener = () => { this._checkFlags(); };
    environment.addListener(this.id, listener);
    environment.addListener(this.id + ".visible", listener);
  }

  _checkFlags() {
    let newState = this.getState(this._env);
    if (this._oldState != newState) {
      this.fire(this.id, newState, this._oldState);
      this._oldState = newState;
    }
  }

  /**
   * Merge multiple locations into one. Generates a new MergeLocation.
   */
  static merge(id: string, name: string, x: number, y: number, locations: Location[]): MergeLocation {
    return new MergeLocation(id, name, x, y, locations);
  }
}

/**
 * A "Merge Location" is a special location that merges multiple locations into
 * a single location on the map. It becomes "available" when its child locations
 * are available.
 */
export class MergeLocation extends Location {
  private _subLocations: Location[];
  constructor(id: string, name: string, x: number, y: number, locations: Location[]) {
    super(id, name, false, false, x, y, 0);
    this._subLocations = locations;
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment: Rule.Environment) {
    return this._subLocations.every(location => location.isAvailable(environment));
  }

  /**
   * Determines if this location has items that are visible.
   */
  isVisible(environment: Rule.Environment) {
    return this._subLocations.every(location => location.isVisible(environment));
  }

  /**
   * Gets the state of this location, as one of:
   * Location.UNAVAILABLE - item is both unavailable and not visible
   * Location.VISIBLE - item cannot be retrieved but it is possible to see
   *   what it is
   * Location.AVAILABLE - item can be retrieved
   * Location.PARTIALLY_AVAILABLE - some items are available, but not all
   */
  getState(environment: Rule.Environment): LocationState {
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

  bind(environment: Rule.Environment): void {
    super.bind(environment);
    // Bind a listener for all of our sub locations
    let listener = () => { this._checkFlags(); };
    for (let subloc of this._subLocations) {
      environment.addListener(subloc.id, listener);
      environment.addListener(subloc.id + ".visible", listener);
    }
  }
}
