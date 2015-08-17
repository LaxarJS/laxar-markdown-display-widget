/**
 * Copyright 2015 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'json!../widget.json',
   '../ax-markdown-display-widget',
   'angular-mocks',
   'laxar/laxar_testing'
], function( descriptor, widgetModule, ngMocks, ax ) {
   'use strict';

   describe( 'An ax-markdown-display-widget', function() {

      var testBed;
      var $httpBackend;

      var MARKDOWN_DISPLAY_SCROLL = 'markdownDisplayScroll';

      beforeEach( function() {
         testBed = ax.testing.portalMocksAngular.createControllerTestBed( descriptor );
         spyOn( ax.log, 'warn' );
         testBed.injections = {
            $sce: {
               trustAsHtml: function( html ) {
                  return html;
               }
            },
            axFlowService: {
               constructAbsoluteUrl: function( place, optionalParameters ) {
                  return 'http://localhost:8000/index.html#/widgetBrowser/' +
                         optionalParameters[ testBed.scope.features.markdown.parameter ] ;
               }
            }
         };
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      afterEach( function() {
         testBed.tearDown();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'when the site is entered through a bookmark with a parameter which refers to a section', function() {

         beforeEach( function() {
            testBed.featuresMock = {
               markdown: {
                  parameter: 'anchor',
                  resource: 'markdownResource',
                  attribute: 'markdown'
               }
            };

            testBed.useWidgetJson();
            testBed.setup();

            spyOn( testBed.scope, '$emit' );
            testBed.eventBusMock.publish( 'didNavigate._self', {
               data: {
                  anchor: 'references'
               }
            } );
            jasmine.Clock.tick( 0 );
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  'markdown': '## References*'
               }
            } );
            jasmine.Clock.tick( 0 );
         } );

         //////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'scrolls to the bookmarked section (R1.1)', function() {
            expect( testBed.scope.$emit ).toHaveBeenCalledWith( MARKDOWN_DISPLAY_SCROLL );
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with a configured URL which refers to a Markdown-formatted text', function() {

         beforeEach( function() {
            testBed.injections = {
               $sce: {
                  trustAsHtml: function( html ) {
                     return html;
                  }
               },
               axFlowService: {
                  constructAbsoluteUrl: function( place, optionalParameters ) {
                     return 'http://localhost:8000/index.html#/widgetBrowser/' +
                            optionalParameters[ testBed.scope.features.markdown.parameter ] ;
                  }
               }
            };
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function setupWithHttpBackend( url, data, status ) {
            if( typeof status === 'undefined' ) {
               status = 200;
            }
            testBed.featuresMock = {
               markdown: {
                  parameter: 'anchor',
                  url: url
               }
            };
            testBed.useWidgetJson();
            testBed.setup( {
               onBeforeControllerCreation: function( $injector ) {
                  $httpBackend = $injector.get( '$httpBackend' );
                  $httpBackend.expectGET( url ).respond( status, data );
               }
            } );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'reads the file referenced by the URL via HTTP GET (R1.2)', function() {
            setupWithHttpBackend( 'test.md', 'markdown text' );
            $httpBackend.flush();
         } );


         /////////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'if the file is not found', function() {

            it( 'publishes an error message', function() {
               setupWithHttpBackend( 'test.md', { value: 'Not Found' }, 404 );
               $httpBackend.flush();
               expect( testBed.scope.eventBus.publish ).toHaveBeenCalledWith(
                  'didEncounterError.HTTP_GET',
                  jasmine.any (Object),
                  jasmine.any (Object)
               );
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'converts the markdown file content to HTML (R1.6)', function() {
            setupWithHttpBackend( 'test.md', '*Emphasized*' );
            $httpBackend.flush();
            expect( testBed.scope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves images with relative paths (R1.7)', function() {
            var mdText = '';
            mdText += '![Image 1](http://my.example.org/docs/images/image1.png)';
            mdText += '![Image 2](//my.example.org/docs/images/image2.png)';
            mdText += '![Image 3](file:///docs/images/image3.png)';
            mdText += '![Image 4](/docs/images/image4.png)';
            mdText += '![Image 5](docs/images/image5.png)';
            mdText += '![Image 6](./docs/images/image6.png)';
            mdText += '![Image 7](../docs/images/image7.png)';
            setupWithHttpBackend( 'http://laxarjs.org/A/B/test.md', mdText);

            $httpBackend.flush();
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="http://my.example.org/docs/images/image1.png"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="//my.example.org/docs/images/image2.png"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="file:///docs/images/image3.png"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="http://laxarjs.org/docs/images/image4.png"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image5.png"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image6.png"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/docs/images/image7.png"[^>]*>|<img[^>]*\\s+src="http://laxarjs.org/A/B/../docs/images/image7.png"[^>]*>' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves hyperlinks with relative paths (R1.8)', function() {
            var mdText = '';
            mdText += '[Link 1](http://my.example.org/docs/pages/link1.html)';
            mdText += '[Link 2](//my.example.org/docs/pages/link2.html)';
            mdText += '[Link 3](file:///docs/pages/link3.html)';
            mdText += '[Link 4](/docs/pages/link4.html)';
            mdText += '[Link 5](docs/pages/link5.html)';
            mdText += '[Link 6](./docs/pages/link6.html)';
            mdText += '[Link 7](../docs/pages/link7.html)';
            mdText += '[Link 8](../docs/pages/link8.html#chapter)';
            setupWithHttpBackend( 'http://laxarjs.org/A/B/test.md', mdText );

            $httpBackend.flush();
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="http://my.example.org/docs/pages/link1.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="//my.example.org/docs/pages/link2.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="file:///docs/pages/link3.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="http://laxarjs.org/docs/pages/link4.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link5.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link6.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link7.html"[^>]*>|<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link7.html"[^>]*>' );
            expect( testBed.scope.model.html ).toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link8.html#chapter"[^>]*>|<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link8.html#chapter"[^>]*>' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves links to anchors of headings (R1.9)', function() {
            var mdText = '';
            mdText += '# Heading\n';
            mdText += '## Second Heading\n';
            mdText += '### Dritte Überschrift: Straße\n';
            mdText += '[Second Heading](#second-heading)\n';
            setupWithHttpBackend( 'http://laxarjs.org/A/B/test.md', mdText );

            $httpBackend.flush();
            expect( testBed.scope.model.html )
               .toMatch( '<h1[^>]*\\s+id="' + testBed.scope.id( 'heading' ) + '"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<h2[^>]*\\s+id="' + testBed.scope.id( 'second-heading' ) + '"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<h3[^>]*\\s+id="' + testBed.scope.id( 'dritte-berschrift-stra-e' ) + '"[^>]*>' );

            var linkUrl = 'http://localhost:8000/index.html#/widgetBrowser/' + testBed.scope.id( 'second-heading' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="' + linkUrl + '"[^>]*>Second Heading</a>' );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with a configured feature \'markdown\' and attribute \'resource\' when \'attribute\' is set to a non-empty string', function() {

         beforeEach( function() {

            testBed.featuresMock = {
               markdown: {
                  parameter: 'anchor',
                  resource: 'markdownResource',
                  attribute: 'markdown'
               }
            };

            testBed.useWidgetJson();
            testBed.setup();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'uses a markdown resource and is listening to didReplace event (R1.3)', function() {
            expect( testBed.scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'didReplace.markdownResource', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'uses a markdown resource and is listening to didUpdate event (R1.3)', function() {
            expect( testBed.scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'didUpdate.markdownResource', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'logs a warning if we do not have a string as markdown (R1.5)', function() {
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  markdown: []
               }
            } );

            jasmine.Clock.tick( 0 );
            expect( ax.log.warn ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'logs a warning if we do not have the specified attribute (R1.5)', function() {
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  'wrong-attribute': '*Emphasized*'
               }
            } );

            jasmine.Clock.tick( 0 );
            expect( ax.log.warn ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'does not log a warning before the resource is received', function() {
            expect( ax.log.warn ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'converts the markdown resource content to HTML (R1.6)', function() {
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  markdown: '*Emphasized*'
               }
            } );

            jasmine.Clock.tick( 0 );
            expect( testBed.scope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves links to anchors of headings (R1.9)', function() {
            var mdText = '';
            mdText += '# Heading\n';
            mdText += '## Second Heading\n';
            mdText += '### Dritte Überschrift: Straße\n';
            mdText += '[Second Heading](#second-heading)\n';

            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  markdown: mdText
               }
            } );

            testBed.featuresMock = {
               markdown: {
                  parameter: 'anchor',
                  url: 'http://laxarjs.org/A/B/test.md'
               }
            };

            jasmine.Clock.tick( 0 );


            expect( testBed.scope.model.html )
               .toMatch( '<h1[^>]*\\s+id="' + testBed.scope.id( 'heading' ) + '"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<h2[^>]*\\s+id="' + testBed.scope.id( 'second-heading' ) + '"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<h3[^>]*\\s+id="' + testBed.scope.id( 'dritte-berschrift-stra-e' ) + '"[^>]*>' );

            var linkUrl = 'http://localhost:8000/index.html#/widgetBrowser/' + testBed.scope.id( 'second-heading' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="' + linkUrl + '"[^>]*>Second Heading</a>' );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with a configured feature \'markdown\' and attribute \'resource\' when \'attribute\' is not set', function() {

         beforeEach( function() {
            testBed.featuresMock = {
               markdown: {
                  parameter: 'anchor',
                  resource: 'markdownResource'
               }
            };
            testBed.useWidgetJson();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function setupWithHttpBackendAndPublishResource( url, respond ) {
            testBed.setup( {
               onBeforeControllerCreation: function( $injector ) {
                  $httpBackend = $injector.get( '$httpBackend' );
                  $httpBackend.expectGET( url ).respond( respond );
               }
            } );
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  _links: {
                     markdown: {
                        href: url
                     }
                  }
               }
            } );

            jasmine.Clock.tick( 0 );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'uses a markdown resource and is listening to didReplace event (R1.4)', function() {
            testBed.setup();
            expect( testBed.scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'didReplace.markdownResource', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'uses a markdown resource and is listening to didUpdate event (R1.4)', function() {
            testBed.setup();
            expect( testBed.scope.eventBus.subscribe )
               .toHaveBeenCalledWith( 'didUpdate.markdownResource', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'logs a warning if we do not have a URL (R1.5)', function() {
            testBed.setup();
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {}
            } );

            jasmine.Clock.tick( 0 );
            expect( ax.log.warn ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'does not log a warning if the resource is null', function() {
            testBed.setup();
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: null
            } );

            jasmine.Clock.tick( 0 );
            expect( ax.log.warn ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'converts the markdown file content to HTML (R1.6)', function() {
            setupWithHttpBackendAndPublishResource( 'test.md', '*Emphasized*' );
            $httpBackend.flush();
            expect( testBed.scope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves images with relative paths (R1.7)', function() {
            var url = 'http://laxarjs.org/A/B/test.md';
            var mdText = '';
            mdText += '![Image 1](http://my.example.org/docs/images/image1.png)';
            mdText += '![Image 2](//my.example.org/docs/images/image2.png)';
            mdText += '![Image 3](file:///docs/images/image3.png)';
            mdText += '![Image 4](/docs/images/image4.png)';
            mdText += '![Image 5](docs/images/image5.png)';
            mdText += '![Image 6](./docs/images/image6.png)';
            mdText += '![Image 7](../docs/images/image7.png)';
            setupWithHttpBackendAndPublishResource( url, mdText );

            $httpBackend.flush();
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="http://my.example.org/docs/images/image1.png"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="//my.example.org/docs/images/image2.png"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="file:///docs/images/image3.png"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/docs/images/image4.png"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image5.png"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image6.png"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/docs/images/image7.png"[^>]*>|<img[^>]*\\s+src="http://laxarjs.org/A/B/../docs/images/image7.png"[^>]*>' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves hyperlinks with relative paths (R1.8)', function() {
            var url = 'http://laxarjs.org/A/B/test.md';
            var mdText = '';
            mdText += '[Link 1](http://my.example.org/docs/pages/link1.html)';
            mdText += '[Link 2](//my.example.org/docs/pages/link2.html)';
            mdText += '[Link 3](file:///docs/pages/link3.html)';
            mdText += '[Link 4](/docs/pages/link4.html)';
            mdText += '[Link 5](docs/pages/link5.html)';
            mdText += '[Link 6](./docs/pages/link6.html)';
            mdText += '[Link 7](../docs/pages/link7.html)';
            mdText += '[Link 8](../docs/pages/link8.html#chapter)';
            setupWithHttpBackendAndPublishResource( url, mdText );

            $httpBackend.flush();
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="http://my.example.org/docs/pages/link1.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="//my.example.org/docs/pages/link2.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="file:///docs/pages/link3.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/docs/pages/link4.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link5.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link6.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link7.html"[^>]*>|<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link7.html"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link8.html#chapter"[^>]*>|<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link8.html#chapter"[^>]*>' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves links to anchors of headings (R1.9)', function() {
            var url = 'http://laxarjs.org/A/B/test.md';
            var mdText = '';
            mdText += '# Heading\n';
            mdText += '## Second Heading\n';
            mdText += '### Dritte Überschrift: Straße\n';
            mdText += '[Second Heading](#second-heading)\n';
            setupWithHttpBackendAndPublishResource( url, mdText );

            $httpBackend.flush();
            expect( testBed.scope.model.html )
               .toMatch( '<h1[^>]*\\s+id="' + testBed.scope.id( 'heading' ) + '"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<h2[^>]*\\s+id="' + testBed.scope.id( 'second-heading' ) + '"[^>]*>' );
            expect( testBed.scope.model.html )
               .toMatch( '<h3[^>]*\\s+id="' + testBed.scope.id( 'dritte-berschrift-stra-e' ) + '"[^>]*>' );

            var linkUrl = 'http://localhost:8000/index.html#/widgetBrowser/' + testBed.scope.id( 'second-heading' );
            expect( testBed.scope.model.html )
               .toMatch( '<a[^>]*\\s+href="' + linkUrl + '"[^>]*>Second Heading</a>' );
         } );

      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with a configured feature \'markdown\' with an URL and an resource', function() {
         beforeEach( function() {
            testBed.injections = {
               $sce: {
                  trustAsHtml: function( html ) {
                     return html;
                  }
               },
               axFlowService: {
                  constructAbsoluteUrl: function( place, optionalParameters ) {
                     return 'http://localhost:8000/index.html#/widgetBrowser/' +
                            optionalParameters[ testBed.scope.features.markdown.parameter ] ;
                  }
               }
            };
            setupWithHttpBackend( 'test.md', '*Emphasized*' );
            $httpBackend.flush();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function setupWithHttpBackend( url, respond ) {
            testBed.featuresMock = {
               markdown: {
                  parameter: 'anchor',
                  url: url,
                  resource: 'markdownResource',
                  attribute: 'markdown'
               }
            };
            testBed.useWidgetJson();
            testBed.setup( {
               onBeforeControllerCreation: function( $injector ) {
                  $httpBackend = $injector.get( '$httpBackend' );
                  $httpBackend.expectGET( url ).respond( respond );
               }
            } );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'displays the text from the URL until the resource is published (R1.10)', function() {
            expect( testBed.scope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
            testBed.eventBusMock.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  'markdown': 'Text from the *resource*'
               }
            } );
            jasmine.Clock.tick( 0 );
            expect( testBed.scope.model.html ).toMatch( /Text from the <em>resource<\/em>/ );
         } );
      } );
   } );
} );
