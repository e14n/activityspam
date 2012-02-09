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

function makeDigrams(parts) {
    var i, dg = [];

    for (i = 0; i < parts.length; i++) {
        if (i === 0) {
            dg.push("^" + parts[i]);
        }
        if (i == parts.length - 1) {
            dg.push(parts[i] + "^");
        } else {
            dg.push(parts[i] + "^" + parts[i+1]);
        }
    }

    return dg;
}

function isArray(obj) {
    if (obj.constructor.toString().indexOf("Array") == -1) {
	return false;
    } else {
	return true;
    }
}

function tokenize(obj) {
    var tokens = [],
        prefixer = function(full) {
            return function(part) { return full + '=' + part; };
        },
        prop, full, parts, fixer, prefixed, digrams, prefixedDigrams, fp, i;

    if (isArray(obj)) {
	full = (arguments.length == 2) ? arguments[1]+'.length' : 'length';
	tokens.push(full+'='+obj.length);
    }

    for (prop in obj) {
	fp = [];
	if (isArray(obj)) {
            fp.push((arguments.length == 2) ? arguments[1]+'.N' : 'N');
	} else {
            fp.push((arguments.length == 2) ? arguments[1]+'.'+prop : prop);
	}
	for (i in fp) {
	    full = fp[i];
            switch (typeof(obj[prop])) {
            case "string":
		fixer = prefixer(full);
		parts = tokenArray(obj[prop]);
		tokens = tokens.concat(parts);
		digrams = makeDigrams(parts);
		tokens = tokens.concat(digrams);
		prefixed = parts.map(fixer);
		tokens = tokens.concat(prefixed);
		prefixedDigrams = digrams.map(fixer);
		tokens = tokens.concat(prefixedDigrams);
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

function updateSpamCount(token, spam_total, ham_total) {
    db.incr('spam', token, function(err, spam_count) {
        db.read('ham', token, function(err, ham_count) {
            if (err instanceof NoSuchThingError) {
                ham_count = 0;
            }
            var g = 2 * ham_count;
            var b = spam_count;
            if (g + b > MINIMUM_OCCURENCES) { // This will make id=... values kinda useless
                var p = Math.max(MINPROB,
                                 Math.min(MAXPROB,
                                          Math.min(1, b/spam_total)/
                                          (Math.min(1, g/ham_total) + Math.min(1, b/spam_total))));
                db.save('prob', token, p, function(err, value) {});
            }
        });
    });
}

function updateHamCount(token, spam_total, ham_total) {
    db.incr('ham', token, function(err, ham_count) {
        db.read('spam', token, function(err, spam_count) {
            if (err instanceof NoSuchThingError) {
                spam_count = 0;
            }
            var g = 2 * ham_count;
            var b = spam_count;
            if (g + b > 5) {
                var p = Math.max(MINPROB,
                                 Math.min(MAXPROB,
                                          Math.min(1, b/spam_total)/
                                          (Math.min(1, g/ham_total) + Math.min(1, b/spam_total))));
                db.save('prob', token, p, function(err, value) {});
            }
        });
    });
}

function updateSpamCounts(tokens, onSuccess) {
    db.incr('spamtotal', 1, function(err, spam_total) {
        db.read('hamtotal', 1, function(err, ham_total) {
            if (err instanceof NoSuchThingError) {
                ham_total = 0;
            }
            var i;
            for (i in tokens) { // Not sure I love this
                updateSpamCount(tokens[i], spam_total, ham_total);
            }
            onSuccess();
        });
    });
}

function updateHamCounts(tokens, onSuccess) {
    db.incr('hamtotal', 1, function(err, ham_total) {
        db.read('spamtotal', 1, function(err, spam_total) {
            if (err instanceof NoSuchThingError) {
                spam_total = 0;
            }
            var i;
            for (i in tokens) { // Not sure I love this
                updateHamCount(tokens[i], spam_total, ham_total);
            }
            onSuccess();
        });
    });
}

function getProbabilities(tokens, onSuccess) {
    db.readAll('prob', tokens, function(err, probs) {
        var i, probabilities = [], token;
        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            // There's probably a nicer data structure for this
            if (probs[token] === null) {
                probabilities.push([token, DEFAULT_PROB]);
            } else {
                probabilities.push([token, probs[token]]);
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

function thisIsHam(req, res, next) {
    var tokens = tokenize(req.body);
    updateHamCounts(tokens, function() {
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
    connect.basicAuth(config.username, config.password),
    connect.router(function(app) {
        app.post('/is-this-spam', isThisSpam);
        app.post('/this-is-spam', thisIsSpam);
        app.post('/this-is-ham', thisIsHam);
        app.post('/tokenize', testTokenize);
    })
);

params = config.params;

params.schema = {'spam': {pkey: 'token'},
                 'ham': {pkey: 'token'},
                 'prob': {pkey: 'token'},
                 'spamtotal': {pkey: 'service'},
                 'hamtotal': {pkey: 'service'}};

db = Databank.get(config.driver, params);

db.connect({}, function(err) {
    if (err) {
        console.error(err);
    } else {
        server.listen(process.env.PORT || 8001);
    }
});
