import makeDB, { LOGICS, TrackerDataBase, LayoutDefinition } from './data.cson';

import Rule from './rule';
import Item from './item';
import Region from './region';
import Location from './location';
import Dungeon from './dungeon';

interface VersionInfo {
  date: string;
  alttpr: string;
}

/**
 * The DB contains information about the various items, dungeons, locations,
 * and other information stored within the game. It maintains an Environment
 * that maps these flags and deals with the various Rules that define when
 * things are available.
 */
export default class DB {
  readonly environment = new Rule.Environment();
  rules: Record<string, Rule>;
  items: Record<string, Item> = { };
  regions: Record<string, Region> = { };
  locations: Record<string, Location>;
  dungeons: Record<string, Dungeon> = { };
  slots: Record<string, string>;
  prizes: Record<string, string[]>;
  layout: LayoutDefinition;
  defaults: Set<string>;
  version: VersionInfo;

  /**
   * Create a new DB using either the given logic ID or the tracker database
   * information.
   */
  constructor(logic?: string | TrackerDataBase) {
    const db: TrackerDataBase =
      typeof logic === 'string' || typeof logic === 'undefined' ?
        makeDB(logic) : logic;
    this.rules = db.rules;
    for (const item of db.items) {
      this.items[item.id] = item;
    }
    for (const region of db.regions) {
      this.regions[region.id] = region;
    }
    this.locations = db.locations;
    for (const dungeon of db.dungeons) {
      this.dungeons[dungeon.id] = dungeon;
    }
    this.slots = db.slots;
    this.prizes = db.prizes;
    this.layout = db.layout;
    this.defaults = new Set<string>(db.defaults);
    this.version = db.version;
    this.reset();
  }

  /**
   * Checks if a given ID is an item ID.
   * @param id the ID to check if it is an item
   */
  isItem(id: string): boolean {
    return id in this.items;
  }

  /**
   * Resets the database. This completely resets the environment back to its
   * original state (which also removes all bound listeners).
   */
  reset(): void {
    let id: string;
    this.environment.clear();
    for (id in this.rules) {
      this.environment.set(id, this.rules[id]);
    }
    for (id in this.regions) {
      this.regions[id].bind(this.environment);
    }
    for (id in this.locations) {
      this.locations[id].bind(this.environment);
    }
    for (id in this.dungeons) {
      this.dungeons[id].bind(this.environment);
    }
    for (id of this.defaults) {
      this.environment.set(id, true);
    }
  }

  /**
   * Performs a "soft" reset of the database. This should return all fields back
   * to their original values without removing event listeners. Events will be
   * fired as fields are reset.
   *
   * If rules have been modified, they are not modified back.
   */
  softReset(): void {
    for (const id of this.environment.keys()) {
      if (!this.environment.isBoundToRule(id))
        this.environment.set(id, this.defaults.has(id));
    }
  }

  /**
   * Map of logic IDs (that can be sent to #create) to display names for them.
   */
  static LOGICS = LOGICS;
}
