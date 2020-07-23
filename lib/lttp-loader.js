"use strict";

const parser = require('../dist-tools/lib/lttp-parser');

// Load the data.cson file via WebPack.
module.exports = function(content, _map, _meta) {
  return parser.parseToString(content);
};
