/**
 * Event handler for values.
 */
export type ValueListener = (name: string, value: boolean, env: Environment) => void;
/**
 * A value in a rule.
 */
export type RuleValue = Rule | boolean;

export interface RuleObjectDefinition {
  any?: SubRuleDefinition[];
  // For backwards-compat, all may sometimes be only a string.
  all?: SubRuleDefinition[] | string;
}
export type SubRuleDefinition = RuleObjectDefinition | string[] | string;
export type RuleDefinition = SubRuleDefinition | boolean;

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

  get value(): boolean {
    return this._value;
  }

  /**
   * Change the value. This is a function and not a setter because it also needs
   * to know the environment doing the change.
   */
  setValue(environment: Environment, value: RuleValue): void {
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
  _setEvaluatedValue(environment: Environment, value: boolean): void {
    value = !!value;
    if (this._value !== value) {
      this._value = value;
      if (this.dependents !== null) {
        for (const dependent of this.dependents) {
          dependent.dependencyChanged(environment);
        }
      }
      if (this.listeners !== null) {
        for (const listener of this.listeners) {
          listener(this.name, this._value, environment);
        }
      }
    }
  }

  bindRule(environment: Environment, rule: Rule): boolean {
    // Raise on circular dependency BEFORE changing any state
    const deps = rule.uniqueDependencySet();
    if (deps.has(this.name)) {
      throw new Error(`Not making a circular dependency (cannot bind rule referring to "${this.name}" under the name "${this.name}")`);
    }
    if (this._rule) {
      // If already bound to a rule, unbind it
      this.unbindRule(environment);
    }
    this._rule = rule;
    for (const name of deps) {
      environment._get(name).addDependent(this);
    }
    return this._rule.evaluate(environment);
  }

  unbindRule(environment: Environment): void {
    if (this._rule) {
      for (const name of this._rule.uniqueDependencySet()) {
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
  addDependent(value: Value): void {
    if (this.dependents === null) {
      this.dependents = [ value ];
    } else {
      this.dependents.push(value);
    }
  }

  /**
   * Removes a Value as a dependent of this.
   */
  removeDependent(value: Value): void {
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
  dependencyChanged(environment: Environment): void {
    if (this._rule) {
      this._setEvaluatedValue(environment, this._rule.evaluate(environment));
    }
  }

  addListener(listener: ValueListener): void {
    if (this.listeners === null) {
      this.listeners = [ listener ];
    } else {
      this.listeners.push(listener);
    }
  }

  removeListener(listener: ValueListener): void {
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
  clear(): void {
    this.env.clear();
  }

  /**
   * Evaluate a given name and see if it's true.
   */
  isTrue(name: string): boolean {
    const v = this.env.get(name);
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
  get(name: string): boolean | undefined {
    const v = this.env.get(name);
    if (v === undefined) {
      return undefined;
    } else {
      return v.value;
    }
  }

  /**
   * Gets a Value at the given name, generating it if necessary.
   */
  _get(name: string): Value {
    let v = this.env.get(name);
    if (v === undefined) {
      this.env.set(name, v = new Value(this, name, false));
    }
    return v;
  }

  /**
   * Test if a given name is bound to a rule.
   */
  isBoundToRule(name: string): boolean {
    return this.getBoundRule(name) !== null;
  }

  getBoundRule(name: string): Rule | null {
    const v = this.env.get(name);
    return v === undefined ? null : v._rule;
  }

  /**
   * Sets a name to a value, which should either be a boolean or a Rule. Any
   * other value type will be cooerced to a boolean.
   */
  set(name: string, value: RuleValue): void {
    const v = this.env.get(name);
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
  addListener(name: string, listener: ValueListener): void {
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
  removeListener(name: string, listener: ValueListener): void {
    const v = this.env.get(name);
    if (v !== undefined) {
      v.removeListener(listener);
    }
  }

  /**
   * Gets an iterator over all keys with set values.
   */
  keys(): IterableIterator<string> {
    return this.env.keys();
  }

  /**
   * This is mostly a debug function - it gets a map of all rules that exist to
   * the rules that define them.
   */
  _getBoundRules(): Map<string, Rule> {
    const result = new Map<string, Rule>();
    this.env.forEach((value, name) => {
      if (value._rule) {
        result.set(name, value._rule);
      }
    });
    return result;
  }
}

/**
 * A Rule. There are various types of Rules but this defines the basic Rule
 * type. The most basic Rule will always evaluate to false.
 */
export default abstract class Rule {
  /**
   * Create a new Rule. Rules created like this are mostly useless - use
   * Rule.parse instead.
   * @param name an optional name for the rule, for human readable outputs
   */
  constructor(public name?: string) {
    // Nothing
  }

  /**
   * Evaluate this rule within an environment.
   */
  evaluate(_env: Environment): boolean {
    return false;
  }

  /**
   * Returns whether or not this rule is independent. Independent rules never
   * change their values. Default is false.
   */
  isIndependent(): boolean {
    return false;
  }

  /**
   * Returns whether this rule is always true regardless of environment.
   * Default is false.
   */
  isAlwaysTrue(): boolean {
    return false;
  }

  /**
   * Returns whether this rule is always false regardless of environment.
   * Default is false.
   */
  isAlwaysFalse(): boolean {
    return false;
  }

  /**
   * Determine whether or not this rule depends on a given value. Default is
   * always false.
   */
  dependsOn(_name: string): boolean {
    return false;
  }

  /**
   * Gets a set of unique names within this rule. Default creates an empty
   * set.
   */
  uniqueDependencySet(): Set<string> {
    return new Set<string>();
  }

  /**
   * Add all dependenices to the given set. Default does nothing.
   * @param _set the set to add to
   */
  addDependencies(_set: Set<string>): void {
    // Default does nothing
  }

  /**
   * Gets a list of unique names within this rule. The order is undefined.
   * Default is simply `Array.from(this.uniqueDependencySet())`.
   */
  uniqueDependencies(): string[] {
    return Array.from(this.uniqueDependencySet());
  }

  /**
   * Creates a string representation of the Rule.
   */
  toString(): string {
    return `[Rule ${this.name}]`;
  }

  static Environment = Environment;
  static TRUE: Rule;
  static FALSE: Rule;

  /**
   * Parse a rule.
   */
  static parse(definition: RuleDefinition, name?: string): Rule {
    if (definition === true) {
      return name ? new ConstantRule(true, name) : Rule.TRUE;
    } else if (definition === false || definition === undefined || definition === null) {
      return name ? new ConstantRule(false, name) : Rule.FALSE;
    } else {
      // Otherwise, the fun begins.
      return Rule.parseListRule(definition, name);
    }
  }

  static parseListRule(definition: SubRuleDefinition, name?: string): Rule {
    if (typeof definition === 'string') {
      return new LookupRule(definition, name);
    } else if (Array.isArray(definition)) {
      // A bare array is an AND list
      return new ListRule(parseRuleArray(definition), true, name);
    } else if (typeof definition === 'object') {
      // In this case it *should* have an any or and all key
      let anyRule: Rule | null = null, allRule: Rule | null = null;
      if ('any' in definition) {
        // The definition MUST be a list
        if (Array.isArray(definition.any)) {
          anyRule = new ListRule(parseRuleArray(definition.any), false, name);
        } else {
          throw new Error('Invalid value for any: ' + definition.any);
        }
      }
      if ('all' in definition) {
        // The definition MUST be a list
        if (Array.isArray(definition.all)) {
          allRule = new ListRule(parseRuleArray(definition.all), true, name);
        } else if (typeof definition.all === 'string') {
          if (anyRule === null) {
            throw new Error('all may only be a single string when combined with any');
          }
          allRule = new LookupRule(definition.all);
        }
      }
      if (anyRule === null && allRule == null) {
        throw new Error('Object missing any or all keys');
      }
      if (anyRule !== null && allRule !== null) {
        // If we have both, we have to wrap them in a surrounding all rule
        return new ListRule([anyRule, allRule], true);
      }
      return anyRule !== null ? anyRule : allRule;
    }
    // If we make it here, we couldn't parse things, so give up
    throw new Error("Invalid value in rule definition: " + definition);
  }
}

function parseRuleArray(definitions: SubRuleDefinition[]): Rule[] {
  return definitions.map((child) => Rule.parse(child));
}

/**
 * A Rule that is always a given constant. Exists mostly so it can be named.
 */
export class ConstantRule extends Rule {
  /**
   * Create a new Rule. Rules created like this are mostly useless - use
   * Rule.parse instead.
   * @param name an optional name for the rule, for human readable outputs
   */
  constructor(private readonly value: boolean, public name?: string) {
    super(name);
  }

  /**
   * Evaluate this rule within an environment.
   */
  evaluate(_env: Environment): boolean {
    return false;
  }

  /**
   * Returns whether or not this rule is independent. Independent rules never change their values.
   */
  isIndependent(): boolean {
    return true;
  }

  isAlwaysTrue(): boolean {
    return this.value;
  }

  isAlwaysFalse(): boolean {
    return !this.value;
  }

  /**
   * Creates a string representation of the Rule.
   */
  toString(): string {
    return `[Rule ${this.name ? this.name + '=' : ''}${this.value}]`;
  }
}

// And define Rule.TRUE and Rule.FALSE now.

Rule.TRUE = new ConstantRule(true, 'TRUE');
Rule.FALSE = new ConstantRule(false, 'FALSE');

/**
 * A simple rule that looks up its value in the environment.
 */
export class LookupRule extends Rule {
  constructor(public readonly field: string, name?: string) {
    super(name);
  }

  /**
   * Evaluate this rule within an environment.
   */
  evaluate(env: Environment): boolean {
    return env.isTrue(this.field);
  }

  /**
   * Returns whether or not this rule is independent. Independent rules never change their values.
   */
  isIndependent(): boolean {
    return false;
  }

  isAlwaysFalse(): boolean {
    return false;
  }

  /**
   * Determine whether or not this rule depends on a given value.
   */
  dependsOn(name: string): boolean {
    return this.field === name;
  }

  /**
   * Gets a set of unique names within this rule.
   */
  uniqueDependencySet(): Set<string> {
    return new Set<string>([ this.field ]);
  }

  /**
   * Gets a list of unique names within this rule. The order is undefined.
   */
  uniqueDependencies(): string[] {
    return [ this.field ];
  }

  addDependencies(set: Set<string>): void {
    set.add(this.field);
  }

  /**
   * Creates a string representation of the Rule.
   */
  toString(): string {
    return `[LookupRule "${this.field}"]`;
  }
}

/**
 * A List rule - a rule that contains a list of children and a comparator rule.
 */
export class ListRule extends Rule {
  /**
   * Create a new ListRule. Use Rule.parse to parse JSON rule definitions.
   * @param name an optional name for the rule, for human readable outputs
   */
  constructor(public readonly children: Rule[], public readonly all: boolean = true, name?: string) {
    super(name);
    for (const child of children) {
      if (!child) {
        throw new Error('Missing child in list rule');
      }
    }
  }

  /**
   * Evaluate this rule within an environment.
   */
  evaluate(env: Environment): boolean {
    if (this.all) {
      return this.children.every((rule) => rule.evaluate(env));
    } else {
      return this.children.some((rule) => rule.evaluate(env));
    }
  }

  /**
   * Returns whether or not this rule is independent. Independent rules never change their values.
   */
  isIndependent(): boolean {
    return false;
  }

  isAlwaysFalse(): boolean {
    return false;
  }

  /**
   * Determine whether or not this rule depends on a given value.
   */
  dependsOn(name: string): boolean {
    return this.children.some((rule) => rule.dependsOn(name));
  }

  /**
   * Gets a set of unique names within this rule.
   */
  uniqueDependencySet(): Set<string> {
    const names = new Set<string>();
    this.addDependencies(names);
    return names;
  }

  /**
   * @param set the set to add to
   */
  addDependencies(set: Set<string>): void {
    for (const child of this.children) {
      child.addDependencies(set);
    }
  }

  /**
   * Creates a string representation of the Rule.
   */
  toString(): string {
    return `[ListRule ${this.children.join(this.all ? ' & ' : ' | ')}]`;
  }
}