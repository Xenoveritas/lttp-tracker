/**
 * Describes the various locations.
 */

import Rule, { Environment, RuleDefinition } from './rule';

export type LocationState = 'unavailable' | 'visible' | 'available' | 'partial';

export type LocationListener = (location: Location) => void;

/**
 * Defines what's necessary for a basic location, which can be either a world
 * location or a dungeon.
 */
export interface BasicLocation {
  name: string;
  readonly totalItemCount: number;
  getAccessibleItemCount(environment: Environment): number;
  getVisibleItemCount(environment: Environment): number;
}

/**
 * Describes a location.
 */
export default class Location implements BasicLocation {
  private _required: Rule;
  private _visible: Rule;
  x: number;
  y: number;
  /**
   * The number of items at this location.
   */
  items: number;
  type: string;
  cleared = false;

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
    required: RuleDefinition,
    visible: RuleDefinition,
    x: number,
    y: number,
    items: number,
    type = 'item'
  ) {
    this._required = Rule.parse(required);
    this._visible = Rule.parse(visible);
    this.x = x;
    this.y = y;
    this.items = items;
    this.type = type;
  }

  get availableRule(): Rule {
    return this._required;
  }

  get visibleRule(): Rule {
    return this._visible;
  }

  get visibleRuleId(): string {
    return this.id + '.visible';
  }

  /**
   * Alias to the item count.
   */
  get totalItemCount(): number {
    return this.items;
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment: Environment): boolean {
    return this._required.evaluate(environment);
  }

  /**
   * Determines if this location has items that are visible.
   */
  isVisible(environment?: Environment): boolean {
    return this._visible.evaluate(environment);
  }

  /**
   * Gets the number of available items. For normal locations, this is either
   * 0 or `items`. For merge locations, it may be different based on the
   * child locations.
   * @param environment the environment to check
   */
  getAccessibleItemCount(environment: Environment): number {
    return this._required.evaluate(environment) ? this.items : 0;
  }

  /**
   * Gets the number of items that are visible, but inaccessible. For most
   * locations, this will be 0.
   * @param environment the environment to check
   */
  getVisibleItemCount(environment: Environment): number {
    // Fail-fast: almost all items are never visible as they are located within a chest
    if (this._visible === Rule.FALSE)
      return 0;
    return this._required.evaluate(environment) ? 0 : (this._visible.evaluate(environment) ? this.items : 0);
  }

  /**
   * Gets the state of this location, as one of:
   * Location.UNAVAILABLE - item is both unavailable and not visible
   * Location.VISIBLE - item cannot be retrieved but it is possible to see
   *   what it is
   * Location.AVAILABLE - item can be retrieved
   * Location.PARTIALLY_AVAILABLE - some items are available, but not all
   */
  getState(environment: Environment): LocationState {
    return this.isAvailable(environment) ? Location.AVAILABLE
      : (this.isVisible(environment) ? Location.VISIBLE : Location.UNAVAILABLE);
  }

  /**
   * Bind to the given environment. This makes it so that the environment's
   * field with the same name as the id reflects the state of the "required"
   * rule, and the name of id + ".visible" reflects the visible status.
   */
  bind(environment: Environment): void {
    environment.set(this.id, this._required);
    environment.set(this.visibleRuleId, this._visible);
  }

  /**
   * This binds a listener that indicates when the location's state changes
   * within a given environment. It is strictly a pass-through listener - it
   * binds to the underlying environment.
   * @param environment the environment to bind to
   * @param listener a listener that will fire whenever the state in that environment changes
   */
  addStateListener(environment: Environment, listener: LocationListener): void {
    const l = () => {
      listener(this);
    };
    environment.addListener(this.id, l);
    environment.addListener(this.visibleRuleId, l);
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
    super(id,
      name,
      locations.map(location => location.id),
      { any: locations.map(location => location.id + '.visible') },
      x, y,
      locations.reduce<number>((itemCount: number, location: Location) => {
        return itemCount + location.items;
      }, 0)
    );
    this._subLocations = locations;
  }

  /**
   * Determines if this location has items that are available.
   */
  isAvailable(environment: Environment): boolean {
    return this._subLocations.every(location => location.isAvailable(environment));
  }

  /**
   * Determines if this location has items that are visible. This is considered
   * true if at least one item is visible.
   */
  isVisible(environment: Environment): boolean {
    return this._subLocations.some(location => location.isVisible(environment));
  }

  /**
   * Gets the number of available items. For normal locations, this is either
   * 0 or `items`. For merge locations, it may be different based on the
   * child locations.
   * @param environment the environment to check
   */
  getAccessibleItemCount(environment: Environment): number {
    return this._subLocations.reduce<number>((itemCount: number, location: Location) => {
      return itemCount + location.getAccessibleItemCount(environment);
    }, 0);
  }

  /**
   * Gets the number of items that are visible, but inaccessible. For merge
   * locations, this is the sum of all sublocations' visible items.
   * @param environment the environment to check
   */
  getVisibleItemCount(environment: Environment): number {
    return this._subLocations.reduce<number>((itemCount: number, location: Location) => {
      return itemCount + location.getVisibleItemCount(environment);
    }, 0);
  }

  /**
   * Gets the state of this location, as one of:
   * Location.UNAVAILABLE - item is both unavailable and not visible
   * Location.VISIBLE - item cannot be retrieved but it is possible to see
   *   what it is
   * Location.AVAILABLE - item can be retrieved
   * Location.PARTIALLY_AVAILABLE - some items are available, but not all
   */
  getState(environment: Environment): LocationState {
    const available = this.getAccessibleItemCount(environment);
    if (available === this.items) {
      return Location.AVAILABLE;
    } else if (available > 0) {
      return Location.PARTIALLY_AVAILABLE;
    } else if (this._subLocations.some(location => location.isVisible(environment))) {
      return Location.VISIBLE;
    } else {
      return Location.UNAVAILABLE;
    }
  }

  bind(environment: Environment): void {
    super.bind(environment);
  }

  /**
   * This binds a listener that indicates when the location's state changes
   * within a given environment. It is strictly a pass-through listener - it
   * binds to the underlying environment.
   * @param environment the environment to bind to
   * @param listener a listener that will fire whenever the state in that environment changes
   */
  addStateListener(environment: Environment, listener: LocationListener): void {
    this._subLocations.forEach(location => location.addStateListener(environment, listener));
  }
}
