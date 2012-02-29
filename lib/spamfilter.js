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
    Step = require('step'),
    crypto = require('crypto'),
    dateFormat = require('dateformat'),
    Tokenizer = require('./tokenizer').Tokenizer;

var RELEVANCE_CUTOFF = 20;
var MINIMUM_OCCURENCES = 3;
var MINPROB = 0.0001;
var MAXPROB = 0.9999;
var DEFAULT_PROB = 0.4; // default probability for unseen values
var SPAM_PROB = 0.90; // cutoff for saying is or isn't
var UP = +1;
var DOWN = -1;
var DIGRAMS = true;
var PREFIXES = true;

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
    
    updateTokenCounts: function(cat, tokens, dir, callback) {

        var filter = this,
            opp = this.opposite(cat),
            catTotalKey = cat + 'total',
            oppTotalKey = opp + 'total',
            catTotal, oppTotal;

        Step(
            function() {
                if (dir === UP) {
                    filter.db.incr(catTotalKey, 1, this);
                } else {
                    filter.db.decr(catTotalKey, 1, this);
                }
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
                    filter.updateTokenCount(cat, tokens[i], dir, catTotal, oppTotal, group());
                }
            },
            function(err, results) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, results);
                }
            }
        );
    },

    swap: function(cat, tokens, callback) {

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
                filter.db.decr(oppTotalKey, 1, this);
            },
            function(err, result) {
                var i, group = this.group();
                if (err) {
                    if (err instanceof NoSuchThingError) {
                        oppTotal = 1;
                    } else {
                        throw err;
                    }
                } else {
                    oppTotal = result;
                }
                for (i in tokens) { // Not sure I love this
                    filter.swapTokenCount(cat, tokens[i], catTotal, oppTotal, group());
                }
            },
            function(err, results) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, results);
                }
            }
        );
    },

    learn: function(cat, tokens, callback) { // forget that tokens mean cat
        this.updateTokenCounts(cat, tokens, UP, callback);
    },

    forget: function(cat, tokens, callback) { // forget that tokens mean cat
        this.updateTokenCounts(cat, tokens, DOWN, callback);
    },

    updateTokenCount: function(cat, token, dir, catTotal, oppTotal, callback) {
        var opp = this.opposite(cat),
            filter = this,
            catCount, oppCount;

        Step(
            function() {
                if (dir === UP) {
                    filter.db.incr(cat, token, this);
                } else {
                    filter.db.decr(cat, token, this);
                }
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
                    callback(err, null);
                } else {
                    oppCount = result;
                }

                if (cat === 'spam') {
                    filter.updateTokenProb(token, catCount, oppCount, catTotal, oppTotal, callback);
                } else {
                    filter.updateTokenProb(token, oppCount, catCount, oppTotal, catTotal, callback);
                }
            }
        );
    },

    swapTokenCount: function(cat, token, catTotal, oppTotal, callback) {
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
                filter.db.decr(opp, token, this);
            },
            function(err, result) {
                if (err instanceof NoSuchThingError) {
                    oppCount = 0;
                } else if (err) {
                    callback(err, null);
                } else {
                    oppCount = result;
                }

                if (cat === 'spam') {
                    filter.updateTokenProb(token, catCount, oppCount, catTotal, oppTotal, callback);
                } else {
                    filter.updateTokenProb(token, oppCount, catCount, oppTotal, catTotal, callback);
                }
            }
        );
    },

    updateTokenProb: function(token, spamCount, hamCount, spamTotal, hamTotal, callback) {
        var g = 2 * hamCount,
            b = spamCount;

        if (g + b > 5 && spamTotal !== 0 && hamTotal !== 0) {
            var p = Math.max(MINPROB,
                             Math.min(MAXPROB,
                                      Math.min(1, b/spamTotal)/
                                      (Math.min(1, g/hamTotal) + Math.min(1, b/spamTotal))));
            this.db.save('prob', token, p, callback);
        } else {
            callback(null, null);
        }
    },

    getProbabilities: function(tokens, callback) {
        this.db.readAll('prob', tokens, function(err, probs) {
            if (err) {
                callback(err, null);
                return;
            }
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
            callback(null, probabilities);
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

    test: function(tokens, callback) {

        var start = Date.now(),
            filter = this;

        Step(
            function() {
                filter.getProbabilities(tokens, this);
            },
            function(err, probs) {

                var bestprobs, prob, decision;

                if (err) {
                    callback(err, null);
                    return;
                }
                
                bestprobs = filter.bestProbabilities(probs);
                prob = filter.combineProbabilities(bestprobs);

                decision = { probability: prob,
                             isSpam: ((prob > SPAM_PROB) ? true : false),
                             bestKeys: bestprobs,
                             elapsed: Date.now() - start};

                callback(null, decision);
            }
        );
    },

    train: function(cat, obj, callback) {

        var filter = this,
            start = Date.now(),
            hash = filter.hashObject(obj),
            tokens = Tokenizer.tokenize(obj);

        filter.db.read("trainrec", hash, function(err, trainrec) {
            if (err instanceof NoSuchThingError) { // Never trained before
                filter.learn(cat, tokens, function(err, results) {
                    if (err) {
                        callback(err, null);
                    } else {
                        trainrec = {cat: cat,
                                    object: JSON.stringify(obj),
                                    date: dateFormat(new Date(), "isoDateTime", true),
                                    results: results,
                                    elapsed: Date.now() - start};
                        filter.db.save("trainrec", hash, trainrec, callback);
                    }
                });
            } else if (err) { // DB error
                callback(err, null);
            } else if (trainrec.cat === cat) { // trained same; return old training info
                callback(null, trainrec);
            } else if (trainrec.cat === filter.opposite(cat)) { // trained opposite
                // XXX: Do these need to be sequenced...?
                filter.swap(cat, tokens, function(err, results) {
                    if (err) {
                        callback(err, null);
                    } else {
                        trainrec = {cat: cat,
                                    object: JSON.stringify(obj),
                                    date: dateFormat(new Date(), "isoDateTime", true),
                                    results: results,
                                    elapsed: Date.now() - start};
                        filter.db.save("trainrec", hash, trainrec, callback);
                    }
                });
            }
        });
    },

    hashObject: function(obj) {
        var dig = null;
        var str = JSON.stringify(obj); // Canonicalize? Fuzz? BOTH!?
        var hash = crypto.createHash('md5'); // XXX: might not be there!
        hash.update(str);
        dig = hash.digest('base64');
        // URL-safe
        dig = dig.replace(/\+/g, '-');
        dig = dig.replace(/\//g, '_');
        dig = dig.replace(/=/g, '');
        return dig;
    },

    schema: {'spam': {pkey: 'token'},
             'ham': {pkey: 'token'},
             'prob': {pkey: 'token'},
             'trainrec': {pkey: 'hash'},
             'spamtotal': {pkey: 'service'},
             'hamtotal': {pkey: 'service'}}
};

exports.SpamFilter = SpamFilter;
