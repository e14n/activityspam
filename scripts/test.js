// train.js
//
// Test the effectiveness of a training
//
// Copyright 2012, StatusNet Inc.
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

var fs = require('fs'),
    common = require('./common'),
    _ = require('underscore'),
    path = require('path'),
    postActivity = common.postActivity;

var MAX_COUNT = 1024;
var MAX_RUNNING = 128;

if (process.argv.length != 7) {
    process.stderr.write("USAGE: node test.js username:password hamdir spamdir hostname:port trained.txt\n");
    process.exit(1);
}

var ActivityGenerator = function(dir) {
    this.dir = dir;
    this.seen = {};
    this.cnt = 0;
    this.files = _.shuffle(fs.readdirSync(this.dir));
};

ActivityGenerator.prototype.next = function() {
    var fname;
    if (this.files.length === 0) {
        return null;
    } else {
        fname = this.files.pop();
        return path.join(this.dir, fname);
    }
};

var running = 0;
var total = 0;
var last = null;
var tested = {
    ham: {correct: 0, incorrect: 0},
    spam: {correct: 0, incorrect: 0}
};

var showResults = function() {
    var hamTotal = tested.ham.correct + tested.ham.incorrect;
    var spamTotal = tested.spam.correct + tested.spam.incorrect;
    console.log("RESULTS: HAM: " + ((tested.ham.correct/hamTotal)*100) + "%, SPAM: " + ((tested.spam.correct/spamTotal)*100) + "%");
};

var testFile = function(cat, fileName) {
    var serverUrl = "http://" + hp + "/is-this-spam";
    fs.readFile(fileName, function (err, data) {
        var i, activity;

        if (err) {
            console.log("Error reading file: " + err);
            return;
        }

        activity = JSON.parse(data);

        postActivity(serverUrl, auth, activity, function(err, res, body) {
            var testResults;
            running--;
            total++;
            if (err) {
                console.error(err);
            } else {
                testResults = JSON.parse(body);
                if (cat === 'ham') {
                    if (!testResults.isSpam) {
                        tested.ham.correct++;
                    } else {
                        tested.ham.incorrect++;
                    }
                } else if (cat === 'spam') {
                    if (testResults.isSpam) {
                        tested.spam.correct++;
                    } else {
                        tested.spam.incorrect++;
                    }
                }

                console.log(fileName + " (" + cat + ") results: " + testResults.isSpam + " " +
                            (((cat === 'ham' && !testResults.isSpam) || (cat === 'spam' && testResults.isSpam)) ? "HIT" : "MISS"));

                if (total < MAX_COUNT && running < MAX_RUNNING) {
                    alternate();
                }

                if (total >= MAX_COUNT) {
                    showResults();
                }
            }
        });
    });
};

var auth = process.argv[2];
var hamdir = path.normalize(process.argv[3]);
var spamdir = path.normalize(process.argv[4]);
var hp = process.argv[5];
var tf = process.argv[6];

var trainedData = fs.readFileSync(tf);
trainedData = trainedData.toString();
var trained = trainedData.split("\n");

var spammer = new ActivityGenerator(spamdir);
var hammer = new ActivityGenerator(hamdir);
var ham, spam;

var alternate = function() {
    if (last === 'ham') {

        do {
            spam = spammer.next();
            if (!spam) {
                return false;
            } 
        } while(trained.indexOf(spam) !== -1 || trained.indexOf(path.basename(spam)) !== -1);

        testFile('spam', spam);
        last = 'spam';
    } else {
        do {
            ham  = hammer.next();
            if (!ham) {
                return true;
            }
        } while(trained.indexOf(ham) !== -1 || trained.indexOf(path.basename(ham)) !== -1);
        testFile('ham', ham);
        last = 'ham';
    }

    running++;
};

var f = true;

while (running < MAX_RUNNING) {
    f = alternate();
    if (!f) {
        break;
    }
}
