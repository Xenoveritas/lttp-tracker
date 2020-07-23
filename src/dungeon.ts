"use strict";

import Rule, { Environment, RuleDefinition } from './rule';
import { BasicLocation } from './location';

/**
 * A Boss within a dungeon. Bosses have a name and a rule for getting to them
 * and a separate rule for being able to defeat them..
 */
export class Boss {
  private _name: string;
  private _defeat: Rule;
  private _access: Rule;
  private _hasPrize: boolean;
  private _env: Environment;

  constructor(name: string, defeat: RuleDefinition, access: RuleDefinition, hasPrize = true) {
    this._name = name;
    this._defeat = Rule.parse(defeat);
    if (arguments.length < 3)
      access = true;
    this._access = Rule.parse(access);
    this._hasPrize = arguments.length >= 4 ? hasPrize : true;
  }

  get name(): string { return this._name; }
  get hasPrize(): boolean { return this._hasPrize; }

  isAccessible(environment: Environment): boolean {
    if (!environment)
      environment = this._env;
    return this._access.evaluate(environment);
  }

  isDefeatable(environment: Environment): boolean {
    if (!environment)
      environment = this._env;
    return this._access.evaluate(environment) && this._defeat.evaluate(environment);
  }

  bind(environment: Environment): void {
    this._env = environment;
    environment.set(this._name + '.access', this._access);
    environment.set(this._name + '.defeat', this._defeat);
  }
}

/**
 * An item location within a dungeon.
 */
export class ItemLocation {
  private _id: string;
  private _name: string;
  private _access: Rule;
  private _type: string;
  private _env: Environment;

  constructor(name: string, access = true, type = 'chest') {
    this._name = name;
    this._access = arguments.length > 1 ? Rule.parse(access) : Rule.TRUE;
    this._type = type;
  }

  get id(): string {
    return this._id;
  }

  isAccessible(environment: Environment): boolean {
    if (!environment)
      environment = this._env;
    return this._access.evaluate(environment);
  }

  _bind(parent: string, environment: Environment): void {
    this._env = environment;
    this._id = parent + '.' + this._name;
    environment.set(this._id, this._access);
  }
}

export type DungeonListener = (dungeon: Dungeon) => void;

/**
 * Describes a dungeon.
 */
export default class Dungeon implements BasicLocation {
  private _enter: Rule;
  private _boss: Boss;
  private _items: ItemLocation[];
  private _keys: number;
  /**
   * Not in pool is simply a list of possible actual items that are not in
   * the chest pool. (For example, the Big Key in Castle Escape drops from an
   * enemy, and is not found in a chest.)
   */
  private _notInPool: string[] | null;
  private _medallion: string | null;
  private _itemCount: number;
  public cleared = false;
  /**
   * Creates a new Dungeon. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the Dungeon DB.
   */
  constructor(
    public readonly id: string,
    public readonly name: string,
    enter: RuleDefinition, boss: Boss, items: ItemLocation[], keys: number,
    public x: number,
    public y: number, notInPool: string[] | null, medallion: string | null) {
    this._enter = Rule.parse(enter);
    this._boss = boss;
    this._items = items;
    this._keys = keys;
    this._notInPool = notInPool;
    this._medallion = medallion;
    this._itemCount = this._items.length - this._keys - 3;
    if (this._boss && this._boss.hasPrize) {
      // Boss also has something
      this._itemCount++;
    }
    if (this._notInPool) {
      this._itemCount += this._notInPool.length;
    }
  }

  /**
   * Gets the boss of this dungeon.
   */
  get boss(): Boss {
    return this._boss;
  }

  /**
   * Whether or not defeating the boss awards a prize.
   */
  get hasPrize(): boolean {
    return this._boss === null ? false : this._boss.hasPrize;
  }

  /**
   * Get the medallion, if any. (This indicates the ID of the rule.)
   */
  get medallion(): string | null {
    return this._medallion;
  }

  /**
   * Gets the total number of treasures (that is, items that aren't keys, the
   * map, or the compass) in this dungeon.
   */
  get treasureCount(): number {
    return this._itemCount;
  }

  /**
   * Gets the total number of randomizer locations, including any keys, the map,
   * and the compass in the pool.
   */
  get totalItemCount(): number {
    return this._items.length;
  }

  /**
   * Determines if this dungeon can even be entered.
   */
  isEnterable(environment: Environment): boolean {
    return this._enter.evaluate(environment);
  }

  /**
   * Determines if this dungeon can be completed (except for the boss).
   */
  isCompletable(environment: Environment): boolean {
    return this.getAccessibleItemCount(environment) >= this._items.length;
  }

  /**
   * Gets the total number of accessible items (that includes all items, even if
   * they turn out to have a key or map or compass).
   */
  getAccessibleItemCount(environment: Environment): number {
    // If you can't enter, then no items can be taken.
    if (!this.isEnterable(environment))
      return 0;
    return this._items.reduce((current, item) => {
      return item.isAccessible(environment) ? current + 1 : current;
    }, 0);
  }

  /**
   * At present, this always returns 0: item locations are never considered
   * visible but unavailable. There are a few bonk locations where this is
   * wrong: you can see what you can bonk off, but you can't get it yet. When
   * that's properly implemented, this will return something meaningful.
   */
  getVisibleItemCount(_environment: Environment): number {
    return 0;
  }

  /**
   * Determines if the boss of the dungeon can be defeated.
   */
  isBossDefeatable(environment: Environment): boolean {
    if (this._boss === null) {
      // If there is no boss, it's always defeatable, I guess.
      return true;
    }
    // TODO: Reimplement this.
    return this.isEnterable(environment) && this._boss.isDefeatable(environment);
  }

  /**
   * Adds listeners to the various fields within the environment that map when the
   * dungeon state may change.
   *
   * @param environment the environment to add the listeners to
   */
  addListener(environment: Environment, listener: DungeonListener): void {
    // For now, since there aren't a lot of things that listen to dungeons,
    // go ahead and waste memory by recreating this closure each time a
    // listener is added. In the future, it may make sense to try and
    // "cache" environment/listener pairs.
    let oldEnter = this._enter.evaluate(environment),
      oldDefeatable = this.isBossDefeatable(environment),
      oldItemCount = this.getAccessibleItemCount(environment),
      nextEvent: NodeJS.Timeout | boolean = false;
    const processEvent = () => {
      // Blank out the next event.
      nextEvent = false;
      const newEnter = this._enter.evaluate(environment),
        newDefeatable = this.isBossDefeatable(environment),
        newItemCount = this.getAccessibleItemCount(environment);
      if (oldEnter !== newEnter || oldDefeatable !== newDefeatable || oldItemCount !== newItemCount) {
        listener(this);
      }
      oldEnter = newEnter;
      oldDefeatable = newDefeatable;
      oldItemCount = newItemCount;
    }
    const l = () => {
      // Because this listener can potentially be called many times in a row,
      // rather than immediately fire again, just defer to the end of the event
      // loop, thereby only checking if we need to fire the event once.
      if (nextEvent === false) {
        nextEvent = setTimeout(processEvent, 0);
      }
    };
    environment.addListener(this.id + ".enter", l);
    if (this._boss) {
      environment.addListener(this._boss.name + '.access', l);
      environment.addListener(this._boss.name + '.defeat', l);
    }
    this._items.forEach(item => {
      environment.addListener(item.id, l);
    });
  }

  /**
   * Bind to the given environment. This binds three separate environment
   * variables:
   * id.enter - when the dungeon can be entered
   * id.completable - when the dungeon can be cleared (but not necessarily the boss)
   * id.boss - when the boss can be defeated
   * Note that the boss fields do NOT check the enter state and may be flagged
   * even when the boss isn't available.
   */
  bind(environment: Environment): void {
    environment.set(this.id + ".enter", this._enter);
    if (this._boss) {
      this._boss.bind(environment);
    }
    this._items.forEach(item => {
      item._bind(this.id, environment);
    });
  }

  static Boss = Boss;
  static ItemLocation = ItemLocation;
}