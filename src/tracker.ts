/**
 * Main module for the tracker UI.
 */

import DB from './db';
import { createItemUI } from './ui/item';
import DungeonUI from './ui/dungeon';
import MapUI from './ui/map';
import RuleUI from './ui/rule';
import LegendUI from './ui/legend';
import FooterUI from './ui/footer';
import { LayoutDefinition, ItemLayout, EquipmentLayout, DungeonsLayout, MapsLayout } from './data.cson';

type TrackerLayout = Record<string, unknown>;

/**
 * The TrackerUI. This manages maintaining state in the web application and also
 * coordinating state between various UI elements.
 */
export default class TrackerUI {
  db: DB;
  private _container: HTMLDivElement;
  private _needsUI = true;
  private _layout: LayoutDefinition | null = null;
  private _dungeonUIs: DungeonUI[] = null;
  private _itemsDiv: HTMLDivElement;
  private _equipmentDiv: HTMLDivElement;
  private _dungeonsDiv: HTMLDivElement;
  private _mapsDiv: HTMLDivElement;
  private _footerDiv: HTMLDivElement;
  /**
   * Create a new TrackerUI.
   */
  constructor(logic?: string) {
    this.db = new DB(logic);
    // TODO: Load defaults from local storage or something.
    // Always generate our container.
    this._container = document.createElement('div');
    this._container.className = 'alttp-tracker';
  }

  /**
   * The root node of the tracker. This is not added to the DOM automatically
   * and must be added by the creator of the tracker.
   */
  get element(): HTMLDivElement {
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
  createUI(layout?: LayoutDefinition | string[]): void {
    if (arguments.length === 0) {
      layout = this.db.layout;
    } else if (Array.isArray(layout)) {
      // In this case, each string indicates what to pull in from the default
      // UI.
      const newLayout: LayoutDefinition = {};
      for (const ui of layout) {
        newLayout[ui] = this.db.layout[ui];
      }
      layout = newLayout;
    }
    for (const ui in layout) {
      switch (ui) {
        case 'items':
          this.createItemUI(layout.items);
          break;
        case 'equipment':
          this.createEquipmentUI(layout.equipment);
          break;
        case 'dungeons':
          this.createDungeonUI(layout.dungeons);
          break;
        case 'maps':
          this.createMapsUI(layout.maps);
          break;
        case 'footer':
          this.createFooterUI();
          break;
        default:
          this.createErrorUI(ui);
      }
    }
    this._needsUI = false;
    this._layout = layout;
  }
  createItemUI(items: ItemLayout): void {
    this._itemsDiv = document.createElement('div');
    this._itemsDiv.className = 'items';
    this._container.append(this._itemsDiv);
    // Build the item UI.
    for (const row of items) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'row';
      this._itemsDiv.append(rowDiv);
      for (const item of row) {
        rowDiv.append(createItemUI(item, this.db).element);
      }
    }
  }
  createEquipmentUI(equipment: EquipmentLayout): void {
    this._equipmentDiv = document.createElement('div');
    this._equipmentDiv.className = 'equipment';
    this._container.append(this._equipmentDiv);
    // Build the item UI.
    for (const id of equipment) {
      this._equipmentDiv.append(createItemUI(id, this.db).element);
    }
  }
  createDungeonUI(dungeons: DungeonsLayout): void {
    this._dungeonUIs = [];
    this._dungeonsDiv = document.createElement('div');
    this._dungeonsDiv.className = 'dungeons';
    this._container.append(this._dungeonsDiv);
    // Build the item UI.
    for (const row in dungeons) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'row';
      this._dungeonsDiv.append(rowDiv);
      for (const dungeon of dungeons[row]) {
        const ui = new DungeonUI(this, dungeon, this.db);
        this._dungeonUIs.push(ui);
        rowDiv.append(ui.element);
      }
    }
  }
  createMapsUI(maps: MapsLayout): void {
    this._mapsDiv = document.createElement('div');
    this._mapsDiv.className = 'maps';
    this._container.append(this._mapsDiv);
    for (const map of maps) {
      this._mapsDiv.append(new MapUI(map, this.db).element);
    }
  }
  createSpriteDebugUI(): void {
    const sprites = document.createElement('div');
    this._container.append(sprites);
    sprites.append(new LegendUI(this.db).element);
  }
  createDebugUI(): void {
    // Get the rules
    const rules = this.db.environment._getBoundRules();
    const names: string[] = Array.from(rules.keys());
    names.sort((a, b) => { return a.localeCompare(b, "en"); });
    const debug = document.createElement('div');
    this._container.append(debug);
    for (const name of names) {
      debug.append(new RuleUI(this.db, name, rules.get(name)).element);
    }
  }
  createFooterUI(): void {
    this._container.append(this._footerDiv = new FooterUI(this.db).element);
  }
  createErrorUI(name: string): void {
    const div = document.createElement('div');
    div.className = 'error';
    div.append('Unknown UI component "');
    const code = document.createElement('code');
    code.append(name);
    div.append(code);
    div.append('".');
    this._container.append(div);
  }

  /**
   * Resets the entire tracker back to defaults. This rebuilds the UI (as
   * resetting the environment removes all bound listeners).
   */
  reset(): void {
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
  softReset(): void {
    this.db.softReset();
  }

  /**
   * Goes through all the dungeons, seeing which dungeons are complete, and
   * sets flags as necessary.
   */
  updatePrizes(): void {
    if (this._dungeonUIs) {
      const prizes = new Map<string, number>();
      for (const ui of this._dungeonUIs) {
        if (ui.bossDefeated) {
          const prize = ui.prize;
          // It's possible that defeating the boss doesn't give a prize or
          // that the user never set a prize (the prize property doesn't tell us
          // which, but it doesn't matter).
          if (prize) {
            const current = prizes.get(prize);
            prizes.set(prize, current ? current + 1 : 1);
          }
        }
      }
      for (const prize in this.db.prizes) {
        const collection = this.db.prizes[prize];
        let count = prizes.get(prize);
        if (count === undefined)
          count = 0;
        for (let i = 0; i < collection.length; i++) {
          this.db.environment.set(collection[i], i < count);
        }
      }
    }
  }
}
