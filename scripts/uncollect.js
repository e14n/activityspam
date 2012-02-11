// uncollect.js
//
// Takes a single activity streams collection and expands to one file per activity
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
    path = require('path');

if (process.argv.length != 4) {
    process.stderr.write("USAGE: node uncollect.js collection outdir\n");
    process.exit(1);
}

var fileName = process.argv[2];
var outDir = process.argv[3];
var norm = path.normalize(fileName);
var base = path.basename(norm, path.extname(norm));

fs.readFile(norm, function (err, data) {

    var i, collection, outfile, activity,
        reporter = function(outfile) {
            return function(err) {
                if (err) {
	            console.log("Error reading file: " + err);
                } else {
                    console.log(outfile);
                }
            };
        };

    if (err) {
	console.log("Error reading file: " + err);
	process.exit(1);
    }

    collection = JSON.parse(data);

    for (i in collection.items) {

        outfile = path.join(outDir, base + "-" + i + ".json");
        activity = collection.items[i];

        fs.writeFile(outfile, JSON.stringify(activity), reporter(outfile));
    }
});

