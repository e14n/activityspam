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

var Tokenizer = require('../lib/tokenizer').Tokenizer,
    SpamFilter = require('../lib/spamfilter').SpamFilter;

exports.thisIsSpam = function(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 

        var app;

        if (error) {
            res.json({error: error.message}, 500);
            return;
        }

        if (!authenticated) {
            return;
        }

        app = req.getAuthDetails().user;

        SpamFilter.train('spam', req.body, app, function(err, trainrec) {
            if (err) {
                res.json({error: err.message}, 500);
            } else {
                delete trainrec.app;
                res.json(trainrec);
            }
        });
    });
};

exports.thisIsHam = function(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 

        var app; 

        if (error) {
            res.json({error: error.message}, 500);
            return;
        }

        if (!authenticated) {
            return;
        }

        app = req.getAuthDetails().user;

        SpamFilter.train('ham', req.body, app, function(err, trainrec) {
            if (err) {
                res.json({error: err.message}, 500);
            } else {
                delete trainrec.app;
                res.json(trainrec);
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

        var app;

        if (error) {
            res.json({error: error.message}, 500);
            return;
        }

        if (!authenticated) {
            return;
        }

        app = req.getAuthDetails().user;

        var tokens = uniq(Tokenizer.tokenize(req.body));

        SpamFilter.test(tokens, function(err, decision) {
            if (err) {
                res.json({error: err.message}, 500);
            } else { 
                res.json(decision);
            }
        });
    });
};

exports.testTokenize = function(req, res, next) {

    req.authenticate(['oauth'], function(error, authenticated) { 

        var app;

        if (error) {
            res.json({error: error.message}, 500);
            return;
        }

        if (!authenticated) {
            return;
        }

        app = req.getAuthDetails().user;

        var tokens = Tokenizer.tokenize(req.body);
        res.json(tokens);
    });
};
