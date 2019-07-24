const path = require('path');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const SpritesmithPlugin = require('webpack-spritesmith');
const FilterEngine = require('./lib/filtersharpsmith/engine');

// The default template spritesmith uses is kind of ... let's go with old.
function generateLess(data) {
  // Part 1: dump output variables.
  let spriteVars = data.sprites.map(sprite => {
    let name = sprite.name.replace(/_/g, '-');
    return `@${name}-x: ${sprite.x}px;
@${name}-y: ${sprite.y}px;
@${name}-width: ${sprite.width}px;
@${name}-height: ${sprite.height}px;
@${name}-image: "${sprite.image}";
@${name}: ${sprite.x}px ${sprite.y}px ${sprite.width}px ${sprite.height}px "${sprite.image}";`;
  });
  return spriteVars.join('\n');
}

module.exports = {
  entry: './src/js/index.js',
  output: {
    filename: '[name].[chunkhash].js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [{
      test: /\.(png|jpg|gif)$/,
      use: [ {
        loader: 'file-loader'
      } ]
    }, {
      test: /data.cson$/,
      use: [ 'lttp-loader' ]
    }]
  },
  devtool: "source-map",
  resolveLoader: {
    alias: {
      'lttp-loader': './lib/lttp-loader.js'
    }
  },
  plugins: [
    new CleanWebpackPlugin(),
    new SpritesmithPlugin({
      src: {
          cwd: path.resolve(__dirname, 'src/images/sprites'),
          glob: '**/*.png'
      },
      target: {
          image: path.resolve(__dirname, 'generated/sprites.png'),
          css: [ [ path.resolve(__dirname, 'generated/sprites.less'), {
            format: 'simple_less'
          }] ]
      },
      customTemplates: {
        'simple_less': generateLess
      },
      apiOptions: {
        cssImageRef: "./sprites.png"
      },
      spritesmithOptions: {
        engine: FilterEngine,
        engineOpts: {
          filters: [
            {
              filter: 'resize',
              by: 2,
              kernel: 'nearest'
            }
          ]
        }
      }
    }),
    // And also for the world map.
    new SpritesmithPlugin({
      src: {
          cwd: path.resolve(__dirname, 'src/images/maps'),
          glob: '*.png'
      },
      target: {
          image: path.resolve(__dirname, 'generated/map.png'),
          css: [ [ path.resolve(__dirname, 'generated/map.less'), {
            format: 'simple_less'
          }] ]
      },
      customTemplates: {
        'simple_less': generateLess
      },
      apiOptions: {
        cssImageRef: "./map.png"
      },
      spritesmithOptions: {
        // Go ahead and use our FilterEngine because it's basically canvassmith
        // and conceptually faster
        engine: FilterEngine,
        engineOpts: { }
      }
    }),
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    })
  ]
};
