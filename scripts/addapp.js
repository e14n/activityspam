// train.js
//
// Make a new app key and secret
//
// Copyright 2012, StatusNet Inc.
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
    Databank = databank.Databank,
    NoSuchThingError = databank.NoSuchThingError,
    config = require('../config'),
    Provider = require('../lib/provider').Provider,
    _ = require('underscore'),
    argv = require('optimist')
        .usage("node addapp.js title description")
        .argv,
    params, db;

params = config.params;

if (!_(params).has('schema')) {
    params.schema = {};
}

_.extend(params.schema, Provider.schema);

db = Databank.get(config.driver, params);

var provider = new Provider(db);

var title = argv._[0],
    description = argv._[1];

db.connect({}, function(err) {
    if (err) {
        console.error(err);
    } else {
        provider.addApp(title, description, function(err, app) {
            if (err) {
                console.error(err);
                process.exit(1);
            } else {
                console.log("KEY: " + app.consumer_key);
                console.log("SECRET: " + app.secret);
                db.disconnect(function(err) {
                    if (err) {
                        console.error(err);
                        process.exit(1);
                    } else {
                        process.exit(0);
                    }
                });
            }
        });
    }
});
