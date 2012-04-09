// App for ActivitySpam
//
// Copyright 2012 StatusNet Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var databank = require('databank'),
    dateFormat = require('dateformat'),
    crypto  = require('crypto'),
    _ = require('underscore'),
    DatabankObject = databank.DatabankObject,
    NoSuchThingError = databank.NoSuchThingError;

var App = DatabankObject.subClass('app');

App.schema = {
    'app': {pkey: 'consumer_key',
	    fields: ['title',
                     'description',
                     'host',
                     'secret',
                     'created',
                     'updated'],
	    indices: ['title']}
};

App.keyPair = function(callback) {
        var provider = this;
        provider.randomString(16, function(err, consumer_key) {
            if (err) {
                callback(err, null);
            } else {
                provider.randomString(32, function(err, secret) {
                    if (err) {
                        callback(err, null); 
                    } else {
                        callback(null, {consumer_key: consumer_key,
                                        secret: secret});
                    }
                });
            }
        });
};

App.randomString = function(bytes, callback) {
    crypto.randomBytes(bytes, function(err, buf) {
        var str;

        if (err) {
            callback(err, null);
        } else {
            str = buf.toString('base64');

            // XXX: optimize me

            str = str.replace(/\+/g, '-');
            str = str.replace(/\//g, '_');
            str = str.replace(/=/g, '');

            callback(null, str);
        }
    });
};

// For creating

App.defaultCreate = App.create;

App.create = function(properties, callback) {

    var now = dateFormat(new Date(), "isoDateTime", true);

    properties.created = properties.updated = now;

    if (properties.consumer_key) {
        App.defaultCreate(properties, callback);
    } else {
        App.keyPair(function(err, pair) {
            if (err) {
                callback(err, null);
            } else {
                properties.consumer_key = pair.consumer_key;
                properties.secret       = pair.secret;

                App.defaultCreate(properties, callback);
            }
        });
    }
};

App.prototype.defaultUpdate = App.prototype.update;

App.prototype.update = function(newApp, callback) {

    var now = dateFormat(new Date(), "isoDateTime", true);

    newApp.updated      = now;
    newApp.created      = this.created;
    newApp.consumer_key = this.consumer_key;
    newApp.secret       = this.secret;

    this.defaultUpdate(newApp, callback);
};

exports.App = App;
