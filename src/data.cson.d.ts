import Rule from '../lib/rule';
import Item from './item';
import Location from './location';
import Region from './region';
import Dungeon from './dungeon';

export type LayoutDefinition = LayoutDefinition[] | string;

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
