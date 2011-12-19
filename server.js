// main function for activity spam checker
//
// Copyright 2011, StatusNet Inc.
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
    databank = require('databank'),
    Databank = databank.Databank,
    NoSuchThingError = databank.NoSuchThingError,
    config = require('./config'),
    params, server, db;

var BOUNDARY = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_]+/;
var BOUNDARYG = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_]+/g;

// Training and measuring values

var RELEVANCE_CUTOFF = 20;
var MINIMUM_OCCURENCES = 3;
var MINPROB = 0.0001;
var MAXPROB = 0.9999;
var DEFAULT_PROB = 0.4; // default probability for unseen values
var SPAM_PROB = 0.90; // cutoff for saying is or isn't

function tokenString(str) {
    return str.replace(BOUNDARYG, '-');
}

function tokenArray(str) {
    return str.split(BOUNDARY).filter(function (s) { return (s.length > 0); });
}

function tokenize(obj) {
    var tokens = [],
        prefixer = function(full) {
            return function(part) { return full + '=' + part; };
        },
        prop, full, parts, prefixed;

    for (prop in obj) {
        full = (arguments.length == 2) ? arguments[1]+'.'+prop : prop;
        switch (typeof(obj[prop])) {
        case "string":
            parts = tokenArray(obj[prop]);
            tokens = tokens.concat(parts);
            prefixed = parts.map(prefixer(full));
            tokens = tokens.concat(prefixed);
            break;
        case "number":
        case "boolean":
            tokens.push(full+'='+tokenString(obj[prop].toString()));
            break;
        case "object":
            tokens = tokens.concat(tokenize(obj[prop], full));
            break;
        default:
            // XXX: loggit
            break;
        }
    }
    return tokens;
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

function updateSpamCount(token, spam_total, not_spam_total) {
    db.incr('spam', token, function(err, spam_count) {
        db.read('not-spam', token, function(err, not_spam_count) {
            if (err instanceof NoSuchThingError) {
                not_spam_count = 0;
            }
            var g = 2 * not_spam_count;
            var b = spam_count;
            if (g + b > MINIMUM_OCCURENCES) { // This will make id=... values kinda useless
                var p = Math.max(MINPROB,
                                 Math.min(MAXPROB,
                                          Math.min(1, b/spam_total)/
                                          (Math.min(1, g/not_spam_total) + Math.min(1, b/spam_total))));
                db.save('prob', token, p, function(err, value) {});
            }
        });
    });
}

function updateNotSpamCount(token, spam_total, not_spam_total) {
    db.incr('not-spam', token, function(err, not_spam_count) {
        db.read('spam', token, function(err, spam_count) {
            if (err instanceof NoSuchThingError) {
                spam_count = 0;
            }
            var g = 2 * not_spam_count;
            var b = spam_count;
            if (g + b > 5) {
                var p = Math.max(MINPROB,
                                 Math.min(MAXPROB,
                                          Math.min(1, b/spam_total)/
                                          (Math.min(1, g/not_spam_total) + Math.min(1, b/spam_total))));
                db.save('prob', token, p, function(err, value) {});
            }
        });
    });
}

function updateSpamCounts(tokens, onSuccess) {
    db.incr('spamtotal', 1, function(err, spam_total) {
        db.read('notspamtotal', 1, function(err, not_spam_total) {
            if (err instanceof NoSuchThingError) {
                not_spam_total = 0;
            }
            var i;
            for (i in tokens) { // Not sure I love this
                updateSpamCount(tokens[i], spam_total, not_spam_total);
            }
            onSuccess();
        });
    });
}

function updateNotSpamCounts(tokens, onSuccess) {
    db.incr('notspamtotal', 1, function(err, not_spam_total) {
        db.read('spamtotal', 1, function(err, spam_total) {
            if (err instanceof NoSuchThingError) {
                spam_total = 0;
            }
            var i;
            for (i in tokens) { // Not sure I love this
                updateNotSpamCount(tokens[i], spam_total, not_spam_total);
            }
            onSuccess();
        });
    });
}

function getProbabilities(tokens, onSuccess) {
    db.readAll('prob', tokens, function(err, probs) {
        var i, probabilities = [];
        for (i = 0; i < tokens.length; i++) {
            // There's probably a nicer data structure for this
            if (probs[i] === null) {
                probabilities[i] = [tokens[i], DEFAULT_PROB];
            } else {
                probabilities[i] = [tokens[i], parseFloat(probs[i])];
            }
        }
        onSuccess(probabilities);
    });
}

function bestProbabilities(probs) {
    probs.sort(function (a, b) {
        var adist = Math.abs(a[1] - 0.5);
        var bdist = Math.abs(b[1] - 0.5);
        
        if (adist > bdist) {
            return -1;
        } else if (bdist > adist) {
            return 1;
        } else {
            return 0;
        }
    });

    // Get the most relevant
    return probs.slice(0, Math.min(probs.length, RELEVANCE_CUTOFF));
}

function combineProbabilities(probs) {
    var prod = probs.reduce(function(coll, cur, index, array) {
        return coll * cur[1];
    }, 1.0);

    var invprod = probs.reduce(function(coll, cur, index, array) {
        return coll * (1 - cur[1]);
    }, 1.0);

    //bounded values
    return Math.min(MAXPROB, Math.max(MINPROB, (prod)/(prod + invprod))); // really?
}

function thisIsSpam(req, res, next) {
    var tokens = tokenize(req.body);
    updateSpamCounts(tokens, function() {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify("Thanks"));
    });
}

function thisIsNotSpam(req, res, next) {
    var tokens = tokenize(req.body);
    updateNotSpamCounts(tokens, function() {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify("Good to know"));
    });
}

function isThisSpam(req, res, next) {
    var tokens = uniq(tokenize(req.body));
    getProbabilities(tokens, function(probs) {
        var bestprobs = bestProbabilities(probs);
        var prob = combineProbabilities(bestprobs);
        var decision = { probability: prob,
                         isSpam: ((prob > SPAM_PROB) ? true : false),
                         bestKeys: bestprobs };
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(decision));
    });
}

function testTokenize(req, res, next) {
    var tokens = tokenize(req.body);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(tokens));
}

server = connect.createServer(
    connect.logger(),
    connect.bodyParser(),
    connect.errorHandler({showMessage: true}),
    connect.router(function(app){
        app.post('/is-this-spam', isThisSpam);
        app.post('/this-is-spam', thisIsSpam);
        app.post('/this-is-not-spam', thisIsNotSpam);
        app.post('/tokenize', testTokenize);
    })
);

params = config.params;

params.schema = {'spam': {pkey: 'token'},
                 'not-spam': {pkey: 'token'},
                 'prob': {pkey: 'token'},
                 'spamtotal': {pkey: 'service'},
                 'notspamtotal': {pkey: 'service'}};

db = Databank.get(config.driver, params);

db.connect({}, function(err) {
    if (err) {
        console.error(err);
    } else {
        server.listen(process.env.PORT || 8001);
    }
});
