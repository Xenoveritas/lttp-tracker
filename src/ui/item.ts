import DB from '../db';
import Item from '../item';
import { SlotConfig } from '../data.cson';

export type ItemLayoutDefinition = string | string[];

/**
 * Creates a UI element for an item.
 *
 * Some slots (specifically, the boomerangs, mushroom/powder, and shovel/flute)
 * share slots. Those are handled "specially", although really they still have
 * their slot, they're just shown next to each other.
 */
export function createItemUI(item: ItemLayoutDefinition, db: DB): ItemUI | ProgressiveItemUI | MultiItemUI {
  if (Array.isArray(item)) {
    const uis: ItemUI[] = [];
    for (const subItem of item) {
      uis.push(new ItemUI(subItem, db));
    }
    return new MultiItemUI(uis);
  } else {
    if (item in db.slots) {
      // Indicates a progressive upgrade
      return new ProgressiveItemUI(item, db.slots[item], db);
    } else {
      return new ItemUI(item, db);
    }
  }
}

export class ItemUI {
  item: Item;
  private _div: HTMLDivElement;
  private _cssClass: string;
  constructor(item: string, public db: DB) {
    // Item is currently a string ID, so get the actual item.
    this.item = db.items[item];
    if (this.item === undefined) {
      throw new Error("Unknown item " + item);
    }
    this.db = db;
    this._div = document.createElement('div');
    this._div.setAttribute('title', this.item.name);
    this._cssClass = 'item item-' + item;
    //this._div.append(this.item.name);
    this._div.addEventListener('click', () => {
      this.item.toggleHeld(this.db.environment);
      this.update();
    }, false);
    this.db.environment.addListener(this.item.id, () => { this.update(); });
    this.update();
  }

  get element(): HTMLDivElement {
    return this._div;
  }

  update(): void {
    let css = this._cssClass;
    if (this.item.isHeld(this.db.environment)) {
      css += ' held';
    }
    this._div.className = css;
  }
}

/**
 * Deals with items that are really multiple items. All this does is wrap
 * multiple ItemUIs into a single <div>.
 */
export class MultiItemUI {
  private _div: HTMLDivElement;
  constructor(public subUIs: ItemUI[]) {
    this._div = document.createElement('div');
    this._div.className = 'shared-item-slot';
    for (const subUI of subUIs) {
      this._div.append(subUI.element);
    }
  }

  get element(): HTMLDivElement {
    return this._div;
  }
}

/**
 * UI that cycles through items. Used for most equipment slots, but also for
 * any progressive items in the regular item set (namely, the bow).
 */
export class ProgressiveItemUI {
  private _id: string;
  private name: string;
  private _items: Item[] = [];
  /**
   * Active item index.
   */
  private _index = 0;
  private _div: HTMLDivElement;
  constructor(id: string, config: SlotConfig, db: DB) {
    this.name = config.name;
    const items = config.items;
    this._id = id;
    for (let i = 0; i < items.length; i++) {
      if (items[i] === null) {
        // This is allowed! Null means "blank."
        this._items.push(null);
        continue;
      }
      // Items are currently a string ID, so get the actual item.
      const item = db.items[items[i]];
      if (item === undefined) {
        throw new Error("Unknown item " + items[i]);
      }
      this._items.push(item);
    }
    this._div = document.createElement('div');
    //this._div.append(this.item.name);
    this._div.addEventListener('click', event => {
      let i;
      if (event.shiftKey) {
        // If the shift key is being held, go backwards instead of forwards.
        this._index--;
        if (this._index < 0) {
          this._index = this._items.length - 1;
        }
      } else {
        this._index++;
        if (this._index >= this._items.length) {
          this._index = 0;
        }
      }
      // Mark that we're holding all items through this slot.
      for (i = 0; i <= this._index; i++) {
        if (this._items[i] !== null)
          this._items[i].setHeld(db.environment, true);
      }
      // And that we're NOT holding any past it.
      for (; i < this._items.length; i++) {
        this._items[i].setHeld(db.environment, false);
      }
      this.update();
    }, false);
    this.update();
  }
  get element(): HTMLDivElement {
    return this._div;
  }
  update(): void {
    let css = 'item item-';
    if (this._items[this._index] === null) {
      css += this._id + ' slot-empty';
    } else {
      css += this._items[this._index].id + ' held';
    }
    this._div.className = css;
    this._div.title = this._items[this._index] === null ? `(No ${this.name})` : this._items[this._index].name;
  }
}
