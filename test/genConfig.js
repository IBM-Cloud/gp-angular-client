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

const request = require('request-promise-native');
const GP = require('g11n-pipeline');
const fs = require('fs');

const CONFIG_FILE='test/local-core-config.js';

const BUNDLE_ID='myBundleId';
const STRS_EN = {"HELLO": "Hello World!", "GOODBYE": "Goodbye and good day."};
const STRS_DE = {
    // ?
};
const STRS_FR = {"HELLO": "Bienvenidos a mi mundo!"};

const BUNDLE_ID2='anotherBundle';
const STRS_EN2 = {"HELLO": "Hello Alternate World!", "GOODBYE": "Goodbye and good day."};

if(!process.env.GP_FAKE_BROKER) {
    throw new Error('config error');
}

const config = request(process.env.GP_FAKE_BROKER)
.then(raw => JSON.parse(raw));

// write config
const writeConfig = config
.then((config) => {
    fs.writeFileSync(CONFIG_FILE,
        '//generated.\nGP_CONFIG.credentials=' + JSON.stringify(config.credentials)+'\n'+
        'GP_CREDENTIAL_ONLY_CONFIG.credentials = GP_CONFIG.credentials;\n');
});

// upload data
const client = config.then(config => GP.getClient(config));

const uploadData = client.then(client => 
    new Promise((resolve,reject) => {
        console.log('Creating', BUNDLE_ID);
        client.bundle(BUNDLE_ID).create({ sourceLanguage: 'en', targetLanguages: ["es", "fr"] }, 
                    (err,data) => { if(err) return reject(err); return resolve(data); })
    })
    .then(new Promise((resolve,reject) => {
        client.bundle(BUNDLE_ID).uploadStrings({ languageId: 'en', strings: STRS_EN }, 
                    (err,data) => { if(err) return reject(err); return resolve(data); })
    })).then(new Promise((resolve,reject) => {
        client.bundle(BUNDLE_ID).uploadStrings({ languageId: 'de', strings: STRS_DE }, 
                    (err,data) => { if(err) return reject(err); return resolve(data); })
    })).then(new Promise((resolve,reject) => {
        client.bundle(BUNDLE_ID).uploadStrings({ languageId: 'fr', strings: STRS_FR }, 
                    (err,data) => { if(err) return reject(err); return resolve(data); })
    })).then(new Promise((resolve,reject) => {
        console.log('Creating', BUNDLE_ID2);
        client.bundle(BUNDLE_ID2).create({ sourceLanguage: 'en', targetLanguages: ["es", "fr"] }, 
                    (err,data) => { if(err) return reject(err); return resolve(data); })
    }))
    .then(new Promise((resolve,reject) => {
        client.bundle(BUNDLE_ID2).uploadStrings({ languageId: 'en', strings: STRS_EN2 }, 
                    (err,data) => { if(err) return reject(err); return resolve(data); })
    }))
);

config
.then(x => console.log('Fetched temporary configuration'))
.then(client)
.then(x => console.log('Loaded GP client'))
.then(writeConfig)
.then(x => console.log('Config file written:', CONFIG_FILE))
.then(uploadData)
.then(x => console.log('Bundles written:', BUNDLE_ID, BUNDLE_ID2))
.then(x => console.log('Finishing up…'), err => console.error(err));
