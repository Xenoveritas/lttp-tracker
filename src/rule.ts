/**
 * Event handler for values.
 */
export type ValueListener = (name: string, value: boolean, env: Environment) => void;
/**
 * A value in a rule.
 */
export type RuleValue = Rule | boolean;

export interface RuleObjectDefinition {
  any?: RuleDefinition[];
  all?: RuleDefinition[];
}
export type RuleDefinition = RuleObjectDefinition | string[] | string | boolean;

/**
 * A value within the environment. This is a local class, it is not exported.
 * Values can have listeners associated with them, and a Rule. (If a Rule is
 * connected to the value, the value is only used to see if the Rule's result
 * has changed.)
 */
class Value {
  private listeners: ValueListener[] | null = null;
  private _value: boolean;
  _rule: Rule | null = null;
  private dependents: Value[] | null = null;

  constructor(environment: Environment, private name: string, value: RuleValue) {
    this.setValue(environment, value);
  }

  get value() {
    return this._value;
  }

  /**
   * Change the value. This is a function and not a setter because it also needs
   * to know the environment doing the change.
   */
  setValue(environment: Environment, value: RuleValue) {
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
  _setEvaluatedValue(environment: Environment, value: boolean) {
    value = !!value;
    if (this._value !== value) {
      this._value = value;
      if (this.dependents !== null) {
        for (let dependent of this.dependents) {
          dependent.dependencyChanged(environment);
        }
      }
      if (this.listeners !== null) {
        for (let listener of this.listeners) {
          listener(this.name, this._value, environment);
        }
      }
    }
  }

  bindRule(environment: Environment, rule: Rule): boolean {
    // Raise on circular dependency BEFORE changing any state
    let deps = rule.uniqueDependencySet();
    if (deps.has(this.name)) {
      throw new Error(`Not making a circular dependency (cannot bind rule referring to "${this.name}" under the name "${this.name}")`);
    }
    if (this._rule) {
      // If already bound to a rule, unbind it
      this.unbindRule(environment);
    }
    this._rule = rule;
    for (let name of deps) {
      environment._get(name).addDependent(this);
    }
    return this._rule.evaluate(environment);
  }

  unbindRule(environment: Environment) {
    if (this._rule) {
      for (let name of this._rule.uniqueDependencySet()) {
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
  addDependent(value: Value) {
    if (this.dependents === null) {
      this.dependents = [ value ];
    } else {
      this.dependents.push(value);
    }
  }

  /**
   * Removes a Value as a dependent of this.
   */
  removeDependent(value: Value) {
    if (this.dependents !== null) {
      // Need to know the index
      for (let i = 0; i < this.dependents.length; i++) {
        if (this.dependents[i] === value) {
          this.dependents.splice(i, 1);
          break;
        }
      }
    }
  }

  /**
   * Receive notification that a dependency changed.
   */
  dependencyChanged(environment: Environment) {
    if (this._rule) {
      this._setEvaluatedValue(environment, this._rule.evaluate(environment));
    }
  }

  addListener(listener: ValueListener) {
    if (this.listeners === null) {
      this.listeners = [ listener ];
    } else {
      this.listeners.push(listener);
    }
  }

  removeListener(listener: ValueListener) {
    if (this.listeners !== null) {
      // Need to know the index
      for (let i = 0; i < this.listeners.length; i++) {
        if (this.listeners[i] === listener) {
          this.listeners.splice(i, 1);
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
export class Environment {
  public env = new Map<string, Value>();

  /**
   * Removes all mapped values from the environment.
   */
  clear() {
    this.env.clear();
  }

  /**
   * Evaluate a given name and see if it's true.
   */
  isTrue(name: string): boolean {
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
  get(name: string) {
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
  _get(name: string) {
    let v = this.env.get(name);
    if (v === undefined) {
      this.env.set(name, v = new Value(this, name, false));
    }
    return v;
  }

  /**
   * Test if a given name is bound to a rule.
   */
  isBoundToRule(name: string) {
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
  set(name: string, value: RuleValue) {
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
  addListener(name: string, listener: ValueListener) {
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
  removeListener(name: string, listener: ValueListener) {
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

type RulePart = string | Rule;
type BasicType = string | boolean;

function isBasicType(o: Rule | string | boolean): o is BasicType {
  return typeof o === 'string' || typeof o ==='boolean';
}

/**
 * Implementation of a rule.
 */
export default class Rule {
  /**
   * If non-null, this value will immediately be returned on evaluate. (If a
   * string, the rule will be looked up in the environment.)
   * @private
   */
  _fast: BasicType | null = null;
  _any: RulePart[] | null;
  _all: RulePart[] | null;
  /**
   * Create a new Rule. It's recommended to use Rule.parse instead of the
   * constructor directly.
   */
  constructor(definition: RuleDefinition) {
    this._any = null;
    this._all = null;
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
      if (this._all && this._any === null && this._all.length === 1 && isBasicType(this._all[0])) {
        this._fast = this._all[0];
      }
      if (this._any && this._all === null && this._any.length === 1 && isBasicType(this._any[0])) {
        this._fast = this._any[0];
      }
    } else if (typeof definition === 'boolean') {
      this._fast = definition;
    } else {
      throw new Error("Invalid rule definition: " + definition);
    }
  }

  /**
   * Evaluate this rule within an environment.
   */
  evaluate(env: Environment) {
    if (this._fast !== null) {
      if (typeof this._fast === 'string') {
        return env.isTrue(this._fast);
      } else {
        return this._fast;
      }
    }
    let evalFlag = (flag: string | Rule) => {
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
  dependsOn(name: string) {
    if (typeof this._fast === 'boolean') {
      return false;
    } else if (typeof this._fast === 'string') {
      return this._fast === name;
    }
    return this._dependsOn(name);
  }

  private _dependsOn(name: string) {
    if (this._any !== null) {
      if (this._any.some(n => {
          if (typeof n === 'string') {
            return n === name;
          } else if (typeof n === 'object') {
            return n._dependsOn(name);
          }
        })) {
        return true;
      }
    }
    if (this._all !== null) {
      if (this._all.some(n => {
          if (typeof n === 'string') {
            return n === name;
          } else if (typeof n === 'object') {
            return n._dependsOn(name);
          }
        })) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets a set of unique names within this rule.
   */
  uniqueDependencySet(): Set<string> {
    let names = new Set<string>();
    if (typeof this._fast === 'boolean') {
      return names;
    } else if (typeof this._fast === 'string') {
      names.add(this._fast);
      return names;
    }
    this._uniqueDependencies(names);
    return names;
  }

  /**
   * Internal method to find unique dependencies of this rule.
   * @param names set being built
   */
  private _uniqueDependencies(names: Set<string>) {
    if (this._any !== null) {
      this._any.forEach(name => {
        if (typeof name === 'string') {
          names.add(name);
        } else if (typeof name === 'object') {
          name._uniqueDependencies(names);
        }
      });
    }
    if (this._all !== null) {
      this._all.forEach(name => {
        if (typeof name === 'string') {
          names.add(name);
        } else if (typeof name === 'object') {
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
    return Array.from(this.uniqueDependencySet());
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

  static Environment = Environment;
  static TRUE = new Rule(true);
  static FALSE = new Rule(false);

  /**
   * Parse a rule.
   */
  static parse(definition: RuleDefinition): Rule {
    if (definition === true) {
      return Rule.TRUE;
    } else if (definition === false || definition === undefined || definition === null) {
      return Rule.FALSE;
    } else {
      return new Rule(definition);
    }
  }
}

Rule.TRUE.evaluate = function() { return true; };
Rule.FALSE.evaluate = function() { return false; };

/**
 * Parses a definition list. This is either a bare list (which is treated as an
 * "all" rule) or a list within a definition object. In any case it may not be
 * a definition object.
 */
function parseDefinitonList(list: RuleDefinition[]): RulePart[] {
  if (typeof list === 'string') {
    // This is OK: indicates that the rule is a single string.
    return [ list ];
  } else if (Array.isArray(list)) {
    // Basically a list of either other rules or strings
    let result: RulePart[] = [];
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