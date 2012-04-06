// User for ActivitySpam
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
    bcrypt  = require('bcrypt'),
    _ = require('underscore'),
    DatabankObject = databank.DatabankObject;

var User = DatabankObject.subClass('user');

User.schema = {user: {pkey: 'email', 
		      fields: ['email',
                               'hash',
                               'apps',
                               'created',
                               'updated']}};

User.prototype.checkPassword = function(cleartext, callback) {
    bcrypt.compare(cleartext, this.hash, callback);
};


User.prototype.defaultUpdate = User.prototype.update;

User.prototype.update = function(newUser, callback) {

    var now = dateFormat(new Date(), "isoDateTime", true);

    newUser.updated = now;
    newUser.created = this.created;
    newUser.email   = this.email;
    newUser.hash    = this.hash;

    if (_(newUser).has('password')) {
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(newUser.password, salt, function(err, hash) {
                newUser.hash = hash;
                this.defaultUpdate(newUser, callback);
            });
        });
    } else {
        this.defaultUpdate(newUser, callback);
    }
};

// For creating

User.defaultCreate = User.create;

User.create = function(properties, callback) {

    if (!properties.email || !properties.password) {
	callback(new Error('Gotta have a email and a password.'), null);
    }

    var now = dateFormat(new Date(), "isoDateTime", true);

    properties.created = properties.updated = now;

    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(properties.password, salt, function(err, hash) {
            properties.hash = hash;
            delete properties.password;
            User.defaultCreate(properties, callback);
        });
    });
};

exports.User = User;
