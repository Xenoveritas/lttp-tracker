"use strict";

const sharp = require('sharp');
const Vinyl = require('vinyl');
const Filter = require('./filters');
const stream = require('stream');

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
  /**
   * Creates the canvas for this engine (the place where images are added within the
   * SpriteSmith engine)
   * @param {number} width 
   * @param {number} height 
   */
  createCanvas(width, height) {
    return new FilterSharp(width, height, this);
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
   * cannot be loaded. Handles both strings and Vinyl objects. Since images
   * must have metadata, they're loaded via promises.
   */
  _loadImage(image) {
    if (typeof image === 'string') {
      return this._loadSharpImage(image);
    } else if (Vinyl.isVinyl(image)) {
      if (image.isBuffer()) {
        return this._loadSharpImage(image.contents, image.path);
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
  _loadSharpImage(image, path) {
    if (typeof image === 'string' && !path) {
      path = image;
    }
    let imageData = sharp(image);
    return imageData.metadata().then(metadata => {
      let sprite = new SharpSprite(image, imageData, metadata);
      // If there are filters, they need to be applied to the loaded sprite before
      // compositing the final image
      if (this.filters) {
        for (let filter of this.filters) {
          if (filter.isActiveOn(path)) {
            filter.filter(sprite);
          }
        }
        // If we're filtering, return the Promise from filter.finalize
        return sprite.finalize();
      }
      // Otherwise return the sprite directly
      return sprite;
    });
  }
}

FilterEngine.specVersion = '2.0.0';

module.exports = FilterEngine;

/**
 * Wrapper around a SharpSprite.
 */
class SharpSprite {
  constructor(image, sharpImage, metadata) {
    if (arguments.length == 2) {
      // "overload"
      metadata = sharpImage;
      sharpImage = null;
    }
    this.image = image;
    this.sharp = sharpImage ? sharpImage : sharp(image);
    this.raw = false;
    this.needsFinalize = false;
    this.width = metadata['width'];
    this.height = metadata['height'];
    this.metadata = metadata;
  }

  filter(name, ...filterArguments) {
    if (!(name in this.sharp)) {
      throw new Error(`Not a filter: ${name}`);
    }
    let func = this.sharp[name];
    if (typeof func != 'function') {
      throw new Error(`Invalid filter function ${name}`);
    }
    let result = func.apply(this.sharp, filterArguments);
    if (typeof result != 'object') {
      throw new Error(`Unexpected result from filter ${name}`);
    }
    this.sharp = result;
    this.needsFinalize = true;
    return this;
  }

  /**
   * Returns a Promise that resolves with this sprite once the sprite data is finalized.
   */
  finalize() {
    if (this.needsFinalize) {
      return this.sharp.raw().toBuffer({resolveWithObject: true}).then(({data, info}) => {
        this.image = data;
        this.raw = true;
        this.width = info.width;
        this.height = info.height;
        this.channels = info.channels;
        return this;
      });
    } else {
      return Promise.resolve(this);
    }
  }

  toSharpOptions() {
    let options = {
      input: this.image
    };
    if (this.raw) {
      options['raw'] = {
        width: this.width,
        height: this.height,
        channels: this.channels
      };
    }
    return options;
  }

  toString() {
    return `[SharpSprite ${this.width}x${this.height}]`
  }
}

class FilterSharp {
  constructor(width, height, engine) {
    this.image = sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.0 }
      }
    });
    this.images = [];
    this.engine = engine;
    this.width = width;
    this.height = height;
  }

  /**
   * Adds a given image to the canvas.
   *
   * @param {SharpSprite} image image object created via engine.createImages
   * @param {number} x horizontal coordinate to position left edge of image
   * @param {number} y vertical coordinate to position top edge of image
   */
  addImage(image, x, y) {
    let o = image.toSharpOptions();
    o['left'] = x;
    o['top'] = y;
    this.images.push(o);
  }

  /**
   * Exports the image in a stream.
   */
  export(options) {
    // Render the images now
    this.image = this.image.composite(this.images);
    let readableStream = new stream.Readable({ read: () => {
      // There's actually nothing to do here, we'll always get the data in one large dump
    } });
    this.image.toFormat(options.format || 'png').toBuffer().then(buffer => {
      readableStream.push(buffer);
      readableStream.push(null);
    }).catch(err => {
      readableStream.emit('error', err);
    });
    return readableStream;
  }
}