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
    NoSuchThingError = databank.NoSuchThingError,
    Step = require('step');

var RELEVANCE_CUTOFF = 20;
var MINIMUM_OCCURENCES = 3;
var MINPROB = 0.0001;
var MAXPROB = 0.9999;
var DEFAULT_PROB = 0.4; // default probability for unseen values
var SPAM_PROB = 0.90; // cutoff for saying is or isn't

var SpamFilter = {

    db: null,

    opposite: function(cat) {
        if (cat === 'ham') {
            return 'spam';
        } else if (cat === 'spam') {
            return 'ham';
        } else {
            throw new Error('Unknown category: ' + cat);
        }
    },
    
    updateCounts: function(cat, tokens, onSuccess) {

        var filter = this,
            opp = this.opposite(cat),
            catTotalKey = cat + 'total',
            oppTotalKey = opp + 'total',
            catTotal, oppTotal;

        Step(
            function() {
                filter.db.incr(catTotalKey, 1, this);
            },
            function(err, result) {
                if (err) throw err;
                catTotal = result;
                filter.db.read(oppTotalKey, 1, this);
            },
            function(err, result) {
                var i, group = this.group();
                if (err) {
                    if (err instanceof NoSuchThingError) {
                        oppTotal = 0;
                    } else {
                        throw err;
                    }
                } else {
                    oppTotal = result;
                }
                for (i in tokens) { // Not sure I love this
                    this.updateTokenCount(cat, tokens[i], catTotal, oppTotal, group());
                }
            },
            function(err, results) {
                if (err) {
                    onSuccess(err, null);
                } else {
                    onSuccess(null, results);
                }
            }
        );
    },

    updateTokenCount: function(cat, token, catTotal, oppTotal, onSuccess) {
        var opp = this.opposite(cat),
            filter = this,
            catCount, oppCount;

        Step(
            function() {
                filter.db.incr(cat, token, this);
            },
            function(err, result) {
                if (err) throw err;
                catCount = result;
                filter.db.read(opp, token, this);
            },
            function(err, result) {
                if (err instanceof NoSuchThingError) {
                    oppCount = 0;
                } else if (err) {
                    onSuccess(err, null);
                } else {
                    oppCount = result;
                }

                if (cat === 'spam') {
                    filter.updateTokenProb(token, catCount, oppCount, catTotal, oppTotal, onSuccess);
                } else {
                    filter.updateTokenProb(token, oppCount, catCount, oppTotal, catTotal, onSuccess);
                }
            }
        );
    },

    updateTokenProb: function(token, spamCount, hamCount, spamTotal, hamTotal, onSuccess) {
        var g = 2 * hamCount,
            b = spamCount;

        if (g + b > 5) {
            var p = Math.max(MINPROB,
                             Math.min(MAXPROB,
                                      Math.min(1, b/spamTotal)/
                                      (Math.min(1, g/hamTotal) + Math.min(1, b/spamTotal))));
            this.db.save('prob', token, p, onSuccess);
        }
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
