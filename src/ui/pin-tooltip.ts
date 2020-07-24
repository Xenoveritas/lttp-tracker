import Location, { BasicLocation, MergeLocation } from '../location';
import Dungeon from '../dungeon';
import DB from '../db';
import Rule, { RulePart } from '../rule';

function createAndAppend<K extends keyof HTMLElementTagNameMap>(tagName: K, within: HTMLElement, cssClass?: string, text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tagName);
  within.append(result);
  if (cssClass)
    result.className = cssClass;
  if (text)
    result.append(text);
  return result;
}

function createTitle(title: string, within: HTMLElement, cssClass = 'title'): HTMLDivElement {
  return createAndAppend('div', within, cssClass, title);
}

function createBadge(within: HTMLElement, text?: string, cssClass?: string): HTMLSpanElement {
  return createAndAppend('span', within, cssClass ? 'badge ' + cssClass : 'badge', text);
}

function updateBadge(badge: HTMLSpanElement, text: string, cssClass: string): void {
  badge.innerText = text;
  badge.className = 'badge ' + cssClass;
}

/**
 * This provides extended details about a given location.
 */
export default class PinTooltip {
  private itemDescription: HTMLDivElement;
  private itemBadge: HTMLSpanElement = null;
  private dungeonBadge: HTMLSpanElement = null;
  private bossBadge: HTMLSpanElement = null;
  private ruleElements: HTMLElement[] = [];

  constructor(private location: BasicLocation, private db: DB, container: HTMLDivElement) {
    createTitle(location.name, container);
    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'badges';
    container.append(badgeContainer);
    if (location instanceof Dungeon) {
      this.dungeonBadge = createBadge(badgeContainer);
      this.bossBadge = createBadge(badgeContainer);
      const entryContainer = document.createElement('div');
      container.append(entryContainer);
      entryContainer.className = 'entry-requirements';
      createTitle('Entry Requirements', entryContainer);
      this.createRuleExplainer(location.entryRule, entryContainer);
      if (location.boss !== null) {
        const bossContainer = document.createElement('div');
        container.append(bossContainer);
        bossContainer.className = 'boss-requirements';
        createTitle('Boss Requirements', bossContainer);
        const accessContainer = document.createElement('div');
        bossContainer.append(accessContainer);
        accessContainer.append('Access: ');
        this.createRuleExplainer(location.boss.accessRule, accessContainer);
        const defeatContainer = document.createElement('div');
        bossContainer.append(defeatContainer);
        defeatContainer.append('Defeat: ');
        this.createRuleExplainer(location.boss.defeatRule, defeatContainer);
      }
      this.itemDescription = createAndAppend('div', container, 'items');
    } else if (location instanceof Location) {
      // Otherwise this should reflect the state
      this.itemBadge = createBadge(badgeContainer);
      this.itemDescription = createAndAppend('div', container, 'items');
      if (location instanceof MergeLocation) {
        // This is "really" multiple locations
        const sublocDiv = document.createElement('div');
        container.append(sublocDiv);
        sublocDiv.append('Sublocations:');
        const locationList = document.createElement('ul');
        sublocDiv.append(locationList);
        for (const subloc of location.subLocations) {
          const li = document.createElement('li');
          locationList.append(li);
          createTitle(subloc.name, li);
          this.createLocationExplainer(subloc, li);
        }
      } else {
        this.createLocationExplainer(location, container);
      }
    }
    // And fill it out
    this.update();
  }

  private createLocationExplainer(location: Location, container: HTMLElement): void {
    if (location.cost > 0) {
      const costDiv = createTitle('Costs: ', container, 'price');
      createAndAppend('span', costDiv, 'rupees', location.cost.toString());
    }
    if (location.availableRule.isAlwaysTrue()) {
      createTitle('Always Accessible', container, 'require-rule');
    } else {
      createTitle('Requires:', container, 'require-rule');
      this.createRuleExplainer(location.availableRule, container);
    }
    if (!location.visibleRule.isIndependent()) {
      createTitle('Visible when:', container, 'visible-rule');
      this.createRuleExplainer(location.visibleRule, container);
    }
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
      updateBadge(this.dungeonBadge, open ? 'Open' : 'Inaccessible', open ? 'open' : 'closed');
      const bossDefeatable = this.location.isBossDefeatable(this.db.environment);
      updateBadge(this.bossBadge, bossDefeatable ? 'Boss Challengable' : 'Boss Undefeatable', bossDefeatable ? 'defeatable' : 'undefeatable');
    } else if (this.location instanceof Location) {
      let title = 'Error', className = 'error';
      switch(this.location.getState(this.db.environment)) {
        case Location.UNAVAILABLE:
          title = 'Inaccessible';
          className = 'unavailable';
          break;
        case Location.VISIBLE:
          title = 'Visible';
          className = 'visible';
          break;
        case Location.PARTIALLY_AVAILABLE:
          title = 'Partially Accessible';
          className = 'partial';
          break;
        case Location.AVAILABLE:
          title = 'Accessible';
          className = 'available';
          break;
      }
      updateBadge(this.itemBadge, title, className);
    }
  }
}