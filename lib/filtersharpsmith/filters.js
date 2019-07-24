"use strict";

/**
 * Provides various filters.
 */

// sharp isn't currently used directly, but it's still required, so meh
const Sharp = require('sharp');

/**
 * Generates a filter based on a set of options.
 */
class Filter {
  constructor(options) {
    if ('test' in options) {
      if (typeof options.test.test === 'function') {
        // Test is likely a regexp but could be anything else. In any case wrap
        // it.
        let f = options.test.test;
        this.test = name => { f(name) };
      } else if (typeof options.test === 'function') {
        // Use it directly.
        this.test = options.test;
      } else if (typeof options.test === 'string') {
        // For now, treat it as a regexp.
        let regexp = new RegExp(options.test);
        this.test = name => { regexp.test(name) };
      }
    } else {
      // If not given, this is ALWAYS active.
      this.test = true;
    }
    if (typeof options === 'function') {
      // Can be given a function directly, in which case the function is the
      // filter function.
      this.filterFunc = options;
    } else if (typeof options === 'string') {
      this.filterFunc = lookupFilter(options);
    } else {
      this.options = options;
      this.filterFunc = lookupFilter(options.filter);
    }
  }

  isActiveOn(path) {
    if (typeof this.test === 'function') {
      return this.test(path);
    } else {
      return this.test;
    }
  }

  /**
   * Filter the given image. This should apply whatever filters are necessary
   * to the given image.
   * @param {SharpSprite} image the image to filter
   */
  filter(image) {
    // Currently this just wraps it but a future version might do some sanity
    // checking to make sure the filter actually returned an image.
    return this.filterFunc(image, this.options);
  }
}

Filter.FILTERS = {
  resize: function(image, options) {
    let newWidth = image.width, newHeight = image.height;
    let by = options['by'];
    if (Array.isArray(by)) {
      // Should be a two-element array
      if (by.length != 2)
        throw new Error('when given an array, should be an array of two number [ width, height ]');
      newWidth *= by[0];
      newHeight *= by[1];
    } else {
      newWidth *= by;
      newHeight *= by;
    }
    image.filter('resize', { width: newWidth, height: newHeight, fit: 'fill', kernel: options.kernel });
  }
}

function lookupFilter(name) {
  if (typeof name !== 'string') {
    if (name === null || name === undefined) {
      throw new Error('no filter name given');
    } else {
      // Otherwise try it as a string (which will likely fail but whatever)
      name = name.toString();
    }
  }
  if (name in Filter.FILTERS) {
    return Filter.FILTERS[name];
  } else {
    throw new Error(`no filter by name of ${name}`);
  }
}

module.exports = Filter;
