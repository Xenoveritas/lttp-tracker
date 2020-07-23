import { BasicLocation } from '../location';
import Dungeon from '../dungeon';
import DB from '../db';
import Rule, { RulePart } from '../rule';

function createTitle(title: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'title';
  div.append(title);
  return div;
}

/**
 * This provides extended details about a given location.
 */
export default class PinTooltip {
  private itemDescription: HTMLDivElement;
  private dungeonBadge: HTMLSpanElement = null;
  private bossBadge: HTMLSpanElement = null;
  private ruleElements: HTMLElement[] = [];

  constructor(private location: BasicLocation, private db: DB, container: HTMLDivElement) {
    let title = createTitle(location.name);
    container.append(title);
    if (location instanceof Dungeon) {
      const badgeContainer = document.createElement('div');
      badgeContainer.className = 'badges';
      container.append(badgeContainer);
      this.dungeonBadge = document.createElement('span');
      this.dungeonBadge.className = 'badge';
      badgeContainer.append(this.dungeonBadge);
      this.bossBadge = document.createElement('span');
      this.bossBadge.className = 'badge';
      badgeContainer.append(this.bossBadge);
      const entryContainer = document.createElement('div');
      container.append(entryContainer);
      entryContainer.className = 'entry-requirements';
      title = createTitle('Entry Requirements');
      entryContainer.append(title);
      this.createRuleExplainer(location.entryRule, entryContainer);
      if (location.boss !== null) {
        const bossContainer = document.createElement('div');
        container.append(bossContainer);
        bossContainer.className = 'boss-requirements';
        title = createTitle('Boss Requirements');
        bossContainer.append(title);
        const accessContainer = document.createElement('div');
        bossContainer.append(accessContainer);
        accessContainer.append('Access: ');
        this.createRuleExplainer(location.boss.accessRule, accessContainer);
        const defeatContainer = document.createElement('div');
        bossContainer.append(defeatContainer);
        defeatContainer.append('Defeat: ');
        this.createRuleExplainer(location.boss.defeatRule, defeatContainer);
      }
    }
    this.itemDescription = document.createElement('div');
    this.itemDescription.className = 'items';
    container.append(this.itemDescription);
    // And fill it out
    this.update();
  }

  private createRuleExplainer(rule: Rule, container: HTMLElement, addParenthesis = false): void {
    const ruleHTML = document.createElement('span');
    container.append(ruleHTML);
    if (rule.isIndependent()) {
      ruleHTML.className = `rule rule-${rule.isAlwaysTrue()}`;
      ruleHTML.append(rule.isAlwaysTrue() ? 'Always' : 'Never');
      container.append(ruleHTML);
    } else if (rule.name) {
      // If the rule is named, just add the name
      ruleHTML.append(rule.name);
    } else {
      // Otherwise, we're going to need to recurse
      const all = rule.all;
      const any = rule.any;
      if (addParenthesis && all.length + any.length > 1) {
        ruleHTML.append('(');
      }
      if (all.length > 0) {
        this.createRuleList(all, ruleHTML);
      }
      if (any.length > 0) {
        if (all.length > 0) {
          // All must be met to be true
          ruleHTML.append(' and ');
        }
        this.createRuleList(any, ruleHTML, ' or ');
      }
      if (addParenthesis && all.length + any.length > 1) {
        ruleHTML.append(')');
      }
    }
  }

  private createRuleList(subrules: RulePart[], container: HTMLElement, joiner = ' and '): void {
    // Don't do anything if empty
    if (subrules.length === 0)
      return;
    const ruleHTML = document.createElement('span');
    ruleHTML.className = 'rule';
    container.append(ruleHTML);
    let needsJoin = false;
    for (const subrule of subrules) {
      if (needsJoin) {
        ruleHTML.append(joiner);
      } else {
        needsJoin = true;
      }
      this.createRulePartElement(subrule, ruleHTML);
    }
  }

  private createRulePartElement(part: RulePart, container: HTMLElement): void {
    const ruleHTML = document.createElement('span');
    container.append(ruleHTML);
    if (typeof part === 'string') {
      // This may actually be its own subrule.
      const subrule = this.db.environment.getBoundRule(part);
      if (subrule !== null) {
        this.createRuleExplainer(subrule, ruleHTML, true);
      } else {
        // Look up the item in the DB
        const item = this.db.items[part];
        if (item) {
          ruleHTML.append(item.name);
        } else {
          if (part.endsWith('.cleared')) {
            // May be a dungeon
            const dungeon = this.db.dungeons[part.substr(0, part.length - 8)];
            if (dungeon) {
              ruleHTML.append(dungeon.boss ? dungeon.boss.name + ' Defeated' : dungeon.name + ' Cleared');
              return;
            }
          }
          ruleHTML.append('unknown: ' + part);
        }
      }
    } else if (part !== null) {
      // Otherwise, it's another rule
      this.createRuleExplainer(part, ruleHTML, true);
    } else {
      ruleHTML.append('ERROR (null rule)');
    }
  }

  generateItemDescription(): string {
    const available = this.location.getAccessibleItemCount(this.db.environment);
    const visible = this.location.getVisibleItemCount(this.db.environment);
    let description = '';
    if (available === 0) {
      if (visible > 0) {
        description = `${visible} item${visible !== 1 ? 's' : ''} visible`;
      }
      if (visible < this.location.totalItemCount) {
        const inaccessible = this.location.totalItemCount - available;
        if (visible > 0) {
          description += ', ';
        }
        description += `${inaccessible} inaccessible item${inaccessible !== 1 ? 's' : ''}`;
      }
    } else {
      description = available + ' item';
      if (available > 1)
      description += 's';
      description += ' available';
      if (visible > 0) {
        description += `, ${visible} visible item${visible !== 1 ? 's' : ''}`;
      }
      // The visible item count only counts items that are visible but inaccessible
      const inaccessible = this.location.totalItemCount - available - visible;
      if (inaccessible > 0)
        description += `, ${inaccessible} inaccessible item${inaccessible !== 1 ? 's' : ''}`;
    }
    return description;
  }

  /**
   * Update the contents of the tooltip to represent the new location state.
   */
  update(): void {
    // Update the pin
    this.itemDescription.innerText = this.generateItemDescription();
    if (this.location instanceof Dungeon) {
      const open = this.location.isEnterable(this.db.environment);
      this.dungeonBadge.innerText = open ? 'Open' : 'Inaccessible';
      this.dungeonBadge.className = `badge ${open ? 'open' : 'closed'}`;
      const bossDefeatable = this.location.isBossDefeatable(this.db.environment);
      this.bossBadge.innerText = bossDefeatable ? 'Boss Challengable' : 'Boss Undefeatable';
      this.bossBadge.className = `badge ${bossDefeatable ? 'defeatable' : 'undefeatable'}`;
    }
  }
}