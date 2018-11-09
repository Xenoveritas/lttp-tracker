"use strict";

import EventEmitter from './eventemitter.js';

const Rule = require('../../lib/rule');

/**
 * A Boss within a dungeon. Bosses have a name and a rule for getting to them
 * and a separate rule for being able to defeat them..
 */
export class Boss {
  constructor(name, defeat, access, hasPrize) {
    this._name = name;
    this._defeat = Rule.parse(defeat);
    if (arguments.length < 3)
      access = true;
    this._access = Rule.parse(access);
    this._hasPrize = arguments.length >= 4 ? hasPrize : true;
  }

  get name() { return this._name; }
  get hasPrize() { return this._hasPrize; }

  isAccessible(environment) {
    if (!environment)
      environment = this._env;
    return this._access.evaluate(environment);
  }

  isDefeatable(environment) {
    if (!environment)
      environment = this._env;
    return this._access.evaluate(environment) && this._defeat.evaluate(environment);
  }

  bind(environment) {
    this._env = environment;
    environment.set(this._name + '.access', this._access);
    environment.set(this._name + '.defeat', this._defeat);
  }
}

/**
 * An item location within a dungeon.
 */
export class Item {
  constructor(name, access, type) {
    this._name = name;
    this._access = arguments.length > 1 ? Rule.parse(access) : Rule.TRUE;
    this._type = arguments.length > 2 ? type : 'chest';
  }

  isAccessible(environment) {
    if (!environment)
      environment = this._env;
    return this._access.evaluate(environment);
  }

  _bind(parent, environment) {
    this._env = environment;
    this._id = parent + '.' + this._name;
    environment.set(this._id, this._access);
    return this._id;
  }
}

/**
 * Describes a dungeon.
 */
export default class Dungeon extends EventEmitter {
  /**
   * Creates a new Dungeon. This really isn't intended to be used directly and
   * should instead instances should be retrieved from the Dungeon DB.
   */
  constructor(id, name, enter, boss, items, keys, x, y, notInPool, medallion) {
    super();
    this._id = id;
    this._name = name;
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
    this.x = x;
    this.y = y;
    this.cleared = false;
  }

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  /**
   * Whether or not defeating the boss awards a prize.
   */
  get hasPrize() {
    return this._boss === null ? false : this._boss.hasPrize;
  }

  /**
   * Get the medallion, if any. (This indicates the ID of the rule.)
   */
  get medallion() {
    return this._medallion;
  }

  /**
   * Gets the total number of treasures (that is, items that aren't keys, the
   * map, or the compass) in this dungeon.
   */
  get treasureCount() {
    return this._itemCount;
  }

  /**
   * Gets the total number of randomizer locations, including any keys, the map,
   * and the compass in the pool.
   */
  get totalItemCount() {
    return this._items.length;
  }

  /**
   * Determines if this dungeon can even be entered.
   */
  isEnterable(environment) {
    if (!environment) {
      environment = this._env;
    }
    return this._enter.evaluate(environment);
  }

  /**
   * Determines if this dungeon can be completed (except for the boss).
   */
  isCompletable(environment) {
    return this.getAccessibleItemCount(environment) >= this._items.length;
  }

  /**
   * Gets the total number of accessible items (that includes all items, even if
   * they turn out to have a key or map or compass).
   */
  getAccessibleItemCount(environment) {
    if (!environment) {
      environment = this._env;
    }
    // If you can't enter, then no items can be taken.
    if (!this.isEnterable(environment))
      return 0;
    return this._items.reduce((current, item) => {
      return item.isAccessible(environment) ? current + 1 : current;
    }, 0);
  }

  /**
   * Determines if the boss of the dungeon can be defeated.
   */
  isBossDefeatable(environment) {
    if (this._boss === null) {
      // If there is no boss, it's always defeatable, I guess.
      return true;
    }
    if (!environment) {
      environment = this._env;
    }
    // TODO: Reimplement this.
    return this.isEnterable(environment) && this._boss.isDefeatable(environment);
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
  bind(environment) {
    this._env = environment;
    let oldEnter = this._enter.evaluate(environment),
      oldDefeatable = this.isBossDefeatable(environment),
      oldItemCount = this.getAccessibleItemCount(environment),
      nextEvent = false;
    let processEvent = () => {
      // Blank out the next event.
      nextEvent = false;
      let newEnter = this._enter.evaluate(environment),
        newDefeatable = this.isBossDefeatable(environment),
        newItemCount = this.getAccessibleItemCount(environment);
      if (oldEnter !== newEnter || oldDefeatable !== newDefeatable || oldItemCount !== newItemCount) {
        this.fire();
      }
      oldEnter = newEnter;
      oldDefeatable = newDefeatable;
      oldItemCount = newItemCount;
    }
    let listener = () => {
      // Because this listener can potentially be called many times in a row,
      // rather than immediately fire again, just defer to the end of the event
      // loop, thereby only checking if we need to fire the event once.
      if (nextEvent === false) {
        nextEvent = setTimeout(processEvent, 0);
      }
    };
    environment.set(this._id + ".enter", this._enter);
    if (this._boss) {
      this._boss.bind(environment);
      environment.addListener(this._boss.name + '.access', listener);
      environment.addListener(this._boss.name + '.defeat', listener);
    }
    this._items.forEach(item => {
      let id = item._bind(this._id, environment);
      environment.addListener(id, listener);
    });
    environment.addListener(this._id + ".enter", listener);
  }
}

Dungeon.Boss = Boss;
Dungeon.Item = Item;
