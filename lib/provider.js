// OAuthDataProvider for activity spam server
//
// Copyright 2011, 2012 StatusNet Inc.
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

var _ = require('underscore'),
    crypto = require('crypto');

var Provider = function(db) {
    this.db = db;
};

_.extend(Provider.prototype, {
    schema: {
	'app': {pkey: 'consumer_key',
		fields: ['title', 'description', 'secret', 'created'],
		indices: ['title']}
    },
    applicationByConsumerKey: function(consumerKey, callback) {
	this.db.read('app', consumerKey, callback);
    },
    validateNotReplay: function(accessToken, timestamp, nonce, callback) {
	callback(null, true);
    },
    addApp: function(title, description, callback) {
        var provider = this;
        provider.keyPair(function(err, pair) {
            if (err) {
                callback(err, null);
            } else {
                var app = {
                    title: title,
                    description: description,
                    created: Date.now(),
                    consumer_key: pair.consumer_key,
                    secret: pair.secret
                };
                provider.db.save('app', app.consumer_key, app, callback);
            }
        });
    },
    keyPair: function(callback) {
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
    },
    randomString: function(bytes, callback) {
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
    }
});

exports.Provider = Provider;
