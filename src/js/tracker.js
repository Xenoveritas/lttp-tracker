"use strict";

/**
 * Main module for the tracker UI.
 */

import createDatabase from './db.js';
import { createItemUI, createEquipmentUI } from './ui/item.js';
import DungeonUI from './ui/dungeon.js';
import MapUI from './ui/map.js';
import RuleUI from './ui/rule.js';
import LegendUI from './ui/legend.js';

/**
 * The TrackerUI. This manages maintaining state in the web application and also
 * coordinating state between various UI elements.
 */
export default class TrackerUI {
  /**
   * Create a new TrackerUI.
   */
  constructor(logic) {
    this.db = createDatabase(logic);
    // TODO: Load defaults from local storage or something.
    // Always generate our container.
    this._container = document.createElement('div');
    this._container.className = 'alttp-tracker';
    this._needsUI = true;
    this._layout = null;
    this._dungeonUIs = null;
  }

  /**
   * The root node of the tracker. This is not added to the DOM automatically
   * and must be added by the creator of the tracker.
   */
  get element() {
    if (this._needsUI) {
      this.createUI(this.db.layout);
    }
    return this._container;
  }

  /**
   * Generates the tracker UI based on a given layout. This is automatically
   * called the first time {@link #element} is retrieved using the default
   * layout if it was never called.
   */
  createUI(layout) {
    if (arguments.length === 0) {
      layout = this.db.layout;
    } else if (Array.isArray(layout)) {
      // In this case, each string indicates what to pull in from the default
      // UI.
      let newLayout = {};
      for (let ui of layout) {
        newLayout[ui] = this.db.layout[ui];
      }
      layout = newLayout;
    }
    for (let ui in layout) {
      let config = layout[ui];
      switch (ui) {
        case 'items':
          this.createItemUI(config);
          break;
        case 'equipment':
          this.createEquipmentUI(config);
          break;
        case 'dungeons':
          this.createDungeonUI(config);
          break;
        case 'maps':
          this.createMapsUI(config);
          break;
        default:
          let div = document.createElement('div');
          div.className = 'error';
          div.append('Unknown UI component "');
          let code = document.createElement('code');
          code.append(ui);
          div.append(code);
          div.append('".');
          this._container.append(div);
      }
    }
    this._needsUI = false;
    this._layout = layout;
  }
  createItemUI(items) {
    this._itemsDiv = document.createElement('div');
    this._itemsDiv.className = 'items';
    this._container.append(this._itemsDiv);
    // Build the item UI.
    for (let row of items) {
      let rowDiv = document.createElement('div');
      rowDiv.className = 'row';
      this._itemsDiv.append(rowDiv);
      for (let item of row) {
        rowDiv.append(createItemUI(item, this.db).element);
      }
    }
  }
  createEquipmentUI(equipment) {
    this._equipmentDiv = document.createElement('div');
    this._equipmentDiv.className = 'equipment';
    this._container.append(this._equipmentDiv);
    let slots = this.db.slots;
    // Build the item UI.
    for (let id of equipment) {
      let items = (id in slots ? slots[id] : id);
      this._equipmentDiv.append(createEquipmentUI(id, items, this.db).element);
    }
  }
  createDungeonUI(dungeons) {
    this._dungeonUIs = [];
    this._dungeonsDiv = document.createElement('div');
    this._dungeonsDiv.className = 'dungeons';
    this._container.append(this._dungeonsDiv);
    // Build the item UI.
    for (let row in dungeons) {
      let rowDiv = document.createElement('div');
      rowDiv.className = 'row';
      this._dungeonsDiv.append(rowDiv);
      for (let dungeon of dungeons[row]) {
        let ui = new DungeonUI(this, dungeon, this.db);
        this._dungeonUIs.push(ui);
        rowDiv.append(ui.element);
      }
    }
  }
  createMapsUI(maps) {
    this._mapsDiv = document.createElement('div');
    this._mapsDiv.className = 'maps';
    this._container.append(this._mapsDiv);
    for (let map of maps) {
      this._mapsDiv.append(new MapUI(map, this.db).element);
    }
  }
  createSpriteDebugUI() {
    let sprites = document.createElement('div');
    this._container.append(sprites);
    sprites.append(new LegendUI(this.db).element);
  }
  createDebugUI() {
    // Get the rules
    let rules = this.db.environment._getBoundRules();
    let names = Array.from(rules.keys());
    names.sort((a, b) => { return a.localeCompare(b, "en"); });
    let debug = document.createElement('div');
    this._container.append(debug);
    for (let name of names) {
      debug.append(new RuleUI(this.db, name, rules.get(name)).element);
    }
  }

  /**
   * Resets the entire tracker back to defaults. This rebuilds the UI (as
   * resetting the environment removes all bound listeners).
   */
  reset() {
    this.db.reset();
    this._container.innerHTML = '';
    if (!this._needsUI) {
      this.createUI(this._layout);
    }
  }

  /**
   * Performs a soft reset. This does not force the entire UI back to defaults
   * and will attempt to maintain UI state. (Mostly this means that selected
   * medallions will likely be maintained.)
   */
  softReset() {
    this.db.softReset();
  }

  /**
   * Goes through all the dungeons, seeing which dungeons are complete, and
   * sets flags as necessary.
   */
  updatePrizes() {
    if (this._dungeonUIs) {
      let prizes = new Map();
      for (let ui of this._dungeonUIs) {
        if (ui.bossDefeated) {
          let prize = ui.prize;
          // It's possible that defeating the boss doesn't give a prize or
          // that the user never set a prize (the prize property doesn't tell us
          // which, but it doesn't matter).
          if (prize) {
            let current = prizes.get(prize);
            prizes.set(prize, current ? current + 1 : 1);
          }
        }
      }
      for (let prize in this.db.prizes) {
        let collection = this.db.prizes[prize], count = prizes.get(prize);
        if (count === undefined)
          count = 0;
        for (let i = 0; i < collection.length; i++) {
          this.db.environment.set(collection[i], i < count);
        }
      }
    }
  }
}
