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

const BOUNDARY = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|]+/;
const BOUNDARYG = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|]+/g;

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
	    tokens.push(full+'='+tokenString(obj[prop]));
	    tokens = tokens.concat(tokenArray(obj[prop]));
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

function updateSpamCounts(tokens, onSuccess)
{
    var r = redis.createClient();

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

function updateSpamProbabilities(counts, onSuccess)
{
    var probabilities = [];
    // TODO: update probabilities
    onSuccess(probabilities);
}

function updateNotSpamCounts(tokens, onSuccess)
{
    var counts = [];
    // TODO: update counts
    onSuccess(counts);
}

function updateNotSpamProbabilities(counts, onSuccess)
{
    var probabilities = [];
    // TODO: update probabilities
    onSuccess(probabilities);
}

function getProbabilities(tokens, onSuccess)
{
    var probabilities = [];
    // TODO: fetch probabilities
    onSuccess(probabilities);
}

function bestProbabilities(probs)
{
    var bestProbs = [];
    // TODO: determine the best probabilities
    return bestProbs;
}

function combineProbabilities(probs)
{
    var result = 0.5;
    // TODO: determine the best probabilities
    return result;
}

function thisIsSpam(req, res, next) {
    var tokens = tokenize(req.body);
    updateSpamCounts(tokens, function(counts) {
	res.writeHead(200, {'Content-Type': 'application/json'});
	res.end(JSON.stringify("Thanks"));
    });
}

function thisIsNotSpam(req, res, next) {
    var tokens = tokenize(req.body);
    updateNotSpamCounts(tokens, function(counts) {
	res.writeHead(200, {'Content-Type': 'application/json'});
	res.end(JSON.stringify("Good to know"));
    });
}

function isThisSpam(req, res, next) {
    var tokens = tokenize(req.body);
    getProbabilities(tokens, function(probs) {
	var bestprobs = bestProbabilities(probs);
	var decision = combineProbabilities(bestprobs);
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
