/**
 * Very simple footer.
 */

import DB from "../db";

export default class FooterUI {
  private div: HTMLDivElement;
  constructor(db: DB) {
    this.div = document.createElement('div');
    this.div.className = 'footer';
    this.div.append(`ALTTPR Tracker - Logic ${db.version.date} for ALTTPR ${db.version.alttpr}`);
  }

  get element(): HTMLDivElement {
    return this.div;
  }
}