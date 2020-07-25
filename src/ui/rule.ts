"use strict";

import DB from "../db";
import Rule, { ListRule, LookupRule } from "../rule";

class FieldLabel {
  private _span: HTMLSpanElement;
  private _name: string;
  private _cssClass: string;
  constructor(private db: DB, name: string) {
    this._span = document.createElement('span');
    this._span.append(name);
    this._name = name;
    this.db.environment.addListener(name, () => { this.update(); });
    // If this is not bound to anything, make it clickable.
    if (this.db.environment.isBoundToRule(name)) {
      this._cssClass = 'label bound ';
    } else {
      this._cssClass = 'label ';
      this._span.addEventListener('click', event => {
        this.db.environment.set(this._name, !this.db.environment.isTrue(this._name));
        event.preventDefault();
      }, false);
    }
    this.update();
  }
  get element() {
    return this._span;
  }
  update() {
    this._span.className = this._cssClass + (this.db.environment.isTrue(this._name) ? 'true' : 'false');
  }
}

function createRuleHTML(db: DB, container: HTMLElement, rule: Rule) {
  if (rule.isIndependent()) {
    // These rules are static
    const span = document.createElement('span'), value = rule.isAlwaysTrue().toString();
    span.className = 'boolean ' + value;
    span.append(value);
    container.append(span);
  } else if (rule instanceof LookupRule) {
    container.append(new FieldLabel(db, rule.field).element);
  } else if (rule instanceof ListRule) {
    const span = document.createElement('span');
    span.className = rule.all ? 'all' : 'any';
    container.append(span);
    let splice = false;
    // Create this as a giant list of ORs
    for (const field of rule.children) {
      if (splice) {
        span.append(rule.all ? ' AND ' : ' OR ');
      } else {
        splice = true;
      }
      createRuleFieldHTML(db, span, field);
    }
  }
}

function createRuleFieldHTML(db: DB, container: HTMLElement, item: Rule) {
  const subrule = document.createElement('span');
  subrule.className = 'rule';
  container.append(subrule);
  createRuleHTML(db, subrule, item);
}

/**
 * This is a bit of "debug UI" for debugging the internal rule state.
 */
export default class RuleUI {
  private _div: HTMLDivElement;
  constructor(private db: DB, private id: string, private rule: Rule) {
    this._div = document.createElement('div');
    this._div.className = 'rule';
    this._div.append(new FieldLabel(db, id).element);
    this._div.append(": ");
    createRuleHTML(db, this._div, rule);
  }
  get element(): HTMLElement {
    return this._div;
  }
}
