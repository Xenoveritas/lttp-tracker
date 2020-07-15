import EventEmitter from './eventemitter';
import { Environment } from './rule';

/**
 * An item.
 */
export default class Item extends EventEmitter {
  private _held = false;
  private _env: Environment = null;
  /**
   * Creates a new item. These are generally created via the DB and should not
   * need to be created directly.
   */
  constructor(readonly id: string, readonly name: string) {
    super();
  }

  get held() { return this._held; }
  set held(value) {
    value = !!value;
    if (value !== this._held) {
      let old = this._held;
      this._held = value;
      this.fire(this.id, old, value);
      if (this._env) {
        this._env.set(this.id, value);
      }
    }
  }

  bind(environment: Environment) {
    this._env = environment;
    environment.set(this.id, this._held);
    environment.addListener(this.id, () => {
      this.held = environment.isTrue(this.id);
    });
  }
}
