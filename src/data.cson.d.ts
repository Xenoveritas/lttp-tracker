import Rule from '../lib/rule';

export type LayoutDefinition = LayoutDefinition[] | string;
export type Item = object;
export type Region = object;
export type Dungeon = object;

export interface TrackerDataBase {
  rules: Record<string, Rule>;
  items: Item[];
  regions: Region[];
  locations: Record<string, Location>;
  dungeons: Dungeon[];
  slots: Record<string, string | null>;
  prizes: Record<string, string[]>;
  layout: Record<string, LayoutDefinition>;
  defaults: string[];
}

export function createDefaultDatabase(Rule, Item, Region, Location, Dungeon): TrackerDataBase;
export const LOGICS: Record<string, string>;
export const DEFAULT_LOGIC: string;

export default function createDatabase(logic: string | null, Rule, Item, Region, Location, Dungeon): TrackerDataBase;
