import Location, { BasicLocation, MergeLocation } from '../location';
import Dungeon from '../dungeon';
import DB from '../db';
import Rule, { ListRule, LookupRule } from '../rule';

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
      createTitle('Visible with:', container, 'visible-rule');
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
    } else if (rule instanceof LookupRule) {
      const field = rule.field;
      const region = this.db.regions[field];
      if (region) {
        ruleHTML.append(`Access to ${region.name}`);
        return;
      }
      const subrule = this.db.environment.getBoundRule(field);
      if (subrule !== null) {
        this.createRuleExplainer(subrule, ruleHTML, true);
      } else {
        // Look up the item in the DB
        const item = this.db.items[field];
        if (item) {
          ruleHTML.append(item.name);
          return;
        }
        if (field.endsWith('.cleared')) {
          // May be a dungeon
          const dungeon = this.db.dungeons[field.substr(0, field.length - 8)];
          if (dungeon) {
            ruleHTML.append(dungeon.boss ? dungeon.boss.name + ' Defeated' : dungeon.name + ' Cleared');
            return;
          }
        }
        ruleHTML.append('unknown: ' + field);
        return;
      }
    } else if (rule instanceof ListRule) {
      // Otherwise, we're going to need to recurse
      if (addParenthesis) {
        // If we were asked to add parenthesis, only do it if there's at least one rule
        addParenthesis = rule.children.length > 1;
      }
      if (addParenthesis) {
        ruleHTML.append('(');
      }
      let splice = false;
      for (const subrule of rule.children) {
        if (splice) {
          ruleHTML.append(rule.all ? ' and ' : ' or ');
        } else {
          splice = true;
        }
        this.createRuleExplainer(subrule, ruleHTML, true);
      }
      if (addParenthesis) {
        ruleHTML.append(')');
      }
    } else {
      ruleHTML.append('Error: Unknown Rule Element');
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
    if (this.location instanceof Dungeon) {
      const count = this.location.treasureCount;
      if (count === 0) {
        description += ' (all of which are dungeon items)';
      } else {
        description += ` (${count} of which ${count === 1 ? 'is not a dungeon item' : 'are not dungeon items'})`;
      }
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