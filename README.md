# Xenoveritas's LTTP Tracker

This a tracker for the [Legend of Zelda: A Link to the Past Randomizer](http://alttpr.com/) randomizer.

It is currently designed based on no-glitches standard mode, although there is planned support for doing Keysanity and other runs.

Note: While this does work in Edge, it does not (and will not) work in Internet Explorer. Internet Explorer support is not planned at this time. The only targeted (and officially supported) browsers are Firefox, Chrome, and Edge.

## Installing

This requires using [Node.js](https://nodejs.org/) and the [Yarn package manager](https://yarnpkg.com/). (Theoretically this works with NPM but no NPM lock file is provided, so use with NPM at your own risk.)

With those two installed, building it should be fairly easy:

```sh
yarn install
yarn build-tools
yarn build
```
This will generate the production version in `dist/`. The main HTML file is `index.html`.

## Building Tools

At present, the parser for dealing with the logic database is written in TypeScript, but needs to be loaded into WebPack as a plugin. You need to run `yarn build-tools` to build this tool before you can use the WebPack compilers.

This is not optimal and a future version will likely change this, but it's a small price to pay for being able to type check the parser.

## Generating the debug version

There's a separate "debug" version that doesn't run the script through a minifier. You can run that using:

```sh
yarn start
```

This also generates a version in `dist/` which can be started via `index.html`.
