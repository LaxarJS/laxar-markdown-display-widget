/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */

import * as ng from 'angular';
import 'angular-mocks';
import * as axMocks from 'laxar-mocks';

describe( 'A laxar-markdown-display-widget', () => {
   let widgetEventBus;
   let widgetScope;
   let testEventBus;
   const MARKDOWN_DISPLAY_SCROLL = 'markdownDisplayScroll';
   let $httpBackend;
   let $sce;
   let log;

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createSetup( widgetConfiguration ) {

      beforeEach( axMocks.setupForWidget() );

      beforeEach( () => {
         axMocks.widget.configure( widgetConfiguration );

         $httpBackend = null;

         axMocks.widget.whenServicesAvailable( services => {
            ng.mock.inject( ( _$httpBackend_, _$sce_ ) => {
               $httpBackend = _$httpBackend_;

               $httpBackend.resetExpectations();
               $sce = _$sce_;
               $sce.trustAsHtml = function( html ) { return html; };
            } );

            widgetScope = axMocks.widget.$scope;
            widgetEventBus = axMocks.widget.axEventBus;
            testEventBus = axMocks.eventBus;
            log = axMocks.widget.axLog;

            services.axFlowService.constructAbsoluteUrl
               .and.callFake( ( place, optionalParameters ) => {
                  return `http://localhost:8000/index.html#/widgetBrowser/${optionalParameters[
                     widgetScope.features.markdown.parameter ]}`;
               } );
         } );
      } );

   }

   function expectRequest( url, ...respondArgs ) {

      function callback() {
         const expectedRequest = $httpBackend.expectGET( url );
         if( respondArgs.length ) {
            expectedRequest.respond(...respondArgs);
         }
      }

      return function() {
         if( $httpBackend ) {
            callback();
         }
         else {
            axMocks.widget.whenServicesAvailable( callback );
         }
      };
   }

   function flushRequests() {
      $httpBackend.flush();
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   afterEach( () => {
      $httpBackend.verifyNoOutstandingExpectation();
      $httpBackend.verifyNoOutstandingRequest();
   } );

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'when the site is entered through a bookmark with a parameter which refers to a section', () => {

      createSetup( {
         markdown: {
            parameter: 'anchor',
            resource: 'markdownResource',
            attribute: 'markdown'
         }
      } );

      beforeEach( axMocks.widget.load );


      beforeEach( () => {
         spyOn( widgetScope, '$emit' );
         testEventBus.publish( 'didNavigate._self', {
            data: {
               anchor: 'references'
            }
         } );
         testEventBus.flush();
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {
               'markdown': '## References*'
            }
         } );
         testEventBus.flush();
      } );

      afterEach( axMocks.tearDown );

      /////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'scrolls to the bookmarked section (R1.1)', () => {
         expect( widgetScope.$emit ).toHaveBeenCalledWith( MARKDOWN_DISPLAY_SCROLL );
      } );
   } );

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'with URL which refers to a Markdown-formatted text', () => {

      describe( 'with the url "test.md"', () => {

         createSetup( {
            markdown: {
               parameter: 'anchor',
               url: 'test.md'
            }
         } );

         //////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'if the file contains plain text', () => {

            beforeEach( expectRequest( 'test.md', 200, 'markdown text' ) );

            beforeEach( axMocks.widget.load );

            beforeEach( flushRequests );

            afterEach( axMocks.tearDown );

            it( 'reads the file referenced by the URL via HTTP GET (R1.2)', () => {
               expect( widgetScope.model.html ).toMatch( 'markdown text' );
            } );
         } );

         //////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'if the file is not found', () => {

            beforeEach( expectRequest( 'test.md', 404, { value: 'Not Found' } ) );

            beforeEach( axMocks.widget.load );

            beforeEach( flushRequests );

            afterEach( axMocks.tearDown );

            it( 'publishes an error message', () => {
               expect( widgetEventBus.publish ).toHaveBeenCalledWith(
                  'didEncounterError.HTTP_GET',
                  jasmine.any( Object ),
                  jasmine.any( Object )
               );
            } );
         } );

         //////////////////////////////////////////////////////////////////////////////////////////////////

         describe( 'if the file contains markdown markup', () => {

            beforeEach( expectRequest( 'test.md', 200, '*Emphasized*' ) );

            beforeEach( axMocks.widget.load );

            beforeEach( flushRequests );

            afterEach( axMocks.tearDown );

            it( 'converts the markdown file content to HTML (R1.6)', () => {
               expect( widgetScope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
            } );
         } );

      } );

      /////////////////////////////////////////////////////////////////////////////////////////////////////

      describe( 'with the url "http://laxarjs.org/A/B/test.md"', () => {

         createSetup( {
            markdown: {
               parameter: 'anchor',
               url: 'http://laxarjs.org/A/B/test.md'
            }
         } );

         afterEach( axMocks.tearDown );

         //////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves images with relative paths (R1.7)', done => {
            let mdText = '';
            mdText += '![Image 1](http://my.example.org/docs/images/image1.png)';
            mdText += '![Image 2](//my.example.org/docs/images/image2.png)';
            mdText += '![Image 3](file:///docs/images/image3.png)';
            mdText += '![Image 4](/docs/images/image4.png)';
            mdText += '![Image 5](docs/images/image5.png)';
            mdText += '![Image 6](./docs/images/image6.png)';
            mdText += '![Image 7](../docs/images/image7.png)';

            expectRequest( 'http://laxarjs.org/A/B/test.md', 200, mdText )();

            axMocks.widget.load( err => {
               if( err ) {
                  return done( err );
               }

               flushRequests();

               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="http://my.example.org/docs/images/image1.png"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="//my.example.org/docs/images/image2.png"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="file:///docs/images/image3.png"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="http://laxarjs.org/docs/images/image4.png"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image5.png"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image6.png"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<img[^>]*\\s+src="http://laxarjs.org/A/docs/images/image7.png"[^>]*>|' +
                  '<img[^>]*\\s+src="http://laxarjs.org/A/B/../docs/images/image7.png"[^>]*>' );

               return done();
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves hyperlinks with relative paths (R1.8)', done => {
            let mdText = '';
            mdText += '[Link 1](http://my.example.org/docs/pages/link1.html)';
            mdText += '[Link 2](//my.example.org/docs/pages/link2.html)';
            mdText += '[Link 3](file:///docs/pages/link3.html)';
            mdText += '[Link 4](/docs/pages/link4.html)';
            mdText += '[Link 5](docs/pages/link5.html)';
            mdText += '[Link 6](./docs/pages/link6.html)';
            mdText += '[Link 7](../docs/pages/link7.html)';
            mdText += '[Link 8](../docs/pages/link8.html#chapter)';

            expectRequest( 'http://laxarjs.org/A/B/test.md', 200, mdText )();

            axMocks.widget.load( err => {
               if( err ) {
                  return done( err );
               }

               flushRequests();

               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="http://my.example.org/docs/pages/link1.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="//my.example.org/docs/pages/link2.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="file:///docs/pages/link3.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="http://laxarjs.org/docs/pages/link4.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link5.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link6.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link7.html"[^>]*>|' +
                  '<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link7.html"[^>]*>' );
               expect( widgetScope.model.html ).toMatch(
                  '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link8.html#chapter"[^>]*>|' +
                  '<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link8.html#chapter"[^>]*>' );

               return done();
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves links to anchors of headings (R1.9)', done => {
            let mdText = '';
            mdText += '# Heading\n';
            mdText += '## Second Heading\n';
            mdText += '### Dritte Überschrift: Straße\n';
            mdText += '[Second Heading](#second-heading)\n';

            expectRequest( 'http://laxarjs.org/A/B/test.md', 200, mdText )();

            axMocks.widget.load( err => {
               if( err ) {
                  return done( err );
               }

               flushRequests();

               expect( widgetScope.model.html )
                  .toMatch( `<h1[^>]*\\s+id="${widgetScope.id( 'heading' )}"[^>]*>` );
               expect( widgetScope.model.html )
                  .toMatch( `<h2[^>]*\\s+id="${widgetScope.id( 'second-heading' )}"[^>]*>` );
               expect( widgetScope.model.html )
                  .toMatch( `<h3[^>]*\\s+id="${widgetScope.id( 'dritte-berschrift-stra-e' )}"[^>]*>` );

               const linkUrl = `http://localhost:8000/index.html#/widgetBrowser/${
                  widgetScope.id( 'second-heading' )}`;
               expect( widgetScope.model.html )
                  .toMatch( `<a[^>]*\\s+href="${linkUrl}"[^>]*>Second Heading</a>` );

               return done();
            } );
         } );
      } );
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'with a configured feature markdown with a resource and an attribute set to a non-empty string',
      () => {

         createSetup( {
            markdown: {
               parameter: 'anchor',
               resource: 'markdownResource',
               attribute: 'markdown'
            }
         } );

         beforeEach( axMocks.widget.load );

         afterEach( axMocks.tearDown );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'uses a markdown resource and is listening to didReplace event (R1.3)', () => {
            expect( widgetEventBus.subscribe )
               .toHaveBeenCalledWith( 'didReplace.markdownResource', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'uses a markdown resource and is listening to didUpdate event (R1.3)', () => {
            expect( widgetEventBus.subscribe )
               .toHaveBeenCalledWith( 'didUpdate.markdownResource', jasmine.any( Function ) );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'logs a warning if we do not have a string as markdown (R1.5)', () => {
            testEventBus.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  markdown: []
               }
            } );

            testEventBus.flush();
            expect( log.warn ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'logs a warning if we do not have the specified attribute (R1.5)', () => {
            testEventBus.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  'wrong-attribute': '*Emphasized*'
               }
            } );

            testEventBus.flush();
            expect( log.warn ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'does not log a warning before the resource is received', () => {
            expect( log.warn ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'converts the markdown resource content to HTML (R1.6)', () => {
            testEventBus.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  markdown: '*Emphasized*'
               }
            } );

            testEventBus.flush();
            expect( widgetScope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves links to anchors of headings (R1.9)', () => {
            let mdText = '';
            mdText += '# Heading\n';
            mdText += '## Second Heading\n';
            mdText += '### Dritte Überschrift: Straße\n';
            mdText += '[Second Heading](#second-heading)\n';

            testEventBus.publish( 'didReplace.markdownResource', {
               resource: 'markdownResource',
               data: {
                  markdown: mdText
               }
            } );

            testEventBus.flush();

            expect( widgetScope.model.html )
               .toMatch( `<h1[^>]*\\s+id="${widgetScope.id( 'heading' )}"[^>]*>` );
            expect( widgetScope.model.html )
               .toMatch( `<h2[^>]*\\s+id="${widgetScope.id( 'second-heading' )}"[^>]*>` );
            expect( widgetScope.model.html )
               .toMatch( `<h3[^>]*\\s+id="${widgetScope.id( 'dritte-berschrift-stra-e' )}"[^>]*>` );

            const linkUrl = `http://localhost:8000/index.html#/widgetBrowser/${
               widgetScope.id( 'second-heading' )}`;
            expect( widgetScope.model.html )
               .toMatch( `<a[^>]*\\s+href="${linkUrl}"[^>]*>Second Heading</a>` );
         } );

      }
   );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'with a configured feature markdown and attribute resource when attribute is not set', () => {

      createSetup( {
         markdown: {
            parameter: 'anchor',
            resource: 'markdownResource'
         }
      } );

      beforeEach( axMocks.widget.load );

      afterEach( axMocks.tearDown );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'uses a markdown resource and is listening to didReplace event (R1.4)', () => {
         expect( widgetEventBus.subscribe )
            .toHaveBeenCalledWith( 'didReplace.markdownResource', jasmine.any( Function ) );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'uses a markdown resource and is listening to didUpdate event (R1.4)', () => {
         expect( widgetEventBus.subscribe )
            .toHaveBeenCalledWith( 'didUpdate.markdownResource', jasmine.any( Function ) );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'logs a warning if we do not have a URL (R1.5)', () => {
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {}
         } );

         testEventBus.flush();
         expect( log.warn ).toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'does not log a warning if the resource is null', () => {
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: null
         } );

         testEventBus.flush();
         expect( log.warn ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'converts the markdown file content to HTML (R1.6)', () => {
         expectRequest( 'test.md', 200, '*Emphasized*' )();

         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {
               _links: {
                  markdown: {
                     href: 'test.md'
                  }
               }
            }
         } );
         testEventBus.flush();
         flushRequests();

         expect( widgetScope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'resolves images with relative paths (R1.7)', () => {
         const url = 'http://laxarjs.org/A/B/test.md';
         let mdText = '';
         mdText += '![Image 1](http://my.example.org/docs/images/image1.png)';
         mdText += '![Image 2](//my.example.org/docs/images/image2.png)';
         mdText += '![Image 3](file:///docs/images/image3.png)';
         mdText += '![Image 4](/docs/images/image4.png)';
         mdText += '![Image 5](docs/images/image5.png)';
         mdText += '![Image 6](./docs/images/image6.png)';
         mdText += '![Image 7](../docs/images/image7.png)';
         expectRequest( url, 200, mdText )();
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {
               _links: {
                  markdown: {
                     href: url
                  }
               }
            }
         } );
         testEventBus.flush();
         flushRequests();

         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="http://my.example.org/docs/images/image1.png"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="//my.example.org/docs/images/image2.png"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="file:///docs/images/image3.png"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/docs/images/image4.png"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image5.png"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/B/docs/images/image6.png"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<img[^>]*\\s+src="http://laxarjs.org/A/docs/images/image7.png"[^>]*>|' +
                      '<img[^>]*\\s+src="http://laxarjs.org/A/B/../docs/images/image7.png"[^>]*>' );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'resolves hyperlinks with relative paths (R1.8)', () => {
         const url = 'http://laxarjs.org/A/B/test.md';
         let mdText = '';
         mdText += '[Link 1](http://my.example.org/docs/pages/link1.html)';
         mdText += '[Link 2](//my.example.org/docs/pages/link2.html)';
         mdText += '[Link 3](file:///docs/pages/link3.html)';
         mdText += '[Link 4](/docs/pages/link4.html)';
         mdText += '[Link 5](docs/pages/link5.html)';
         mdText += '[Link 6](./docs/pages/link6.html)';
         mdText += '[Link 7](../docs/pages/link7.html)';
         mdText += '[Link 8](../docs/pages/link8.html#chapter)';
         expectRequest( url, 200, mdText )();
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {
               _links: {
                  markdown: {
                     href: url
                  }
               }
            }
         } );
         testEventBus.flush();
         flushRequests();

         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="http://my.example.org/docs/pages/link1.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="//my.example.org/docs/pages/link2.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="file:///docs/pages/link3.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/docs/pages/link4.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link5.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/B/docs/pages/link6.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link7.html"[^>]*>|' +
                      '<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link7.html"[^>]*>' );
         expect( widgetScope.model.html )
            .toMatch( '<a[^>]*\\s+href="http://laxarjs.org/A/docs/pages/link8.html#chapter"[^>]*>|' +
                      '<a[^>]*\\s+href="http://laxarjs.org/A/B/../docs/pages/link8.html#chapter"[^>]*>' );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'resolves links to anchors of headings (R1.9)', () => {
         const url = 'http://laxarjs.org/A/B/test.md';
         let mdText = '';
         mdText += '# Heading\n';
         mdText += '## Second Heading\n';
         mdText += '### Dritte Überschrift: Straße\n';
         mdText += '[Second Heading](#second-heading)\n';
         expectRequest( url, 200, mdText )();
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {
               _links: {
                  markdown: {
                     href: url
                  }
               }
            }
         } );
         testEventBus.flush();
         flushRequests();

         expect( widgetScope.model.html )
            .toMatch( `<h1[^>]*\\s+id="${widgetScope.id( 'heading' )}"[^>]*>` );
         expect( widgetScope.model.html )
            .toMatch( `<h2[^>]*\\s+id="${widgetScope.id( 'second-heading' )}"[^>]*>` );
         expect( widgetScope.model.html )
            .toMatch( `<h3[^>]*\\s+id="${widgetScope.id( 'dritte-berschrift-stra-e' )}"[^>]*>` );

         const linkUrl = `http://localhost:8000/index.html#/widgetBrowser/${
            widgetScope.id( 'second-heading' )}`;
         expect( widgetScope.model.html )
            .toMatch( `<a[^>]*\\s+href="${linkUrl}"[^>]*>Second Heading</a>` );
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'with a configured feature markdown with an URL and an resource', () => {

      createSetup( {
         markdown: {
            parameter: 'anchor',
            url: 'test.md',
            resource: 'markdownResource',
            attribute: 'markdown'
         }
      } );

      beforeEach( expectRequest( 'test.md', 200, '*Emphasized*' ) );

      beforeEach( axMocks.widget.load );

      beforeEach( flushRequests );

      afterEach( axMocks.tearDown );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'displays the text from the URL until the resource is published (R1.10)', () => {
         expect( widgetScope.model.html ).toMatch( /<em>Emphasized<\/em>/ );
         testEventBus.publish( 'didReplace.markdownResource', {
            resource: 'markdownResource',
            data: {
               'markdown': 'Text from the *resource*'
            }
         } );
         testEventBus.flush();
         expect( widgetScope.model.html ).toMatch( /Text from the <em>resource<\/em>/ );
      } );
   } );

} );
