"use strict";

/**
 * A value within the environment. This is a local class, it is not exported.
 * Values can have listeners associated with them, and a Rule. (If a Rule is
 * connected to the value, the value is only used to see if the Rule's result
 * has changed.)
 */
class Value {
  constructor(environment, name, value) {
    this._name = name;
    this._listeners = null;
    this._rule = null;
    this._dependents = null;
    this.setValue(environment, value);
  }

  get value() {
    return this._value;
  }

  /**
   * Change the value. This is a function and not a setter because it also needs
   * to know the environment doing the change.
   */
  setValue(environment, value) {
    if (value instanceof Rule) {
      // This is a special case where the rule is being bound.
      value = this.bindRule(environment, value);
    } else {
      // In this case, the value is being set to something static, so unbind
      // anything we have. (If no rule is bound, this does nothing.)
      this.unbindRule(environment);
    }
    this._setEvaluatedValue(environment, value);
  }
  /**
   * Sets the evaluated value - this method sets what gets returned by the
   * value property and deals with firing events, ignoring any rule.
   */
  _setEvaluatedValue(environment, value) {
    value = !!value;
    if (this._value !== value) {
      this._value = value;
      if (this._dependents !== null) {
        for (let dependent of this._dependents) {
          dependent.dependencyChanged(environment);
        }
      }
      if (this._listeners !== null) {
        for (let listener of this._listeners) {
          listener(this._name, this._value, environment);
        }
      }
    }
  }

  bindRule(environment, rule) {
    // Raise on circular dependency BEFORE changing any state
    let deps = rule.uniqueDependencyMap();
    if (deps.has(this._name)) {
      throw new Error(`Not making a circular dependency (cannot bind rule referring to "${this._name}" under the name "${this._name}")`);
    }
    if (this._rule) {
      // If already bound to a rule, unbind it
      this.unbindRule(environment);
    }
    this._rule = rule;
    for (let name of deps.keys()) {
      environment._get(name).addDependent(this);
    }
    return this._rule.evaluate(environment);
  }

  unbindRule(environment) {
    if (this._rule) {
      for (let name of this._rule.uniqueDependencyMap().keys()) {
        environment._get(name).removeDependent(this);
      }
    }
    this._rule = null;
  }

  /**
   * Adds another Value as a dependent of this. This is used when a rule is
   * bound to a value - they act almost exactly like a listener except are
   * easier to remove when a bound rule changes (see unbindRule).
   */
  addDependent(value) {
    if (this._dependents === null) {
      this._dependents = [ value ];
    } else {
      this._dependents.push(value);
    }
  }

  /**
   * Removes a Value as a dependent of this.
   */
  removeDependent(value) {
    if (this._dependents !== null) {
      // Need to know the index
      for (let i = 0; i < this._dependents.length; i++) {
        if (this._dependents[i] === value) {
          this._dependents.splice(i, 1);
          break;
        }
      }
    }
  }

  /**
   * Receive notification that a dependency changed.
   */
  dependencyChanged(environment) {
    if (this._rule) {
      this._setEvaluatedValue(environment, this._rule.evaluate(environment));
    }
  }

  addListener(listener) {
    if (this._listeners === null) {
      this._listeners = [ listener ];
    } else {
      this._listeners.push(listener);
    }
  }

  removeListener(listener) {
    if (this._listeners !== null) {
      // Need to know the index
      for (let i = 0; i < this._listeners.length; i++) {
        if (this._listeners[i] === listener) {
          this._listeners.splice(i, 1);
          break;
        }
      }
    }
  }
}

/**
 * An Environment, which maps variable names to values. Value names can have
 * event listeners added to them to receive notification when values change.
 * Rules can be bound to the environment so that they change as well.
 */
class Environment {
  /**
   * Creates a new, empty environment.
   */
  constructor() {
    this.env = new Map();
  }

  /**
   * Removes all mapped values from the environment.
   */
  clear() {
    this.env.clear();
  }

  /**
   * Evaluate a given name and see if it's true.
   */
  isTrue(name) {
    let v = this.env.get(name);
    if (v === undefined) {
      return false;
    } else {
      return v.value;
    }
  }

  /**
   * Gets the value bound to a given name. This returns undefined if the value
   * is not bound, while #isTrue always returns a boolean.
   */
  get(name) {
    let v = this.env.get(name);
    if (v === undefined) {
      return undefined;
    } else {
      return v.value;
    }
  }

  /**
   * Gets a Value at the given name, generating it if necessary.
   */
  _get(name) {
    let v = this.env.get(name);
    if (v === undefined) {
      this.env.set(name, v = new Value(this, name, false));
    }
    return v;
  }

  /**
   * Test if a given name is bound to a rule.
   */
  isBoundToRule(name) {
    let v = this.env.get(name);
    if (v === undefined) {
      return false;
    } else {
      return v._rule !== null;
    }
  }

  /**
   * Sets a name to a value, which should either be a boolean or a Rule. Any
   * other value type will be cooerced to a boolean.
   */
  set(name, value) {
    let v = this.env.get(name);
    if (v === undefined) {
      this.env.set(name, new Value(this, name, value));
    } else {
      v.setValue(this, value);
    }
  }

  /**
   * Adds a listener to a given name, so that it will be invoked every time the
   * given value changes. If a listener is added multiple times, it will be
   * called multiple times.
   */
  addListener(name, listener) {
    let v = this.env.get(name);
    if (v === undefined) {
      this.env.set(name, v = new Value(this, name, false));
    }
    v.addListener(listener);
  }

  /**
   * Removes a listener from the given name, so that it will no longer receive
   * events. If the listener has been added multiple times, only the first
   * instance will be removed.
   */
  removeListener(name, listener) {
    let v = this.env.get(name);
    if (v !== undefined) {
      v.removeListener(listener);
    }
  }

  /**
   * Gets an iterator over all keys with set values.
   */
  keys() {
    return this.env.keys();
  }

  /**
   * This is mostly a debug function - it gets a map of all rules that exist to
   * the rules that define them.
   */
  _getBoundRules() {
    let result = new Map();
    this.env.forEach((value, name) => {
      if (value._rule) {
        result.set(name, value._rule);
      }
    });
    return result;
  }
}

/**
 * Implementation of a rule.
 */
class Rule {
  /**
   * Create a new Rule. It's recommended to use Rule.parse instead of the
   * constructor directly.
   */
  constructor(definition) {
    this._any = null;
    this._all = null;
    /**
     * If non-null, this value will immediately be returned on evaluate. (If a
     * string, the rule will be looked up in the environment.)
     * @private
     */
    this._fast = null;
    if (typeof definition === 'string') {
      this._fast = definition;
    } else if (typeof definition === 'object') {
      if (Array.isArray(definition)) {
        this._all = parseDefinitonList(definition);
      } else {
        // If the rule is an object, it can contain either "any" or "all"
        if ('any' in definition) {
          this._any = parseDefinitonList(definition['any']);
          // Empty any will always be false. Since the end result is the result
          // of both any and all, this means this rule will always be false.
          if (this._any.length === 0) {
            this._fast = false;
            return;
          }
        }
        if ('all' in definition) {
          this._all = parseDefinitonList(definition['all']);
          // Empty all will always be true. If there are no any elements, this
          // means this rull will always be true.
          if (this._all.length === 0 && this._any === null) {
            this._fast = true;
            return;
          }
        }
      }
      // If this is a generic rule (only a string) just dump it into fast and
      // be done.
      if (this._all && this._any === null && this._all.length === 1) {
        this._fast = this._all[0];
      }
      if (this._any && this._all === null && this._any.length === 1) {
        this._fast = this._any[0];
      }
    } else if (typeof definition === 'boolean') {
      this._fast = definition;
    } else {
      throw new Error("Invalid rule definition: " + definition);
    }
  }

  /**
   * Evaluate this rule.
   */
  evaluate(env) {
    if (this._fast !== null) {
      if (typeof this._fast === 'string') {
        return env.isTrue(this._fast);
      } else {
        return this._fast;
      }
    }
    let evalFlag = (flag) => {
      return (typeof flag === 'string') ? env.isTrue(flag) : flag.evaluate(env);
    };
    if (this._any && (!this._any.some(evalFlag))) {
      return false;
    }
    if (this._all && (!this._all.every(evalFlag))) {
      return false;
    }
    // If we've fallen through to here, this matches.
    return true;
  }

  /**
   * Determine whether or not this rule depends on a given value.
   */
  dependsOn(name) {
    if (typeof this._fast === 'boolean') {
      return false;
    } else if (typeof this._fast === 'string') {
      return this._fast === name;
    }
    return this._dependsOn(name);
  }

  _dependsOn(name) {
    if (this._any !== null) {
      if (this._any.some(n => {
          if (typeof name === 'string') {
            return n === name;
          } else {
            return n._dependsOn(name);
          }
        })) {
        return true;
      }
    }
    if (this._all !== null) {
      if (this._all.some(n => {
          if (typeof name === 'string') {
            return n === name;
          } else {
            return n._dependsOn(name);
          }
        })) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets a set of unique names within this rule. The Map simply has keys set to
   * true for each name referenced.
   */
  uniqueDependencyMap() {
    let names = new Map();
    if (typeof this._fast === 'boolean') {
      return names;
    } else if (typeof this._fast === 'string') {
      names.set(this._fast, true);
      return names;
    }
    this._uniqueDependencies(names);
    return names;
  }

  _uniqueDependencies(names) {
    if (this._any !== null) {
      this._any.forEach(name => {
        if (typeof name === 'string') {
          names.set(name, true);
        } else {
          name._uniqueDependencies(names);
        }
      });
    }
    if (this._all !== null) {
      this._all.forEach(name => {
        if (typeof name === 'string') {
          names.set(name, true);
        } else {
          name._uniqueDependencies(names);
        }
      });
    }
  }

  /**
   * Gets a list of unique names within this rule. The order is undefined.
   */
  uniqueDependencies() {
    if (typeof this._fast === 'boolean') {
      return [];
    } else if (typeof this._fast === 'string') {
      return [ this._fast ];
    }
    return Array.from(this.uniqueDependencyMap().keys());
  }

  /**
   * Creates a string representation of the Rule.
   */
  toString() {
    if (this._fast !== null) {
      return `[Rule ${this._fast.toString()}]`;
    } else {
      let s = '[Rule';
      if (this._any !== null) {
        s += ' any (' + this._any.join(', ') + ')';
      }
      if (this._all !== null) {
        s += ' all (' + this._all.join(', ') + ')';
      }
      return s + ']'
    }
  }
}

Rule.TRUE = new Rule(true);
Rule.TRUE.evalutate = function() { return true; };
Rule.FALSE = new Rule(false);
Rule.FALSE.evaluate = function() { return false; };

/**
 * Parses a definition list. This is either a bare list (which is treated as an
 * "all" rule) or a list within a definition object. In any case it may not be
 * a definition object.
 */
function parseDefinitonList(list) {
  if (typeof list === 'string') {
    // This is OK: indicates that the rule is a single string.
    return [ list ];
  } else if (typeof list === 'object' && Array.isArray(list)) {
    // Basically a list of either other rules or strings
    let result = [];
    for (let rule of list) {
      if (typeof rule === 'string') {
        // Just add it.
        result.push(rule);
      } else if (typeof rule === 'object') {
        result.push(Rule.parse(rule));
      } else {
        throw new Error("Invalid value in rule definition list: " + rule);
      }
    }
    return result;
  } else {
    throw new Error("Invalid value in rule definition: " + list);
  }
}

/**
 * Parse a rule.
 */
Rule.parse = function(definition) {
  if (definition === true) {
    return Rule.TRUE;
  } else if (definition === false || definition === undefined || definition === null) {
    return Rule.FALSE;
  } else {
    return new Rule(definition);
  }
}

// Set up exports:
Rule.Environment = Environment;
module.exports = Rule;
