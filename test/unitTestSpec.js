/*
 * Copyright IBM Corp. 2015
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function(angular, gp) {


describe("SDK test suite", function() {

    var undefinedVar;
    var gp;
    var gpVersion = "v2";
    var gp_config = {
            bundleId: "myBundleId",
            loadingText: "my loading text...",
            credentials: {
                uri: "https://gp-dev-rest.ng.bluemix.net/translate",
                instanceId: "myServiceInstanceHexadecimalId",
                userId: "myReaderUserId",
                password: "myReaderPassword"
            }};
    var credential_only_config = {
            credentials: {
                uri: "https://gp-dev-rest.ng.bluemix.net/translate",
                instanceId: "myServiceInstanceHexadecimalId",
                userId: "myReaderUserId",
                password: "myReaderPassword"
            }};
    var bundle2Id = "anotherBundle";
    // url:       gp_config.credentials.uri + '/rest' + '/' + gpBundleKey
    // bundleKey: gp_config.credentials.instanceId + '/' + gpVersion + '/bundles' + '/' + bundleId;
    var bundleInfoUrl      = gp_config.credentials.uri + '/rest' + '/' + gp_config.credentials.instanceId + '/' + gpVersion + '/bundles' + '/' + gp_config.bundleId;
    var bundleEnglishUrl   = bundleInfoUrl + "/en";
    var bundleSpanishUrl   = bundleInfoUrl + "/es";
    var bundleMissingUrl   = bundleInfoUrl + "/de";
    var bundle2InfoUrl     = gp_config.credentials.uri + '/rest' + '/' + gp_config.credentials.instanceId + '/' + gpVersion + '/bundles' + '/' + bundle2Id;
    var bundle2EnglishUrl  = bundle2InfoUrl + "/en";
    var undefinedBundleUrl = gp_config.credentials.uri + '/rest' + '/' + gp_config.credentials.instanceId + '/' + gpVersion + '/bundles' + '/undefined';
    var undefinedNoLangUrl = undefinedBundleUrl + "/undefined";

    beforeEach(function() {
        module('gp');
    });

    beforeEach(function() {
        inject(function(_GlobalizationPipelineService_) {
            gp = _GlobalizationPipelineService_;
        });
        gp.setConfig(gp_config);
    });

    // setup mock $http backend
    var $httpBackend;

    beforeEach(inject(function($injector) {
      // Set up the mock http service responses
      $httpBackend = $injector.get('$httpBackend');
      // bundle info response
      $httpBackend.when('GET', bundleInfoUrl)
      // data.bundle.sourceLanguage
      // data.bundle.targetLanguages
        .respond(200, {"bundle": {"sourceLanguage": "en",  "targetLanguages": ["es", "fr"]}});
      // translation response
      $httpBackend.when('GET', bundleEnglishUrl)
      // data.resourceStrings
        .respond(200, {"resourceStrings": {"HELLO": "Hello World!", "GOODBYE": "Goodbye and good day."}});
      $httpBackend.when('GET', bundleSpanishUrl)
      // data.resourceStrings
        .respond(200, {"resourceStrings": {"HELLO": "Bienvenidos a mi mundo!"}});
      $httpBackend.when('GET', undefinedBundleUrl)
      .respond(404, {"statusText": "not found"});
      $httpBackend.when('GET', undefinedNoLangUrl)
      .respond(404, {"statusText": "not found"});
      $httpBackend.when('GET', bundleMissingUrl)
      .respond(404, {});
      $httpBackend.when('GET', bundle2InfoUrl)
      // data.bundle.sourceLanguage
      // data.bundle.targetLanguages
        .respond(200, {"bundle": {"sourceLanguage": "en",  "targetLanguages": ["es", "fr"]}});
      // translation response
      $httpBackend.when('GET', bundle2EnglishUrl)
      // data.resourceStrings
        .respond(200, {"resourceStrings": {"HELLO": "Hello Alternate World!", "GOODBYE": "Goodbye and good day."}});
     }));

    afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
       });

    it('should have sent a GET request for getAvailableLanguages and returned source and target languages', function() {
        gp.getAvailableLanguages().then(function successCallback(resp) {
            // TODO refactor to use cache
            expect(resp.data.bundle.sourceLanguage).toEqual('en');
            expect(resp.data.bundle.targetLanguages[0]).toEqual('es');
            expect(resp.data.bundle.targetLanguages[1]).toEqual('fr');
        }, function errorCallback(error) {
            console.log("supportedLanages error:", error);
        });

        $httpBackend.expectGET(bundleInfoUrl);
        $httpBackend.flush();
    });

    it('should translate the key', function() {
        gp.translate("HELLO").then(function successCallback(resp) {
            expect(resp).toEqual('Hello World!');
        }, function errorCallback(error) {
            console.log("translate error:", error);
        });

        $httpBackend.expectGET(bundleEnglishUrl);
        $httpBackend.flush();
    });

    it('should translate the key with undefined bundle and lang', function() {
        gp.translate("HELLO", undefinedVar, undefinedVar).then(function successCallback(resp) {
            expect(resp).toEqual('Hello World!');
        }, function errorCallback(error) {
            console.log("translate with undefines error:", error);
        });

        $httpBackend.expectGET(bundleEnglishUrl);
        $httpBackend.flush();
    });

    it('should generate an error without a bundle ID', function() {
        gp.setConfig(credential_only_config);
        gp.translate("HELLO").then(function successCallback(resp) {
            expect(true).toEqual(false);    // fail it if here
        }, function errorCallback(error) {
            // supposed to happen
        });

        $httpBackend.flush();
    });

    it('should translate to source language if invalid target lang', function() {
        gp.translate("HELLO", undefinedVar, "de").then(function successCallback(resp) {
            expect(resp).toEqual('Hello World!');
        }, function errorCallback(error) {
            console.log("translate invalid lang error:", error);
        });

        $httpBackend.flush();
    });

    it('should translate the key with bundle change', function() {
        gp.setBundleId(bundle2Id);
        gp.translate("HELLO").then(function successCallback(resp) {
            expect(resp).toEqual('Hello Alternate World!');
        }, function errorCallback(error) {
            console.log("translate error:", error);
        });

        $httpBackend.expectGET(bundle2EnglishUrl);
        $httpBackend.flush();
    });

    it('should translate the key in spanish if setTaretLang set to "es"', function() {
        gp.setTargetLang("es");
        gp.translate("HELLO").then(function successCallback(resp) {
            expect(resp).toEqual('Bienvenidos a mi mundo!');
        }, function errorCallback(error) {
            console.log("spanish with setTargetLang error:", error);
        });

        $httpBackend.expectGET(bundleSpanishUrl);
        $httpBackend.flush();
    });

    it('should translate the key in spanish', function() {
        gp.translate("HELLO", "myBundleId", "es").then(function successCallback(resp) {
            expect(resp).toEqual('Bienvenidos a mi mundo!');
        }, function errorCallback(error) {
            console.log("spanish with parms error:", error);
        });

        $httpBackend.expectGET(bundleSpanishUrl);
        $httpBackend.flush();
    });

    it('should translate the key in spanish even if bundle id is undefined', function() {
        gp.translate("HELLO", undefinedVar, "es").then(function successCallback(resp) {
            expect(resp).toEqual('Bienvenidos a mi mundo!');
        }, function errorCallback(error) {
            console.log("spanish with undefined bundle error:", error);
        });

        $httpBackend.expectGET(bundleSpanishUrl);
        $httpBackend.flush();
    });

    it('should return the configured loading text', function() {
        expect(gp.getLoadingText()).toEqual(gp_config.loadingText);
    });

});

})(window.angular);