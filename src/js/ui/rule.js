"use strict";

class FieldLabel {
  constructor(db, name) {
    this._span = document.createElement('span');
    this._span.append(name);
    this._db = db;
    this._name = name;
    this._db.environment.addListener(name, () => { this.update(); });
    // If this is not bound to anything, make it clickable.
    if (this._db.environment.isBoundToRule(name)) {
      this._cssClass = 'label bound ';
    } else {
      this._cssClass = 'label ';
      this._span.addEventListener('click', event => {
        this._db.environment.set(this._name, !this._db.environment.isTrue(this._name));
        event.preventDefault();
      }, false);
    }
    this.update();
  }
  get element() {
    return this._span;
  }
  update() {
    this._span.className = this._cssClass + (this._db.environment.isTrue(this._name) ? 'true' : 'false');
  }
}

function createRuleHTML(db, container, rule) {
  if (rule._fast !== null) {
    if (typeof rule._fast === 'boolean') {
      let span = document.createElement('span'), value = rule._fast.toString();
      span.className = 'boolean ' + value;
      span.append(value);
      container.append(span);
    } else {
      container.append(new FieldLabel(db, rule._fast).element);
    }
  } else {
    if (rule._any) {
      let any = document.createElement('span');
      any.className = 'any';
      container.append(any);
      let splice = false;
      // Create this as a giant list of ORs
      for (let field of rule._any) {
        if (splice) {
          any.append(" OR ");
        } else {
          splice = true;
        }
        createRuleFieldHTML(db, any, field);
      }
      if (rule._all) {
        container.append(" AND ");
      }
    }
    if (rule._all) {
      let all = document.createElement('span');
      all.className = 'all';
      container.append(all);
      let splice = false;
      // Create this as a giant list of ORs
      for (let field of rule._all) {
        if (splice) {
          all.append(" AND ");
        } else {
          splice = true;
        }
        createRuleFieldHTML(db, all, field);
      }
    }
  }
}

function createRuleFieldHTML(db, container, item) {
  if (typeof item === 'string') {
    container.append(new FieldLabel(db, item).element);
  } else {
    let subrule = document.createElement('span');
    subrule.className = 'rule';
    container.append(subrule);
    createRuleHTML(db, subrule, item);
  }
}

/**
 * This is a bit of "debug UI" for debugging the internal rule state.
 */
export default class RuleUI {
  constructor(db, id, rule) {
    this._db = db;
    this._id = id;
    this._rule = rule;
    this._div = document.createElement('div');
    this._div.className = 'rule';
    this._div.append(new FieldLabel(db, id).element);
    this._div.append(": ");
    createRuleHTML(db, this._div, rule);
  }
  get element() {
    return this._div;
  }
}
