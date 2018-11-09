const merge = require('webpack-merge');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const common = require('./webpack.common.js');

module.exports = merge(common, {
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
      chunkFilename: "[id].css"
    })
  ],
  mode: 'production',
  module: {
    rules: [{
      test: /\.less$/,
      use: [
        {
          loader: MiniCssExtractPlugin.loader
        },
        "css-loader",
        "less-loader"
      ]
    }]
  }
});
