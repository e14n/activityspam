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

function tokenize(json)
{
    var tokens = [];
    // TODO: actually tokenize
    return tokens;
}

function updateSpamCounts(tokens, onSuccess)
{
    var counts = [];
    // TODO: update counts
    onSuccess(counts);
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
	updateSpamProbabilities(counts, function(probs) {
	    res.writeHead(200, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify("Thanks"));
	});
    });
}

function thisIsNotSpam(req, res, next) {
    var tokens = tokenize(req.body);
    updateNotSpamCounts(tokens, function(counts) {
	updateNotSpamProbabilities(counts, function(probs) {
	    res.writeHead(200, {'Content-Type': 'application/json'});
	    res.end(JSON.stringify("Good to know"));
	});
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

server = connect.createServer(
    connect.logger(),
    connect.bodyParser(),
    connect.router(function(app){
	app.post('/is-this-spam', isThisSpam);
	app.post('/this-is-spam', thisIsSpam);
	app.post('/this-is-not-spam', thisIsNotSpam);
    })
);

server.listen(process.env.PORT || 8001);
