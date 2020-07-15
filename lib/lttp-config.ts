// This mostly exists to declare types

export interface ItemConfig {
  name: string;
  slot?: string;
  type?: string;
  upgrades?: string;
  default?: boolean;
  // Useless bottle stuff
  stacks?: number;
  contains?: string[];
  superbomb?: boolean;
}

/**
 * Basic rule configuration.
 *
 * Rule definitions are used just about everywhere, so here's the basics:
 *
 * * All rules exist in an environment. Each key for each rule and each key for
 *   each item and location exists in this environment and can be used in a
 *   rule.
 * * A rule definition can contain any of the following:
 *     - A boolean (true, false) that sets the rule to always be that value
 *     - A string, that evaluates to whatever that string is in the environment
 *     - An object, that contains the following fields:
 *         * any: a list of things to logical OR together
 *         * all: a list of things to logical AND together
 *       The evaluated value of any and all will be ANDed together to create
 *       the final evaluated of the rule.
 *       Each "thing" in that list can either be a string (to look up a
 *       variable) or itself a rule using the same definition.
 *     - An array, which is treated as if it were under the "all" key above.
 *
 * Each rule has a name and description which, at present, are ignored. In
 * the future they'll likely be used to generate a "human readable" explanation
 * of how rules are evaulating, to try and answer "why does this think I
 * can/can't do thing" questions.
 */
export interface RuleConfig {
  name?: string;
  description?: string;
  requires: RuleDeclaration;
}

export type RuleDeclaration = RuleObject | string[] | string | boolean;

export interface RuleObject {
  any?: RuleDeclaration[];
  all?: RuleDeclaration[];
}

export interface RegionConfig {
  name: string;
  points?: string;
  requires?: RuleDeclaration;
}

export type Point = [number, number];

export interface BaseLocationConfig {
  name: string;
  location: Point;
}

export interface LocationConfig extends BaseLocationConfig {
  type?: string;
  visible?: RuleDeclaration;
  requires?: RuleDeclaration;
  rupees?: number;
  merge?: string[];
}

export interface ChestConfigObject {
  name: string;
  access: RuleDeclaration;
}

export type ChestConfig = string | ChestConfigObject;

export interface BossConfig {
  name: string;
  defeat?: RuleDeclaration;
  access?: RuleDeclaration;
  afterBigKey?: boolean;
  prize?: boolean;
}

export interface DungeonConfig extends BaseLocationConfig {
  enter?: RuleDeclaration;
  boss?: BossConfig;
  items: ChestConfig[];
  keys: number;
  notInPool: string | string[];
}

export type SlotEntry = string | null;
export type SlotConfig = SlotEntry[];
export type PrizeConfig = string[];

export type ItemLayoutSlot = string | string[];
export type ItemLayoutCellConfig = ItemLayoutSlot[];
export type ItemLayoutRow = ItemLayoutCellConfig[];

export type DungeonLayoutConfig = Record<string, string[]>;

export interface LayoutConfig {
  items?: ItemLayoutRow[];
  equipment?: string[];
  dungeons?: DungeonLayoutConfig;
  maps?: string[];
}

export interface LogicConfig {
  name: string;
  rules: Record<string, RuleConfig>;
  slots: Record<string, SlotConfig>;
}

export default interface Config {
  items: Record<string, ItemConfig>;
  rules: Record<string, RuleConfig>;
  regions: Record<string, RegionConfig>;
  locations: Record<string, LocationConfig>;
  dungeons: Record<string, DungeonConfig>;
  slots: Record<string, SlotConfig>;
  prizes: Record<string, PrizeConfig>;
  layout: LayoutConfig;
  defaults: string[];
  logics: Record<string, LogicConfig>;
}