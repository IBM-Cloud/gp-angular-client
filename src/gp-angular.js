/*
 * Copyright IBM Corp. 2015, 2016
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

/**
 * this AngularJS code provides support for GlobalizationPipeline
 * via the GlobalizationPipeline Service running on IBM's Bluemix
 */
(function(angular) {


'use strict';

var module = angular.module('gp', []);

module.provider('GlobalizationPipelineService', [ function() {

    var DEBUG = false;
    var gpVersion = "v2";
    var gp_config;
    var resourceCache;

    this.setGpConfig = function(newOptions) {
        gp_config = angular.copy(newOptions);
        // verify URL
        gp_config.credentials.url = gp_config.credentials.url || gp_config.credentials.uri;
        if (!gp_config.credentials.url) {
            console.log('GlobalizationPipelineService: missing credentials.url');
            throw new Error('GlobalizationPipelineService: missing credentials.url');
        }

        // if the URL ends with “/translate”,  add “/rest”
        if( /\/translate$/.test(gp_config.credentials.url)) {
            gp_config.credentials.url = gp_config.credentials.url + '/rest';
        }
    };

    this.$get = [ "$rootScope", "$log", "$q", "$http", "$window", "$interpolate", function($rootScope, $log, $q, $http, $window, $interpolate) {

        function logImpl(type, message) {
            if (type) {
                $log[type]("[GlobalizationPipelineService] " + message);
            }
        }

        function logDebug(message) {
            logImpl("debug", message);
        }
        function logInfo(message) {
            logImpl("info", message);
        }
        function logError(message) {
            logImpl("error", message);
        }
        function logWarning(message) {
            logImpl("warn", message);
        }

        function getLoadingText() {
            return gp_config.loadingText;
        }

        function setDebug() {
            DEBUG = true;
        }

        function isDebug() {
            return DEBUG;
        }

        function setTargetLang(newLang) {
            gp_config.targetLang = angular.copy(newLang);
        }

        function removeTargetLang() {
            delete gp_config.targetLang;
        }

        function setBundleId(newBundleId) {
            gp_config.bundleId = angular.copy(newBundleId);
        }

        function getBundleId() {
            return gp_config.bundleId;
        }

        /*
         * added for unit testing
         */
        function setConfig(newConfig) {
            gp_config = angular.copy(newConfig);
        }

        // cache getter with lazy initialization
        function getCache() {
            if(resourceCache === undefined) {
                resourceCache = new Cache();
            }
            return resourceCache;
        }

        function getBundleKey(bundleId) {
          return gp_config.credentials.instanceId + '/' + gpVersion + '/bundles' + '/' + bundleId;
        }

        /**
         * Returns the list of available translations for the bundle
         */
        function getAvailableLanguages() {
          return getBundleInfo(gp_config.bundleId);
        }

        /**
         * actual rest call to GP to retrieve the bundle info
         */
        function getBundleInfo(bundleId) {
            var restDefer = $q.defer();
            var url = gp_config.credentials.url
                  + '/' + gp_config.credentials.instanceId + '/' + gpVersion + '/bundles' + '/' + bundleId;
            if(DEBUG) {
                console.log('[getBundleInfo] GET ' + url);
            }

            var request = {
                    method: 'get',
                    url: url,
                    headers: {
                        Authorization: 'Basic ' + window.btoa(gp_config.credentials.userId + ':' + gp_config.credentials.password),
                    },
                    dataType: "json",
                    cache: "true"
            };

            $http(request).then(function succcessCallBack(resp) {
                if(DEBUG) {
                    logDebug("[getBundleInfo] rest call to GP was successful");
                    console.log("resp:", resp);
                }
                restDefer.resolve(resp);
            }, function errorCallback(error) {
                logError("[getBundleInfo] rest call to GP failed! ["+error+"]");
                if(DEBUG) {
                    console.log("error: ", error);
                }
                restDefer.reject(error);
            });

            return restDefer.promise;

        }

        /*
         * fallback determines the correct language fallback
         *
         * The avail param is expected to be an array
         */
        function fallback(l, avail) {
            if(DEBUG) {
              logDebug("[fallback] l["+l+"] avail["+avail+"]");
            }
            var map = {
                'zh-TW': 'zh-Hant-TW',
                'zh-HK': 'zh-Hant-HK',
                'zh-CN': 'zh-Hans-CN',
                'zh': 'zh-Hans'
            };
            var arrayLength = avail.length;
            var myAvail = {};
            for (var i = 0; i < arrayLength; i++) {
              myAvail[avail[i]] = true;
            }
            if(map.hasOwnProperty(l)) {
                l = map[l]; // fallback
            }

            var splits = l.split('-');
            while(splits.length > 0) {
                if(myAvail.hasOwnProperty(l)) {
                    if(DEBUG) {
                      logDebug("[fallback] got it! l["+l+"]");
                    }
                    return l;
                }
                splits.pop(); //  zh-Hant-TW --> zh-Hant
                l = splits.join('-');  // [ 'zh', 'Hant' ] --> 'zh-Hant'
            }
            if(DEBUG) {
              logDebug("[fallback] RUH ROH...returning null");
            }
            return null;
        }

        /**
         * normalizeLanguage ensures that we have a language and it's valid against available languages from the bundle.
         *
         * returns a promise since we may have to look up what the available languages are if it's not already cached.
         */
        function normalizeLanguage(lang, bundleId) {
            var languageDeferred = $q.defer();
            if(DEBUG) {
                logDebug("[normalizeLanguage] entered with lang[" + lang + "] for bundleId["+bundleId+"]");
            }

            // ensure we specify SOMETHING as the target language.
            // if nothing was passed, check gp_config.
            // if nothing in gp_config, use browser language
            if (lang === undefined) {
              if (gp_config === undefined || gp_config.targetLang === undefined) {
                  lang = $window.navigator.language || $window.navigator.userLanguage;
              } else {
                  lang = gp_config.targetLang;
              }
            }
            if(DEBUG) {
                logDebug("[normalizeLanguage] using lang[" + lang + "]");
            }

            var bundleKey = getBundleKey(bundleId);

            // if we already have what we need return a resolved promise
            if(getCache().hasAvailableLanguages(bundleKey)) {
              lang = fallback(lang, getCache().getAvailableLanguages(bundleKey));
              if(lang === null) {
                logWarning("[normalizeLanguage] fallback returned null...using source lang");
                lang = getCache().getSourceLanguage(bundleKey);
              }
              languageDeferred.resolve(lang);

              if(DEBUG) {
                logDebug("[normalizeLanguage] have available langauges returning resolved promise");
              }
              return languageDeferred.promise;
            }

            // if we're not already waiting we need to make rest call and add it to the cache
            if(!getCache().hasAvailablePromise(bundleKey)) {
              if(DEBUG) {
                logDebug("[normalizeLanguage] adding new available languages");
              }
              getCache().addAvailableLanguages(bundleKey, getBundleInfo(bundleId));
            }

            // wait on promise
            if(DEBUG) {
              logDebug("[normalizeLanguage] waiting on promise");
            }
            getCache().getAvailablePromise(bundleKey).then(function successCallback(resp) {
                  if(DEBUG) {
                    logDebug("[normalizeLanguage] success promise returned");
                    console.log("[normalizeLanguage] resp: ", resp);
                  }
                  // build the list of availble languages
                  var availLangs = [resp.data.bundle.sourceLanguage];
                  angular.forEach(resp.data.bundle.targetLanguages, function(newLang) {
                    availLangs.push(newLang);
                  });
                  getCache().setAvailableLanguages(bundleKey, resp.data.bundle.sourceLanguage, availLangs)

                  lang = fallback(lang, getCache().getAvailableLanguages(bundleKey));
                  if(lang === null) {
                    logWarning("[normalizeLanguage] fallback returned null...using source lang");
                    lang = getCache().getSourceLanguage(bundleKey);
                  }
                  languageDeferred.resolve(lang);
              }, function errorCallback(error) {
                  var result = '[normalizeLanguage] ERR: ' + JSON.stringify(error);
                  logDebug(result);
                  console.log("error: ", error);
                  languageDeferred.reject(result);
              });

            return languageDeferred.promise;
        }

        /**
         * Returns a globalized string
         *
         * key: Key of the string in to the resource bundle targetLang:
         * [optional] target language ID
         */
        function translate(key, bundleId, lang, values) {
            var translationDeferred = $q.defer();

            if (!key) {
                logError("[translate] key is undefined.");
                return translationDeferred.promise;
            }

            if(DEBUG) {
                logDebug("[translate] key[" + key + "] bundleId["+bundleId+"] targetLang[" + lang + "] values[" + values + "]");
            }

            if(!gp_config) {
                logError("[translate] no configuration found.");
                translationDeferred.reject("missing GP configuration!");
                return translationDeferred.promise;
            }

            // use config bundleId if not passed in
            if(bundleId === undefined) {
              bundleId = gp_config.bundleId;
            }

            var result;
            normalizeLanguage(lang, bundleId).then(function successCallback(normalizedLang) {
              // we have a normalized language so we can do the actual translation now
              getResourceStrings(bundleId, normalizedLang).then(function successCallback(resp) {
                  result = resp[key];
                  if (result === undefined) {
                      logInfo("[translate] [" + key + "] undefined...returning key");
                      result = key;
                  }

                  // Check if the translation string has a variable expression
                  var interpolateFn = $interpolate(result, true);
                  if (values && interpolateFn) {
                      try {
                          // Use the JSON data to populate the variables
                          var dataContext = JSON.parse(values);
                          var interpolatedString = interpolateFn(dataContext);
                          if (DEBUG) {
                              $log.debug("interpolatedString: " + interpolatedString);
                          }
                          result = interpolatedString;
                      } catch (e) {
                          $log.error("Error interpolating optional values: " + e);
                      }
                  }

                  translationDeferred.resolve(result);
              }, function errorCallback(error) {
                  result = 'ERR: ' + error.toString();
                  console.log("[translate] error: ", error);
                  translationDeferred.reject(result);
              });
            // if we couldn't normalize the lanauge just reject the translation
            }, function errorCallback(error) {
                  result = 'ERR: ' + error.toString();
                  console.log("[translate] error: ", error);
                  translationDeferred.reject(result);
            });

            return translationDeferred.promise;
        }

        /*
         * manages getting the resource strings out of the cache. if nothing is in the cache for this bundle key a new cache entry request is made.
         */
        function getResourceStrings(bundleId, languageId) {
            if(DEBUG) {
                logDebug("[getResourceStrings] bundleId["+bundleId+"] targetLang[" + languageId + "]");
            }

            // use bundle key and see if we have a cached response yet
            var gpBundleKey = getBundleKey(bundleId);
            if(!getCache().hasBundle(gpBundleKey, languageId)) {
                return newCacheRequest(gpBundleKey, languageId);
            }
            if(DEBUG) {
              console.log("[getResourceStrings] cache:", getCache());
            }
            // if we don't have a response yet, return the promise
            if(!getCache().hasStrings(gpBundleKey, languageId)) {
                if(DEBUG) {
                    logDebug("[getResourceStrings] have a promise for["+gpBundleKey+"]");
                }
                // turn off translation complete since we have to hit GP
                $rootScope.gpTranslationComplete = false;
                return getCache().getPromise(gpBundleKey, languageId);
            }

            // have a cache entry and no outstanding promise, return a resolved promise
            if(DEBUG) {
                logDebug("[getResourceStrings] cache hit! already have resourceStrings for["+gpBundleKey+"] languageId["+languageId+"]");
            }
            var noDefer = $q.defer();
            noDefer.resolve(getCache().getStrings(gpBundleKey, languageId));
            return noDefer.promise;
        }

        /*
         * requested bundle key was not found in cache so we need to do the GP rest API call for this bundle key.
         *
         * put the promise in the cache for subsequent calls until the rest call returns. Cache the strings when it returns & remove the promise.
         */
        function newCacheRequest(gpBundleKey, languageId) {
            if(DEBUG) {
                logDebug("[newCacheRequest] gpBundleKey["+gpBundleKey+"] languageId["+languageId+"]");
            }
            var restDefer = $q.defer();

            getCache().addBundle(gpBundleKey, languageId, restDefer.promise);

            var url = gp_config.credentials.url
             +  '/' + gpBundleKey + '/' + languageId;
            if(DEBUG) {
                console.log('[newCacheRequest] GET ' + url);
            }

            var request = {
                    method: 'get',
                    url: url,
                    headers: {
                        Authorization: 'Basic ' + window.btoa(gp_config.credentials.userId + ':' + gp_config.credentials.password),
                    },
                    dataType: "json",
                    cache: "true"
            };

            $http(request).then(function succcessCallBack(resp) {
                if(DEBUG) {
                    logDebug("[newCacheRequest] rest call to GP was successful");
                    console.log("[newCacheRequest] resp:", resp);
                }
                restDefer.resolve(resp.data.resourceStrings);
                getCache().setStrings(gpBundleKey, languageId, resp.data.resourceStrings);
               $rootScope.gpTranslationComplete = true;
            }, function errorCallback(error) {
                logError("[newCacheRequest] rest call to GP failed! ["+error+"]");
                if(DEBUG) {
                    console.log("error: ", error);
                }
                restDefer.reject(error);
                getCache().setStrings(gpBundleKey, languageId, {});
                $rootScope.gpTranslationComplete = true;
            });

            return restDefer.promise;
        }

        return {
            getAvailableLanguages: getAvailableLanguages,
            translate: translate,
            getLoadingText: getLoadingText,
            setTargetLang: setTargetLang,
            removeTargetLang: removeTargetLang,
            setBundleId: setBundleId,
            getBundleId: getBundleId,
            // exposed for directive
            setDebug: setDebug,
            isDebug: isDebug,
            // exposed for testing
            setConfig: setConfig,

        };

    } ];

    /*
     * Cache class:
     *      Provides for the caching of resource strings returned from various GP rest API calls.
     *
     * API is:
     *      ...hasBundle = function(bundleKey, lang)
     *      ...addBundle = function(bundleKey, lang, deferPromise)
     *      ...setStrings = function(bundleKey, lang, resourceStrings)
     *      ...getStrings = function(bundleKey, lang)
     *      ...hasStrings = function(bundleKey, lang)
     *      ...getPromise = function(bundleKey, lang)
     *
     * TODO implement cache timer & clear
     */
    var Cache = function() {
       this.cache = {};
    };

    // bundle info prototypes
    Cache.prototype.hasAvailableLanguages = function (bundleKey) {
       if(this.cache[bundleKey] === undefined) {
           return false;
       }
       return this.cache[bundleKey].languages.availableLanguages === undefined ? false : true;
    };
    Cache.prototype.addAvailableLanguages = function(bundleKey, deferPromise) {
       // make sure the bundleKey exists in cache
       if(this.cache[bundleKey] === undefined) {
           this.cache[bundleKey] = new CacheEntry(bundleKey);
       }

       // add the language entry if it's not already there
       if(this.cache[bundleKey].languages === undefined) {
           this.cache[bundleKey].languages = new CacheLanguagesEntry(deferPromise);
       }
    };
    Cache.prototype.setAvailableLanguages = function(bundleKey, sourceLang, availableLanguages) {
      this.cache[bundleKey].languages.sourceLanguage = sourceLang;
      this.cache[bundleKey].languages.availableLanguages = availableLanguages;
      delete this.cache[bundleKey].languages.promise;
    };
    Cache.prototype.getAvailableLanguages = function(bundleKey) {
      return this.cache[bundleKey].languages.availableLanguages;
    };
    Cache.prototype.getSourceLanguage = function(bundleKey) {
      return this.cache[bundleKey].languages.sourceLanguage;
    };
    Cache.prototype.getAvailablePromise = function(bundleKey) {
       return this.cache[bundleKey].languages.promise;
    };
    Cache.prototype.hasAvailablePromise = function(bundleKey) {
      if(this.cache[bundleKey] === undefined) {
        return false;
      }
      return this.cache[bundleKey].languages.promise === undefined ? false : true;
    };

    // bundle languages prototypes
    Cache.prototype.hasBundle = function(bundleKey, lang) {
       if(this.cache[bundleKey] === undefined) {
           return false;
       }
       return this.cache[bundleKey][lang] === undefined ? false : true;
    };
    Cache.prototype.addBundle = function(bundleKey, lang, deferPromise) {
       // make sure the bundleKey exists in cache
       if(this.cache[bundleKey] === undefined) {
           this.cache[bundleKey] = new CacheEntry(bundleKey);
       }

       // add the language entry if it's not already there
       if(this.cache[bundleKey][lang] === undefined) {
           this.cache[bundleKey][lang] = new CacheLangEntry(lang, deferPromise);
       }
    };
    Cache.prototype.setStrings = function(bundleKey, lang, resourceStrings) {
       this.cache[bundleKey][lang].resourceStrings = resourceStrings;
       delete this.cache[bundleKey][lang].promise;
    };
    Cache.prototype.getStrings = function(bundleKey, lang) {
       return this.cache[bundleKey][lang].resourceStrings;
    };
    Cache.prototype.hasStrings = function(bundleKey, lang) {
       return this.cache[bundleKey][lang].resourceStrings === undefined ? false : true;
    };
    Cache.prototype.getPromise = function(bundleKey, lang) {
       return this.cache[bundleKey][lang].promise;
    };



    // CacheEntry class
    var CacheEntry = function(key) {
       this.key = key;
    };

    // CacheLanguagesEntry class
    var CacheLanguagesEntry = function(promise) {
      this.promise = promise;
    };

    // CacheLangEntry class
    var CacheLangEntry = function(lang, deferPromise) {
       this.lang = lang;
       this.promise = deferPromise;
    };

} ]);

/**
 * 'gpTranslate' directive
 *
 * Translate a String for an optional language ID
 *
 * eg.
 *  <span gp-translate="aKey"></span>
 *  <span gp-translate="aKey" lang="es"></span>
 */
module.directive('gpTranslate', ['$log', 'GlobalizationPipelineService', function($log, gp) {
    return {
        restrict: "AEC",
        scope: {
            gpTranslate: "@",
            key: "@?",
            lang: "@?",
            bundle: "@?",
            values: "@?"
        },
        link: function(scope, elm, attrs) {
            scope.$watch('gpTranslate', function() {
                var DEBUG = gp.isDebug();

                if(DEBUG) {
                    $log.debug("[gp directive] scope.gpTranslate[" + scope.gpTranslate + "] scope.key["+scope.key+"] scope.lang[" + scope.lang + "] scope.bundle[" + scope.bundle + "] scope.values[" + scope.values + "]");
                }

                var bundleKey;
                if(scope.key) {
                  bundleKey = scope.key;
                }
                if(scope.gpTranslate) {
                  bundleKey = scope.gpTranslate;
                }

                var translationPromise = gp.translate(bundleKey, scope.bundle, scope.lang, scope.values);

                if(DEBUG) {
                    $log.debug("[gp directive] translation called...");
                }

                translationPromise.then(function(string) {
                    if (string === undefined) {
                        string = "undefined";
                    }
                    if(DEBUG) {
                        $log.debug("[gp directive] promise resolved...value["+string+"]");
                    }

                    elm.text(string);
                }, function(error) {
                    if(DEBUG) {
                        $log.debug("[gp directive] promise rejected for["+scope.gpTranslate+"]");
                    }
                    elm.text(scope.gpTranslate);
                });

                elm.text(gp.getLoadingText());

            }, true);

        }
    };
} ]);
})(window.angular);
