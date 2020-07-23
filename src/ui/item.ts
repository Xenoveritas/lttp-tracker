import DB from '../db';
import Item from '../item';

export type ItemLayoutDefinition = string | string[];

/**
 * Creates a UI element for an item.
 *
 * Some slots (specifically, the boomerangs, mushroom/powder, and shovel/flute)
 * share slots. Those are handled "specially", although really they still have
 * their slot, they're just shown next to each other.
 *
 * The bow is handled as a special case, as it's the only item that has four
 * distinct states as it shows two items: nothing, only bow, only silver arrows,
 * and both.
 */
export function createItemUI(item: ItemLayoutDefinition, db: DB, couldRecurseInfinitely?: boolean): ItemUI | MultiItemUI {
  if (Array.isArray(item)) {
    const uis: ItemUI[] = [];
    for (const subItem of item) {
      uis.push(new ItemUI(subItem, db));
    }
    return new MultiItemUI(uis);
  } else if (item === 'bow_and_arrows') {
    if ('bow_and_arrows' in db.slots && couldRecurseInfinitely) {
      // Extra argument is to prevent infinite recursion if someone asks for
      // bow and arrows in the bow and arrows slot
      return createItemUI(db.slots['bow_and_arrows'], db, true);
    } else {
      // oh well
      return new ItemUI('bow', db);
    }
  } else {
    return new ItemUI(item, db);
  }
}

/**
 * Creates a UI element for equipment. Equipment is nearly identical to items,
 * except that some equipment "cycles" through elements. Clicking on such items
 * progresses to the next one.
 *
 * @param id the ID of the slot, used in some cases for when the slot
 *     has nothing in it
 * @param item the item itself or an array of items
 * @param db the game DB
 */
export function createEquipmentUI(id: string, item: string | string[], db: DB): ItemUI | EquipmentUI {
  if (Array.isArray(item)) {
    return new EquipmentUI(id, item, db);
  } else {
    // Otherwise just reuse the generic item UI - the item is either present
    // or not.
    return new ItemUI(item, db);
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
 * This is the ultimate special case, because the bow is in fact two different
 * items that make more sense to treat as one. This simply cycles between
 * four different states: no bow, silver arrows, bow and arrows, and bow and
 * silver arrows.
 *
 * There is currently no way to request this and there's a good chance it's
 * going away because it's annoying.
 */
export class BowUI {
  private _div: HTMLDivElement;
  private _state = 0;
  constructor(private db: DB) {
    this._div = document.createElement('div');
    //this._div.append(this.item.name);
    this._div.addEventListener('click', event => {
      if (event.shiftKey) {
        if (event.ctrlKey) {
          // If Ctrl-Shift is held, toggle only the silver arrow state.
          this._state ^= 0x01;
        } else {
          // If only the shift key is held, go backwards (match the way
          // equipment works).
          this._state--;
          if (this._state < 0)
            this._state = 3;
        }
      } else if (event.ctrlKey) {
        // If only the ctrl key is held, toggle the bow state alone.
        this._state ^= 0x02;
      } else {
        // Otherwise, increment the state.
        this._state++;
        if (this._state > 3)
          this._state = 0;
      }
      this.update();
    }, false);
    this.update();
  }
  get element(): HTMLDivElement {
    return this._div;
  }
  get bowHeld(): boolean {
    return (this._state & 0x02) == 0x02;
  }
  set bowHeld(value: boolean) {
    this._state |= value ? 0x02 : ~0x02;
    this.update();
  }
  get silverArrowsHeld(): boolean {
    return (this._state & 0x01) == 0x01;
  }
  set silverArrowsHeld(value: boolean) {
    this._state |= value ? 0x01 : ~0x01;
    this.update();
  }
  update(): void {
    this.db.environment.set('bow', this.bowHeld);
    this.db.environment.set('silver_arrows', this.silverArrowsHeld);
    let css = 'item item-';
    if (this.silverArrowsHeld) {
      css += 'silver-bow';
    } else {
      css += 'bow';
    }
    if (this.bowHeld) {
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

export class EquipmentUI {
  private _id: string;
  private _items: Item[] = [];
  /**
   * Active item index.
   */
  private _index = 0;
  private _div: HTMLDivElement;
  constructor(id: string, items: string[], db: DB) {
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
  }
}
