/**
 * Main module for the tracker. This causes it to launch on startup.
 */

// Half-ass polyfill append for Edge. (This does NOT properly implement append,
// and also misses a few other classes that should have it, but it does
// implement enough of it to make Edge work within this app.)
if (!Element.prototype.hasOwnProperty('append')) {
  Element.prototype.append = function(n) {
    if (n instanceof Node) {
      this.appendChild(n);
    } else {
      this.appendChild(document.createTextNode(n));
    }
  }
}

import './css/styles.less';

import TrackerUI from './tracker';

document.addEventListener('DOMContentLoaded', () => {
  let tracker = new TrackerUI();
  tracker.createUI();
  if (location.hash.indexOf('sprites') >= 0) {
    tracker.createSpriteDebugUI();
  }
  if (location.hash.indexOf('debug') >= 0) {
    tracker.createDebugUI();
  }
  document.body.append(tracker.element);
}, false);
