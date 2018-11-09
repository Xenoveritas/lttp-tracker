"use strict";

const { createCanvas, loadImage, Image } = require('canvas');
const Vinyl = require('vinyl');
const Filter = require('./filters');

/**
 * Provides a SpriteSmith engine that allows filters to be executed on images
 * when they are loaded.
 */

/**
 * The FilterEngine: allows options to be given that specify filters.
 */
class FilterEngine {
  constructor(options) {
    if ('filters' in options) {
      this.filters = options.filters.map(definition => new Filter(definition));
    } else {
      this.filters = null;
    }
  }
  createCanvas(width, height) {
    return new FilterCanvas(width, height, this);
  }
  /**
   * Function to actually load images, which is where filters will be applied.
   */
  createImages(images, cb) {
    if (!Array.isArray(images)) {
      throw new Error("Invalid input");
    }
    Promise.all(images.map(image => {
      return this._loadImage(image);
    })).then(results => {
      cb(null, results);
    }).catch(error => cb(error));
  }
  /**
   * Returns a Promise for loading an image, or throws an error if the image
   * cannot be loaded. Handles both strings and Vinyl objects.
   */
  _loadImage(image) {
    if (typeof image === 'string') {
      return loadImage(image).then(result => {
        return this._processImage(image, result);
      });
    } else if (Vinyl.isVinyl(image)) {
      if (image.isBuffer()) {
        let img = new Image();
        img.src = image.contents;
        return Promise.resolve(this._processImage(image.path, img));
      } else if (image.isStream()) {
        // FIXME
        throw new Error('streams are not supported yet (sorry)');
      } else {
        throw new Error(`Cannot handle ${image}`)
      }
    } else {
      throw new Error(`Invalid image descriptor ${Object.prototype.toString.call(image)}`);
    }
  }
  _processImage(name, image) {
    if (this.filters) {
      // Process filters.
      for (let filter of this.filters) {
        if (filter.isActiveOn(name)) {
          image = filter.filter(image);
        }
      }
    }
    return image;
  }
}

FilterEngine.specVersion = '2.0.0';

module.exports = FilterEngine;

class FilterCanvas {
  constructor(width, height, engine) {
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
    this.engine = engine;
  }

  /**
   * Adds a given image to the canvas.
   *
   * @param {Object} image - Image object created via engine.createImages
   * x Number - Horizontal coordinate to position left edge of image
   * y Number - Vertical coordinate to position top edge of image
   */
  addImage(image, x, y) {
    this.ctx.drawImage(image, x, y);
  }

  /**
   * Exports the image in a stream.
   */
  export(options) {
    let format = options.format || 'png';
    if (typeof format !== 'string') {
      throw new Error(`unknown format ${Object.prototype.toString.call(format)}`);
    }
    switch(format.toLowerCase()) {
    case 'png':
      return this.canvas.createPNGStream();
    case 'jpg':
    case 'jpeg':
      return this.canvas.createJPEGStream();
    default:
      throw new Error(`unsupported format "${format}"`);
    }
  }
}
