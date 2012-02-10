// Filter function for 
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

var databank = require('databank'),
    Databank = databank.Databank,
    NoSuchThingError = databank.NoSuchThingError;

var RELEVANCE_CUTOFF = 20;
var MINIMUM_OCCURENCES = 3;
var MINPROB = 0.0001;
var MAXPROB = 0.9999;
var DEFAULT_PROB = 0.4; // default probability for unseen values
var SPAM_PROB = 0.90; // cutoff for saying is or isn't

var SpamFilter = {

    db: null,

    updateSpamCount: function(token, spam_total, ham_total) {
        this.db.incr('spam', token, function(err, spam_count) {
            this.db.read('ham', token, function(err, ham_count) {
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
                    this.db.save('prob', token, p, function(err, value) {});
                }
            });
        });
    },

    updateHamCount: function(token, spam_total, ham_total) {
        this.db.incr('ham', token, function(err, ham_count) {
            this.db.read('spam', token, function(err, spam_count) {
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
                    this.db.save('prob', token, p, function(err, value) {});
                }
            });
        });
    },

    updateSpamCounts: function(tokens, onSuccess) {
        this.db.incr('spamtotal', 1, function(err, spam_total) {
            this.db.read('hamtotal', 1, function(err, ham_total) {
                if (err instanceof NoSuchThingError) {
                    ham_total = 0;
                }
                var i;
                for (i in tokens) { // Not sure I love this
                    this.updateSpamCount(tokens[i], spam_total, ham_total);
                }
                onSuccess();
            });
        });
    },

    updateHamCounts: function(tokens, onSuccess) {
        this.db.incr('hamtotal', 1, function(err, ham_total) {
            this.db.read('spamtotal', 1, function(err, spam_total) {
                if (err instanceof NoSuchThingError) {
                    spam_total = 0;
                }
                var i;
                for (i in tokens) { // Not sure I love this
                    this.updateHamCount(tokens[i], spam_total, ham_total);
                }
                onSuccess();
            });
        });
    },

    getProbabilities: function(tokens, onSuccess) {
        this.db.readAll('prob', tokens, function(err, probs) {
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
    },

    bestProbabilities: function(probs) {
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
    },

    combineProbabilities: function(probs) {
        var prod = probs.reduce(function(coll, cur, index, array) {
            return coll * cur[1];
        }, 1.0);

        var invprod = probs.reduce(function(coll, cur, index, array) {
            return coll * (1 - cur[1]);
        }, 1.0);

        //bounded values
        return Math.min(MAXPROB, Math.max(MINPROB, (prod)/(prod + invprod))); // really?
    },

    schema: {'spam': {pkey: 'token'},
              'ham': {pkey: 'token'},
              'prob': {pkey: 'token'},
              'spamtotal': {pkey: 'service'},
              'hamtotal': {pkey: 'service'}}
};

exports.SpamFilter = SpamFilter;
