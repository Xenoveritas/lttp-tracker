import { BasicLocation } from '../location';
import DB from '../db';

/**
 * This provides extended details about a given location.
 */
export default class PinTooltip {
  private itemDescription: HTMLDivElement;
  constructor(private location: BasicLocation, private db: DB, container: HTMLDivElement) {
    const title = document.createElement('div');
    title.className = 'title';
    title.append(location.name);
    container.append(title);
    this.itemDescription = document.createElement('div');
    this.itemDescription.className = 'items';
    this.itemDescription.append(this.generateItemDescription());
    container.append(this.itemDescription);
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
  }
}