import Location from '../location';
import Dungeon from '../dungeon';
import DB from '../db';

/**
 * Generic pin class for placing something on the map. Takes an x, y coordinate
 * and generates a <div> that can be placed there. And that's it.
 */
class Pin {
  protected pin: HTMLDivElement;
  constructor(x: number, y: number) {
    // Position the pin using CSS percents to allow the map to be resized.
    x = (x / 512) * 100;
    y = (y / 512) * 100;
    /**
     * The actual pin <div>.
     */
    this.pin = document.createElement('div');
    this.pin.className = 'pin';
    this.pin.setAttribute('style', 'position: absolute; left: ' + x + '%; top: ' + y + '%;');
  }

  /**
   * The HTML element representing this location.
   */
  get element(): HTMLDivElement {
    return this.pin;
  }
}

class BasicPin extends Pin {
  className: string;
  constructor(public location: Location, x: number, y: number, protected db: DB) {
    super(x, y);
    this.className = 'pin pin-' + location.type;
    this.pin.setAttribute('title', location.name);
    this.location.addStateListener(db.environment, () => {
      this.update();
    });
    this.update();
  }

  /**
   * Updates the UI state to match the model.
   */
  update(): void {
    let style = this.className;
    if (this.location.isAvailable(this.db.environment)) {
      style += ' available';
    }
    this.pin.className = style;
  }
}

class ItemPin extends BasicPin {
  constructor(public location: Location, x: number, y: number, db: DB) {
    super(location, x, y, db);
    this.className = 'pin pin-' + location.id + ' ';
    this.pin.addEventListener('click', () => {
      this.location.cleared = !this.location.cleared;
      this.update();
    }, false);
    this.update();
  }

  /**
   * Updates the UI state to match the model.
   */
  update() {
    let state;
    if (this.location.cleared) {
      state = 'cleared';
    } else {
      state = this.location.getState(this.db.environment);
    }
    this.pin.className = this.className + state;
  }
}

/**
 * A pin that represents a dungeon. Dungeons are a bit more complex.
 */
class DungeonPin extends Pin {
  className: string;
  itemPinDiv: HTMLDivElement;
  bossPinDiv: HTMLDivElement;
  constructor(public dungeon: Dungeon, x: number, y: number, private db: DB) {
    super(x, y);
    this.className = 'pin dungeon dungeon-' + dungeon.id + ' ';
    this.pin.setAttribute('title', dungeon.name);
    this.pin.append(this.itemPinDiv = document.createElement('div'));
    this.itemPinDiv.className = 'items';
    this.pin.append(this.bossPinDiv = document.createElement('div'));
    this.bossPinDiv.className = 'boss';
    this.dungeon.addListener(this.db.environment, () => { this.update(); });
    this.update();
  }

  /**
   * Updates the UI state to match the model.
   */
  update(): void {
    let state;
    if (this.dungeon.isEnterable(this.db.environment)) {
      state = "open";
    } else {
      state = "closed";
    }
    const available = this.dungeon.getAccessibleItemCount(this.db.environment);
    this.itemPinDiv.innerHTML = available + "/" + this.dungeon.totalItemCount;
    this.itemPinDiv.className = 'items ' + (available === 0 ? 'items-none' :
      (available < this.dungeon.totalItemCount ? 'items-partial' : 'items-all'));
    this.bossPinDiv.className = 'boss ' + (this.dungeon.isBossDefeatable(this.db.environment) ? 'boss-defeatable' : 'boss-unavailable');
    this.pin.className = this.className + state;
  }
}

/**
 * A Map provides a map that shows locations on it. Only locations with
 * coordinates are shown.
 */
export default class MapUI {
  private _container: HTMLDivElement;
  private _div: HTMLDivElement;
  constructor(world: string, db: DB) {
    this._container = document.createElement('div');
    this._container.className = 'map-container ' + world;
    this._div = document.createElement('div');
    this._container.append(this._div);
    this._div.className = 'map';
    let min = 0, max = 512;
    if (world === 'dark-world') {
      min = 512;
      max = 1024;
    }
    // Grab all locations in the DB that should be on this map.
    for (const id in db.locations) {
      const location = db.locations[id];
      if (location.x !== null && location.y !== null) {
        if (location.x >= min && location.x < max) {
          if (location.type === 'item') {
            this._div.append(new ItemPin(location, location.x - min, location.y, db).element);
          } else {
            this._div.append(new BasicPin(location, location.x - min, location.y, db).element);
          }
        }
      }
    }
    // Add dungeons
    for (const id in db.dungeons) {
      const dungeon = db.dungeons[id];
      if (dungeon.x !== null && dungeon.y !== null) {
        if (dungeon.x >= min && dungeon.x < max) {
          this._div.append(new DungeonPin(dungeon, dungeon.x - min, dungeon.y, db).element);
        }
      }
    }
  }
  get element(): HTMLDivElement {
    return this._container;
  }
}
