/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
/* eslint-env node */

const pkg = require( './package.json' );
const laxarInfrastructure = require( 'laxar-infrastructure' );

module.exports = function( config ) {
   config.set( karmaConfig() );
};

function karmaConfig() {
   return laxarInfrastructure.karma( [ `spec/${pkg.name}.spec.js` ], {
      context: __dirname,
      module: {
         rules: require( './webpack.config.js' )[ 0 ].module.rules
      }
   } );
}
