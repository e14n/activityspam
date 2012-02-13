// train.js
//
// Train a server given a bunch of ham and spam files
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

var MAX_RUNNING = 896;

if (process.argv.length != 7) {
    process.stderr.write("USAGE: node train.js username:password hamdir spamdir hostname:port maxcount\n");
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

var trainFile = function(cat, fileName) {
    var serverUrl = "http://" + hp + "/this-is-" + cat;
    fs.readFile(fileName, function (err, data) {
        var i, activity;

        if (err) {
            console.log("Error reading file: " + err);
            return;
        }

        activity = JSON.parse(data);

        postActivity(serverUrl, auth, activity, function(err, res, body) {
            running--;
            total++;
            if (err) {
                console.error(err);
            } else {
                console.log(path.basename(fileName));
                if (total < maxcount && running < MAX_RUNNING) {
                    alternate();
                }
            }
        });
    });
};

var auth = process.argv[2];
var hamdir = path.normalize(process.argv[3]);
var spamdir = path.normalize(process.argv[4]);
var hp = process.argv[5];
var maxcount = parseInt(process.argv[6], 10);

var spammer = new ActivityGenerator(spamdir);
var hammer = new ActivityGenerator(hamdir);
var ham, spam;

var alternate = function() {
    if (last === 'ham') {
        spam = spammer.next();
        
        if (!spam) {
            return false;
        } 

        trainFile('spam', spam);
        last = 'spam';
    } else {
        ham  = hammer.next();
        if (!ham) {
            return false;
        }
        trainFile('ham', ham);
        last = 'ham';
    }

    running++;
    return true;
};

var f = true;

while (running < Math.min(maxcount, MAX_RUNNING)) {
    f = alternate();
    if (!f) {
        break;
    }
}
