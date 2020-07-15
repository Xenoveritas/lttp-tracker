import makeDB, { LOGICS, TrackerDataBase, LayoutDefinition } from './data.cson';

import Rule from '../lib/rule';
import Item from './item';
import Region from './region';
import Location from './location';
import Dungeon from './dungeon';

/**
 * The DB contains information about the various items, dungeons, locations,
 * and other information stored within the game. It maintains an Environment
 * that maps these flags and deals with the various Rules that define when
 * things are available.
 */
export class DB {
  environment = new Rule.Environment();
  rules: Record<string, Rule>;
  items: Record<string, Item> = { };
  regions: Record<string, Region> = { };
  locations: Record<string, Location>;
  dungeons: Record<string, Dungeon> = { };
  slots: Record<string, string>;
  prizes: Record<string, string[]>;
  layout: LayoutDefinition;
  defaults: string[];
  /**
   * Create a new DB. This is not intended to be called directly, instead use
   * createDatabase to create a new DB.
   */
  constructor(db: TrackerDataBase) {
    this.rules = db.rules;
    for (let item of db.items) {
      this.items[item.id] = item;
    }
    for (let region of db.regions) {
      this.regions[region.id] = region;
    }
    this.locations = db.locations;
    for (let dungeon of db.dungeons) {
      this.dungeons[dungeon.id] = dungeon;
    }
    this.slots = db.slots;
    this.prizes = db.prizes;
    this.layout = db.layout;
    this.defaults = db.defaults;
    this.reset();
  }

  /**
   * Resets the database. This completely resets the environment back to its
   * original state (which also removes all bound listeners).
   */
  reset() {
    let id: string;
    this.environment.clear();
    for (id in this.rules) {
      this.environment.set(id, this.rules[id]);
    }
    for (id in this.items) {
      this.items[id].bind(this.environment);
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
  softReset() {
    let id: string, defaultSet = new Set<string>();
    for (id of this.defaults) {
      defaultSet.add(id);
    }
    for (let id of this.environment.keys()) {
      if (!this.environment.isBoundToRule(id))
        this.environment.set(id, defaultSet.has(id));
    }
  }
}

/**
 * Create a new database using the given logic.
 */
export default function createDatabase(logic?: string): DB {
  return new DB(makeDB(logic));
}

createDatabase.LOGICS = LOGICS;
