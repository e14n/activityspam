// main function for activity spam checker
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

var connect = require('connect'),
    auth = require('connect-auth'),
    databank = require('databank'),
    Databank = databank.Databank,
    NoSuchThingError = databank.NoSuchThingError,
    config = require('./config'),
    Tokenizer = require('./lib/tokenizer').Tokenizer,
    SpamFilter = require('./lib/spamfilter').SpamFilter,
    Provider = require('./lib/provider').Provider,
    _ = require('underscore'),
    express = require('express'),
    routes = require('./routes'),
    params, server, db;

params = config.params;

if (!_(params).has('schema')) {
    params.schema = {};
}

_.extend(params.schema, SpamFilter.schema);
_.extend(params.schema, Provider.schema);

db = Databank.get(config.driver, params);

var app = module.exports = express.createServer();

// Configuration

app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'utml');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
    app.use(auth([auth.Oauth({oauth_provider: new Provider(db),
                              authenticate_provider: null,
                              authorize_provider: null,
                              authorization_finished_provider: null
                             })
                 ])
           );
});

app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
    app.use(express.errorHandler());
});

// Routes

app.post('/is-this-spam', routes.isThisSpam);
app.post('/this-is-spam', routes.thisIsSpam);
app.post('/this-is-ham', routes.thisIsHam);
app.post('/tokenize', routes.testTokenize);

// Set the tokenizer options

var i, opt, opts = ["useDigrams", "usePrefixes", "useBare", "useArrayLength"];

for (i in opts) {
    opt = opts[i];
    if (config.hasOwnProperty(opt)) {
        Tokenizer[opt] = config[opt];
    }
}

db.connect({}, function(err) {
    if (err) {
        console.error(err);
    } else {

        SpamFilter.db = db;

        app.on('listening', function() {
            // Drop privs if needed
            process.setuid(config.serverUser);
        });

        app.listen(config.port || process.env.PORT || 8001);
    }
});
