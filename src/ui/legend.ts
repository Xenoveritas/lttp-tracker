"use strict";

/**
 * UI for displaying a legend of all items. (Also used to test the sprites.)
 */

function capitalize(str) {
  return str.substring(0,1).toUpperCase() + str.substring(1);
}

function makeIcon(cssClass: string): HTMLDivElement {
  let icon = document.createElement('div');
  icon.className = cssClass;
  icon.style.display = 'inline-block';
  return icon;
}

function makeItemIcon(id: string, held = false): HTMLDivElement {
  let icon = makeIcon('item item-' + id);
  if (held) {
    icon.className += ' held';
  }
  return icon;
}

function makePinEntry(id: string, name?: string): HTMLLIElement {
  if (!name) {
    name = capitalize(id);
  }
  let li = document.createElement('li');
  li.append(makeIcon('pin ' + id));
  li.append(' ' + name);
  return li;
}

function makeDungeonPinEntry(items?: string, bossDefeatable?: boolean) {
  let state = 'open';
  if (arguments.length == 0) {
    state = 'closed';
    items = 'none';
    bossDefeatable = false;
  }
  let name = ' Dungeon (' + capitalize(state);
  if (items === 'none') {
    name += ', No Items';
  } else {
    name += ', ' + capitalize(items) + ' Items';
  }
  if (bossDefeatable) {
    name += ', Boss Defeatable)';
  } else {
    name += ', Boss Not Available)';
  }
  let li = document.createElement('li');
  let icon = makeIcon('pin dungeon ' + state);
  let itemIcon = document.createElement('div');
  itemIcon.className = 'items items-' + items;
  icon.append(itemIcon);
  let bossIcon = document.createElement('div');
  bossIcon.className = 'boss boss-' + (bossDefeatable ? 'defeatable' : 'unavailable');
  icon.append(bossIcon);
  li.append(icon);
  li.append(name);
  return li;
}

function makePrizeEntry(prize) {
  let css = 'prize';
  if (prize) {
    css += ' ' + prize;
  }
  let icon = makeIcon(css), li = document.createElement('li');
  li.append(icon);
  li.append(' ' + prize);
  return li;
}

function makeMedallionEntry(medallion: string, available = false, useable = false): HTMLLIElement {
  let css = 'medallion';
  if (medallion) {
    css += ' ' + medallion;
  }
  if (available) {
    css += ' held';
  }
  if (useable) {
    css += ' useable';
  }
  let icon = makeIcon(css), li = document.createElement('li');
  li.append(icon);
  li.append(' ' + (medallion === null ? 'Unknown' : capitalize(medallion)) + ', '
    + (available ? ('Held, ' + (useable ? 'Useable' : 'Not Useable'))
      : 'Not Held'));
  return li;
}

function makeBossEntry(boss) {
  let css = 'dungeon dungeon-' + boss;
  let li = document.createElement('li');
  li.append(makeIcon(css));
  li.append(' ');
  li.append(makeIcon(css + ' defeated'));
  li.append(' ' + boss);
  return li;
}

export default class LegendUI {
  private _div: HTMLDivElement;
  constructor(db) {
    this._div = document.createElement('div');
    let list = document.createElement('ul');
    this._div.append(list);
    for (let id in db.items) {
      let item = db.items[id], li = document.createElement('li');
      li.append(makeItemIcon(id));
      li.append(makeItemIcon(id, true));
      li.append(' ' + item.name);
      list.append(li);
    }
    // Create map icons
    list = document.createElement('ul');
    this._div.append(list);
    [ 'unavailable', 'visible', 'partial', 'available', 'cleared' ].forEach(type => {
      list.append(makePinEntry(type));
    });
    list.append(makePinEntry('pin-portal', 'Portal'));
    list.append(makePinEntry('pin-superbomb', 'Super Bomb'));
    // Not yet:
    // list.append(makePinEntry('pin-frog', 'Blacksmith Frog'));
    // list.append(makePinEntry('pin-mirror', 'Mirror Point'));
    list.append(makeDungeonPinEntry());
    [ 'none', 'partial', 'all' ].forEach(items => {
      list.append(makeDungeonPinEntry(items, false));
      list.append(makeDungeonPinEntry(items, true));
    });
    // Create dungeon icons
    list = document.createElement('ul');
    this._div.append(list);
    list.append(makePrizeEntry(null));
    for (let prize in db.prizes) {
      list.append(makePrizeEntry(prize));
    }
    list.append(makeMedallionEntry(null, false));
    list.append(makeMedallionEntry(null, true, false));
    list.append(makeMedallionEntry(null, true, true));
    for (let medallion of db.slots['medallions']) {
      list.append(makeMedallionEntry(medallion, false));
      list.append(makeMedallionEntry(medallion, true, false));
      list.append(makeMedallionEntry(medallion, true, true));
    }
    for (let dungeon in db.dungeons) {
      list.append(makeBossEntry(dungeon));
    }
  }

  get element() {
    return this._div;
  }
}
