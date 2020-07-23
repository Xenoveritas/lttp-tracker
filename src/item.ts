import { Environment } from './rule';

/**
 * An instance of an item within a tracker.
 */
export default class Item {
  /**
   * Creates a new item. These are generally created via the DB and should not
   * need to be created directly.
   */
  constructor(public readonly id: string, public readonly name: string) {
  }

  isHeld(environment: Environment): boolean {
    return environment.isTrue(this.id);
  }

  /**
   * Toggles whether or not this item is held.
   * @param environment the environment to toggle the value in
   */
  toggleHeld(environment: Environment): void {
    environment.set(this.id, !environment.get(this.id));
  }

  setHeld(environment: Environment, value: boolean): void {
    environment.set(this.id, value);
  }
}
