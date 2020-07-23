import Rule from './rule';
import Item from './item';
import Location from './location';
import Region from './region';
import Dungeon from './dungeon';

export type ItemLayout = Array<string | string[]>;
export type EquipmentLayout = string[];
export type DungeonsLayout = Record<string, string[]>;
export type MapsLayout = string[];

export interface LayoutDefinition extends Record<string, unknown> {
  items?: ItemLayout;
  equipment?: EquipmentLayout;
  dungeons?: DungeonsLayout;
  maps?: MapsLayout;
}

export interface TrackerDataBase {
  rules: Record<string, Rule>;
  items: Item[];
  regions: Region[];
  locations: Record<string, Location>;
  dungeons: Dungeon[];
  slots: Record<string, string | null>;
  prizes: Record<string, string[]>;
  layout: LayoutDefinition;
  defaults: string[];
  version: {
    date: string;
    alttpr: string;
  };
}

export function createDefaultDatabase(): TrackerDataBase;
export const LOGICS: Record<string, string>;
export const DEFAULT_LOGIC: string;

export default function createDatabase(logic?: string): TrackerDataBase;
