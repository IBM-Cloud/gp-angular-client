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

(function(angular) {
    'use strict';
angular.module('sampleApp', ['ngRoute', 'gp'])
.config(['$routeProvider', '$locationProvider',
  function($routeProvider, $locationProvider) {
    $routeProvider
      .when('/view2', {
        templateUrl: 'demoApp/view2.html',
        controller: 'View2Ctrl',
        controllerAs: 'view'
      })
      .when('/view1', {
        templateUrl: 'demoApp/view.html',
        controller: 'View1Ctrl',
        controllerAs: 'view'
      })
      .otherwise("/view1");

    $locationProvider.html5Mode(true);
}])
.config(['GlobalizationPipelineServiceProvider', function(GlobalizationPipelineServiceProvider) {

    GlobalizationPipelineServiceProvider.setGpConfig({
        bundleId: "petrolService",
        //targetLang: "fr",
        loadingText: "loading...",
        credentials: {
            /*  Put the credentials here from the Bluemix console */
        }});
}])
.controller('MainCtrl', ['$route', '$routeParams', '$location',
  function($route, $routeParams, $location) {
    this.$route = $route;
    this.$location = $location;
    this.$routeParams = $routeParams;
}])
.controller('View1Ctrl', ['$routeParams', 'GlobalizationPipelineService', function($routeParams, gp) {
  gp.setBundleId("petrolService");
  gp.removeTargetLang();

  this.name = "View1Ctrl";
  this.bundle = gp.getBundleId();
  this.params = $routeParams;
}])
.controller('View2Ctrl', ['$routeParams', 'GlobalizationPipelineService', function($routeParams, gp) {
  gp.setBundleId("petrolService_view2");

  this.name = "View2Ctrl";
  this.bundle = gp.getBundleId();
  this.params = $routeParams;
}])
.controller('SupportedLanguagesController', ['$scope', '$route', 'GlobalizationPipelineService', function($scope, $route, gp) {
    // get the available languages
    gp.getAvailableLanguages().then(function successCallback(resp) {  // TODO remove processing and just use returned object
        // stash the source & target languages in our scope as "avaiableLangs"
        $scope.availableLangs = [resp.data.bundle.sourceLanguage];
        angular.forEach(resp.data.bundle.targetLanguages, function(newLang) {
            $scope.availableLangs.push(newLang);
        })
    }, function errorCallback(error) {
        console.log("supportedLanages error:", resp);
    });

    $scope.switchLanguage = function(newLang) {
        gp.setTargetLang(newLang);
        $route.reload();
    };
}]);
})(window.angular);