// server.js
//
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

var connect = require('connect');
var redis   = require('redis');

const BOUNDARY = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_]+/;
const BOUNDARYG = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_]+/g;

function tokenString(str)
{
    return str.replace(BOUNDARYG, '-');
}

function tokenArray(str)
{
    return str.split(BOUNDARY);
}

function tokenize(obj)
{
    var tokens = [];
    for (var prop in obj) {
	var full = (arguments.length == 2) ? arguments[1]+'.'+prop : prop;
	switch (typeof(obj[prop])) {
	case "string":
	    var parts = tokenArray(obj[prop]);
	    tokens = tokens.concat(parts);
	    var prefixed = parts.map(function(part) { return full + '=' + part; });
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

function uniq(arr)
{
    var newArr = [];

    for (i in arr) {
	if (newArr.indexOf(arr[i]) == -1) {
	    newArr.push(arr[i]);
	}
    }

    return newArr;
}

function updateSpamCount(r, token, spam_total, not_spam_total)
{
    r.incr('spam:'+token, function(err, spam_count) {
	r.get('not-spam:'+token, function(err, not_spam_count) {
	    var g = 2 * not_spam_count;
	    var b = spam_count;
	    if (g + b > 5) { // This will make id=... values kinda useless
		var p = Math.max(0.01,
				 Math.min(0.99,
					  Math.min(1, b/spam_total)/
					  (Math.min(1, g/not_spam_total) + Math.min(1, b/spam_total))));
		r.set('prob:'+token, p);
	    }
	});
    });
}

function updateNotSpamCount(r, token, spam_total, not_spam_total)
{
    r.incr('not-spam:'+token, function(err, not_spam_count) {
	r.get('spam:'+token, function(err, spam_count) {
	    var g = 2 * not_spam_count;
	    var b = spam_count;
	    if (g + b > 5) {
		var p = Math.max(0.01,
				 Math.min(0.99,
					  Math.min(1, b/spam_total)/
					  (Math.min(1, g/not_spam_total) + Math.min(1, b/spam_total))));
		console.log("Setting probability for token '" + token + "' to " + p.toString()); 
		r.set('prob:'+token, p);
	    }
	});
    });
}

function updateSpamCounts(tokens, onSuccess)
{
    var r = redis.createClient();
    
    console.log("Got " + tokens.length + " tokens to update");

    r.stream.on('connect', function() {
	r.incr('spamtotal', function(err, spam_total) {
	    r.get('notspamtotal', function(err, not_spam_total) {
		for (i in tokens) { // Not sure I love this
		    updateSpamCount(r, tokens[i], spam_total, not_spam_total);
		}
		onSuccess();
	    });
	});
    });
}

function updateNotSpamCounts(tokens, onSuccess)
{
    var r = redis.createClient();
    
    console.log("Got " + tokens.length + " tokens to update");

    r.stream.on('connect', function() {
	r.incr('notspamtotal', function(err, not_spam_total) {
	    r.get('spamtotal', function(err, spam_total) {
		for (i in tokens) { // Not sure I love this
		    console.log("Update not spam count for " + tokens[i]);
		    updateNotSpamCount(r, tokens[i], spam_total, not_spam_total);
		}
		onSuccess();
	    });
	});
    });
}

function getProbabilities(tokens, onSuccess)
{
    var probkeys = [];
    for (i in tokens) {
	probkeys.push('prob:'+tokens[i]);
    }
    
    var r = redis.createClient();

    r.mget(probkeys, function(err, probs) {
	probabilities = [];
	for (i in tokens) {
	    // There's probably a nicer data structure for this
	    if (probs[i] == null) {
		probabilities[i] = [tokens[i], 0.4];
	    } else {
		probabilities[i] = [tokens[i], parseFloat(probs[i])];
	    }
	}
	onSuccess(probabilities);
    });
}

function bestProbabilities(probs)
{
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

    // Get the best 15
    return probs.slice(0, Math.min(probs.length, 15));
}

function combineProbabilities(probs)
{
    var prod = probs.reduce(function(coll, cur, index, array) {
	return coll * cur[1];
    }, 1.0);

    var invprod = probs.reduce(function(coll, cur, index, array) {
	return coll * (1 - cur[1]);
    }, 1.0);

    return (prod)/(prod + invprod); // really?
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
			 isSpam: ((prob > 0.90) ? true : false),
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
    connect.router(function(app){
	app.post('/is-this-spam', isThisSpam);
	app.post('/this-is-spam', thisIsSpam);
	app.post('/this-is-not-spam', thisIsNotSpam);
	app.post('/tokenize', testTokenize);
    })
);

server.listen(process.env.PORT || 8001);
