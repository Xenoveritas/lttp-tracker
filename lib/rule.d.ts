export namespace Rule {
  export type ValueType = Rule | boolean;
  export type ValueListener = (name: string, value: boolean, environment: Environment) => void;

  export class Value {
    readonly value: boolean;
    constructor(environment: Environment, name: string, value: ValueType);

    setValue(environment: Environment, value: ValueType): void;
    bindRule(environment: Environment, rule: Rule): ValueType;
    unbindRule(environment: Environment): void;
    addDependent(value: ValueType): void;
    removeDependent(value: ValueType): void;
    dependencyChanged(environment: Environment): void;

    addListener(listener: ValueListener): void;
    removeListener(listener: ValueListener): void;
  }

  export class Environment {
    clear(): void;
    isTrue(name: string): boolean;
    get(name: string): boolean | undefined;
    isBoundToRule(name: string): boolean;
    set(name: string, value: ValueType): void;
    addListener(name: string, listener: ValueListener): void;
    removeListener(name: string, listener: ValueListener): void;
    keys(): Iterable<string>;
    _getBoundRules(): Map<string, Rule>;
  }

  export type RuleDefinition = unknown;
}

export class Rule {
  static TRUE: Rule;
  static FALSE: Rule;

  _fast: string | boolean | null;
  _any: Array<string | Rule>;
  _all: Array<string | Rule>;

  constructor(definition: Rule.RuleDefinition);

  evaluate(env: Rule.Environment): boolean;
  dependsOn(name: string): boolean;
  uniqueDependencyMap(): Map<string, boolean>;
  uniqueDependencies(): string[];
  toString(): string;

  static parse(definition: Rule.RuleDefinition): Rule;
}

export type RuleDefinitionList = string | Rule.RuleDefinition[];

export default Rule;