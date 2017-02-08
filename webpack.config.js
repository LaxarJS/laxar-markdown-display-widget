/**
 * Copyright 2016 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
/* eslint-env node */

const path = require( 'path' );
const webpack = require( 'webpack' );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = {

   output: {
      path: path.resolve( './var/build/' ),
      publicPath: '/var/build/',
      filename: '[name].bundle.js'
   },

   module: {
      rules: [
         {
            test: /.spec.js$/,
            loader: 'laxar-mocks/spec-loader'
         },
         {  // load styles, images and fonts with the file-loader
            // (out-of-bundle in var/build/assets/)
            test: /\.(gif|jpe?g|png|ttf|woff2?|svg|eot|otf)(\?.*)?$/,
            loader: 'file-loader',
            options: {
               name: 'assets/[name].[ext]'
            }
         },
         {  // ... after optimizing graphics with the image-loader ...
            test: /\.(gif|jpe?g|png|svg)$/,
            loader: 'img-loader?progressive=true'
         },
         {  // ... and resolving CSS url()s with the css loader
            // (extract-loader extracts the CSS string from the JS module returned by the css-loader)
            test: /\.css$/,
            loader: 'style-loader!css-loader'
         }
      ]
   }
};
