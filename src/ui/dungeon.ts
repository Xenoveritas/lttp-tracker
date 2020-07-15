import { DB } from '../db';
import Dungeon from '../dungeon';
import Rule from '../../lib/rule';
import TrackerUI from '../tracker';

/**
 * UI for dungeon information.
 */

/**
 * Class for the dungeon UI.
 */
export default class DungeonUI {
  dungeon: Dungeon;
  private _div: HTMLDivElement;
  private _className: string;
  private _prizeUI: PrizeUI;
  private _medallionUI: MedallionUI;
  private _cleared = false;
  constructor(public tracker: TrackerUI, dungeon: string, db: DB) {
    if (!(dungeon in db.dungeons)) {
      throw new Error("Unknown dungeon " + dungeon);
    }
    this.dungeon = db.dungeons[dungeon];
    // The tracker is responsible for figuring out the prize state, but needs to
    // be told when to update things.
    this._div = document.createElement('div');
    this._className = 'dungeon dungeon-' + dungeon;
    this._div.className = this._className;
    // Append a separate DIV to contain the name.
    let d = document.createElement('div');
    d.className = 'name';
    d.append(this.dungeon.name);
    this._div.append(d);
    // Mirror the dungeon chest counts
    if (this.dungeon.hasPrize) {
      // Add a prize marker
      this._div.append((this._prizeUI = new PrizeUI(this, db.prizes)).element);
    } else {
      this._prizeUI = null;
    }
    if (this.dungeon.medallion) {
      this._div.append((this._medallionUI = new MedallionUI(db, this.dungeon.medallion)).element);
    }
    this._div.addEventListener('click', () => {
      this.bossDefeated = !this.bossDefeated;
    });
  }
  get element() {
    return this._div;
  }
  get prize() {
    return this._prizeUI ? this._prizeUI.prize : null;
  }
  get bossDefeated(): boolean {
    return this._cleared;
  }
  set bossDefeated(value) {
    let newValue = !!value;
    if (newValue != this._cleared) {
      this._cleared = !!value;
      this.tracker.db.environment.set(this.dungeon.id + '.cleared', this._cleared);
      this.tracker.updatePrizes();
      this.update();
    }
  }
  update() {
    let css = this._className;
    if (this._cleared) {
      css += ' defeated';
    }
    this._div.className = css;
  }
}

type Prize = string | null;

class PrizeUI {
  private _div: HTMLDivElement;
  private _prizes: Prize[] = [ null ];
  private _prizeIndex = 0;
  constructor(public parent: DungeonUI, prizes: Record<string, unknown>) {
    this._div = document.createElement('div');
    this._div.className = 'prize';
    // Prizes is an object, not an array, but we want an array of flags.
    for (let prize in prizes) {
      this._prizes.push(prize);
    }
    this._div.addEventListener('click', event => {
      this._prizeIndex++;
      if (this._prizeIndex >= this._prizes.length)
        this._prizeIndex = 0;
      let css = 'prize';
      if (this._prizes[this._prizeIndex] !== null) {
        css += ' ' + this._prizes[this._prizeIndex];
      }
      this._div.className = css;
      this.parent.tracker.updatePrizes();
      event.stopPropagation();
    });
  }
  get element() { return this._div; }
  get prize() { return this._prizes[this._prizeIndex]; }
}

/**
 * UI for displaying the medallion used to open a dungeon.
 */
class MedallionUI {
  private _div: HTMLDivElement;
  private _ruleName: string;
  private _useRule: string;
  private _medallions: string;
  private _rules: Rule[];
  // In order to have an "unknown" option, start at -1
  private _medallionIndex = -1;
  private _env: Rule.Environment;
  constructor(db: DB, ruleName: string) {
    this._div = document.createElement('div');
    this._div.className = 'medallion';
    this._ruleName = ruleName;
    this._useRule = 'use_' + ruleName;
    this._medallions = db.slots.medallions;
    this._rules = [ Rule.parse(this._medallions) ];
    for (let medallion of this._medallions) {
      this._rules.push(Rule.parse(medallion));
    }
    this._div.addEventListener('click', event => {
      this._medallionIndex++;
      if (this._medallionIndex >= this._medallions.length) {
        this._medallionIndex = -1;
      }
      event.stopPropagation();
      this.updateRule();
      this.update();
    });
    this._env = db.environment;
    let update = () => { this.update(); };
    // Also bind to the medallions directly to reflect their held status.
    for (let medallion of db.slots.medallions) {
      db.environment.addListener(medallion, update);
    }
    // Also bind to the use rule
    db.environment.addListener(this._useRule, update);
    this.update();
  }
  get element() { return this._div; }
  update() {
    let css = 'medallion';
    if (this._medallionIndex >= 0) {
      let medallion = this._medallions[this._medallionIndex];
      css += ' ' + medallion;
    }
    if (this._env.isTrue(this._ruleName))
      css += ' held';
    if (this._env.isTrue(this._useRule))
      css += ' useable';
    this._div.className = css;
  }
  updateRule() {
    this._env.set(this._ruleName, this._rules[this._medallionIndex + 1]);
  }
}
