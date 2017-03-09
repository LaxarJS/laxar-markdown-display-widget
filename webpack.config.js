/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
/* eslint-env node */

const webpack = require( 'laxar-infrastructure' ).webpack( {
   context: __dirname,
   rules: [
      {
         test: /\.js$/,
         exclude: 'node_modules',
         loader: 'babel-loader'
      },
      {
         test: /\.spec\.js$/,
         exclude: 'node_modules',
         loader: 'laxar-mocks/spec-loader'
      }
   ]
} );

module.exports = [
   webpack.library(),
   webpack.browserSpec( [ 'spec/laxar-markdown-display-widget.spec.js' ] )
];
