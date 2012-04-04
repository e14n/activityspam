// API for activity spam checker
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

// Training and measuring values

exports.thisIsSpam = function(req, res, next) {
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
};

exports.thisIsHam = function(req, res, next) {
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
};

var uniq = function(arr) {
    var newArr = [], i;

    for (i = 0; i < arr.length; i++) {
        if (newArr.indexOf(arr[i]) == -1) {
            newArr.push(arr[i]);
        }
    }

    return newArr;
};

exports.isThisSpam = function(req, res, next) {

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
};

exports.testTokenize = function(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 

	if (error) {
	    console.log(error);
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(err.message));
	    return;
	}

	if (authenticated) {
            var tokens = Tokenizer.tokenize(req.body);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(tokens));
	}
    });
};
