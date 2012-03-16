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
    params, server, db;

// Training and measuring values

function thisIsSpam(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 
        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }
        SpamFilter.train('spam', req.body, function(err, trainrec) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: err.message}));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(trainrec));
            }
        });
    });
}

function thisIsHam(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 
        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }
        SpamFilter.train('ham', req.body, function(err, trainrec) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: err.message}));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(trainrec));
            }
        });
    });
}

function uniq(arr) {
    var newArr = [], i;

    for (i = 0; i < arr.length; i++) {
        if (newArr.indexOf(arr[i]) == -1) {
            newArr.push(arr[i]);
        }
    }

    return newArr;
}

function isThisSpam(req, res, next) {

    req.authenticate(['oauth'], function(error, authenticated) { 

        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }

        var tokens = uniq(Tokenizer.tokenize(req.body));

        SpamFilter.test(tokens, function(err, decision) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(decision));
            }
        });
    });
}

function testTokenize(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 
        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }
        var tokens = Tokenizer.tokenize(req.body);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(tokens));
    });
}

params = config.params;

if (!_(params).has('schema')) {
    params.schema = {};
}

_.extend(params.schema, SpamFilter.schema);
_.extend(params.schema, Provider.schema);

db = Databank.get(config.driver, params);

server = connect.createServer(
    connect.logger(),
    connect.bodyParser(),
    connect.errorHandler({showMessage: true}),
    auth([auth.Oauth({oauth_provider: new Provider(db),
                      authenticate_provider: null,
                      authorize_provider: null,
                      authorization_finished_provider: null
                     })]),
    connect.router(function(app) {
        app.post('/is-this-spam', isThisSpam);
        app.post('/this-is-spam', thisIsSpam);
        app.post('/this-is-ham', thisIsHam);
        app.post('/tokenize', testTokenize);
    })
);

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

        server.on('listening', function() {
            // Drop privs if needed
            process.setuid(config.serverUser);
        });

        server.listen(config.port || process.env.PORT || 8001);
    }
});
