/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */

import * as ng from 'angular';
import * as $ from 'jquery';
import { object } from 'laxar';
import { errors, i18n, resources } from 'laxar-patterns';
import * as marked from 'marked';
import * as URI from 'urijs';

const MARKDOWN_DISPLAY_SCROLL = 'markdownDisplayScroll';

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

Controller.$inject = [ '$scope', '$http', '$sce', 'axFlowService', 'axLog' ];

function Controller( $scope, $http, $sce, flowService, log ) {
   let lastNavigateData = {};
   let lastResource;

   const publishError = errors.errorPublisherForFeature( $scope, 'messages', {
      localizer: i18n.handlerFor( $scope ).registerLocaleFromFeature( 'i18n' ).localizer()
   } );
   const defaultRenderer = new marked.Renderer();
   const renderer = new marked.Renderer();
   renderer.image = renderImage;
   renderer.link = renderLink;

   $scope.eventBus.subscribe( 'didNavigate', event => {
      const { data = {} } = event;
      const linksChanged = Object.keys( data )
         .filter( key => key !== $scope.features.markdown.parameter )
         .some( key => lastNavigateData[ key ] !== data[ key ] );
      lastNavigateData = object.deepClone( data );
      $scope.model.anchor = lastNavigateData[ $scope.features.markdown.parameter ];
      if( linksChanged ) {
         loadMarkdown();
      }
      $scope.$emit( MARKDOWN_DISPLAY_SCROLL );
   } );

   $scope.model = {
      html: ''
   };

   $scope.resources = {};

   loadMarkdown();

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   if( $scope.features.markdown.resource ) {
      resources.handlerFor( $scope )
         .registerResourceFromFeature( 'markdown', {
            onUpdateReplace: loadMarkdown
         } );
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   $scope.navigate = function( id ) {
      if( id !== $scope.model.anchor ) {
         $scope.eventBus.publish( 'navigateRequest._self', {
            target: '_self',
            data: {
               anchor: id
            }
         } );
      }
      else {
         $scope.$emit( MARKDOWN_DISPLAY_SCROLL );
      }
   };

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function loadMarkdown() {
      $scope.model.html = '';
      if( $scope.resources.markdown ) {
         if( $scope.features.markdown.attribute ) {
            const markdown = object.path( $scope.resources.markdown, $scope.features.markdown.attribute );
            if( typeof ( markdown ) === 'string' ) {
               $scope.model.html = markdownToHtml( markdown );
            }
            else {
               log.warn( 'No markdown content available' );
            }
         }
         else {
            const location = object.path( $scope.resources.markdown, '_links.markdown.href', null );
            if( location ) {
               loadMarkdownFromUrl( location );
            }
            else {
               log.warn( 'No content URL available' );
            }
         }
      }
      else if( $scope.features.markdown.url ) {
         loadMarkdownFromUrl( $scope.features.markdown.url );
      }
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function loadMarkdownFromUrl( location ) {
      lastResource = location;
      $http.get( location )
         .then( response => {
            if( lastResource !== location ) { return; }
            const data = response.data;
            $scope.model.html = markdownToHtml( data );
         }, response => {
            publishError( 'HTTP_GET', 'i18nFailedLoadingResource', {
               url: location
            }, {
               data: response.data,
               status: response.status,
               headers: response.headers
            } );
         } );
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function markdownToHtml( mdText ) {
      return $sce.trustAsHtml( marked( mdText, {
         renderer,
         sanitize: true,
         headerPrefix: $scope.id( '' )
      } ) );
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function renderImage( href, title, text ) {
      const uri = new URI( href );
      if( uri.is( 'absolute' ) || uri.scheme() !== '' ) {
         return defaultRenderer.image( href, title, text );
      }

      const markdownSourceUrl = markdownUrl();
      if( !markdownSourceUrl ) {
         return defaultRenderer.image( uri.unicode(), title, text );
      }
      return defaultRenderer.image( uri.unicode().absoluteTo( markdownSourceUrl ), title, text );

   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function renderLink( href, title, text ) {
      const uri = new URI( href );
      if( uri.is( 'absolute' ) || uri.scheme() !== '' ) {
         return defaultRenderer.link( href, title, text );
      }

      if( href.charAt( 0 ) === '#' && uri.fragment() !== '' ) {
         const placeParameters = object.deepClone( lastNavigateData );
         placeParameters[ $scope.features.markdown.parameter ] = $scope.id( uri.fragment() );
         const anchorHref = flowService.constructAbsoluteUrl( '_self', placeParameters );
         return `<a href="${anchorHref}">${text}</a>`;
      }

      const markdownSourceUrl = markdownUrl();
      if( !markdownSourceUrl ) {
         return defaultRenderer.link( uri.unicode(), title, text );
      }
      return defaultRenderer.link( uri.unicode().absoluteTo( markdownSourceUrl ), title, text );
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function markdownUrl(){
      return object.path(
         $scope.resources.markdown,
         '_links.markdown.href',
         $scope.features.markdown.url
      );
   }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const name = ng.module( 'axMarkdownDisplayWidget', [] )
   .controller( 'AxMarkdownDisplayWidgetController', Controller )
   .directive( 'axMarkdownDisplayHtml', [ '$compile', '$sce', function( $compile, $sce ) {
      return {
         restrict: 'A',
         replace: true,
         link( scope, element, attrs ) {

            scope.$watch( attrs.axMarkdownDisplayHtml, html => {
               element.html( $sce.getTrustedHtml( html ) );
               $compile( element.contents() )( scope );
               scrollToAnchor( scope.model.anchor );
            } );
            scope.$on( MARKDOWN_DISPLAY_SCROLL, () => {
               scrollToAnchor( scope.model.anchor );
            } );
            scope.$watch( 'model.anchor', id => {
               scrollToAnchor( id );
            } );

            function scrollToAnchor( id ) {
               if( !id ) { return; }
               const offset = $( `#${id}` ).offset();
               if( offset ) {
                  window.scrollTo( offset.left, offset.top );
               }
            }
         }
      };
   } ] ).name;
