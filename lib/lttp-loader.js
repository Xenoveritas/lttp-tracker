"use strict";

const parser = require('./lttp-parser');

// Load the data.cson file via WebPack.

module.exports = function(content, map, meta) {
  return parser.parseToString(content);
};
