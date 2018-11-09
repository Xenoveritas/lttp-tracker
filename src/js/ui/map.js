"use strict";

/**
 * Generic pin class for placing something on the map. Takes an x, y coordinate
 * and generates a <div> that can be placed there. And that's it.
 */
class Pin {
  constructor(x, y) {
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
  get element() {
    return this.pin;
  }
}

class ItemPin extends Pin {
  constructor(location, x, y) {
    super(x, y);
    this.location = location;
    this.className = 'pin pin-' + location.id + ' ';
    this.pin.setAttribute('title', location.name);
    this.pin.addEventListener('click', (event) => {
      this.location.cleared = !this.location.cleared;
      this.update();
    }, false);
    this.location.addListener((location, state) => {
      this.update();
    });
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
      state = this.location.getState();
    }
    this.pin.className = this.className + state;
  }
}

class BasicPin extends Pin {
  constructor(location, x, y) {
    super(x, y);
    this.location = location;
    this.className = 'pin pin-' + location.type;
    this.pin.setAttribute('title', location.name);
    this.location.addListener((location, state) => {
      this.update();
    });
    this.update();
  }

  /**
   * Updates the UI state to match the model.
   */
  update() {
    let style = this.className;
    if (this.location.isAvailable()) {
      style += ' available';
    }
    this.pin.className = style;
  }
}

/**
 * A pin that represents a dungeon. Dungeons are a bit more complex.
 */
class DungeonPin extends Pin {
  constructor(dungeon, x, y) {
    super(x, y);
    this.dungeon = dungeon;
    this.className = 'pin dungeon dungeon-' + dungeon.id + ' ';
    this.pin.setAttribute('title', dungeon.name);
    this.pin.append(this.itemPinDiv = document.createElement('div'));
    this.itemPinDiv.className = 'items';
    this.pin.append(this.bossPinDiv = document.createElement('div'));
    this.bossPinDiv.className = 'boss';
    this.dungeon.addListener(() => { this.update(); });
    this.update();
  }

  /**
   * Updates the UI state to match the model.
   */
  update() {
    let state;
    if (this.dungeon.isEnterable()) {
      state = "open";
    } else {
      state = "closed";
    }
    let available = this.dungeon.getAccessibleItemCount();
    this.itemPinDiv.innerHTML = available + "/" + this.dungeon.totalItemCount;
    this.itemPinDiv.className = 'items ' + (available === 0 ? 'items-none' :
      (available < this.dungeon.totalItemCount ? 'items-partial' : 'items-all'));
    this.bossPinDiv.className = 'boss ' + (this.dungeon.isBossDefeatable() ? 'boss-defeatable' : 'boss-unavailable');
    this.pin.className = this.className + state;
  }
}

/**
 * A Map provides a map that shows locations on it. Only locations with
 * coordinates are shown.
 */
export default class MapUI {
  constructor(world, db) {
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
    for (let id in db.locations) {
      let location = db.locations[id];
      if (location.x !== null && location.y !== null) {
        if (location.x >= min && location.x < max) {
          if (location.type === 'item') {
            this._div.append(new ItemPin(location, location.x - min, location.y).element);
          } else {
            this._div.append(new BasicPin(location, location.x - min, location.y).element);
          }
        }
      }
    }
    // Add dungeons
    for (let id in db.dungeons) {
      let dungeon = db.dungeons[id];
      if (dungeon.x !== null && dungeon.y !== null) {
        if (dungeon.x >= min && dungeon.x < max) {
          this._div.append(new DungeonPin(dungeon, dungeon.x - min, dungeon.y).element);
        }
      }
    }
  }
  get element() {
    return this._container;
  }
}
