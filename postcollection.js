// postcollection.js
//
// Post an activity streams collection somewhere
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

url = require('url');
fs = require('fs');
http = require('http');

function postActivity(serverUrl, activity) {

    var results = '';
    var toSend = JSON.stringify(activity);

    var parts = url.parse(serverUrl);

    var options = {
	host: parts.hostname,
	port: parts.port,
	method: 'POST',
	path: (parts.search) ? parts.pathname+'?'+parts.search : parts.pathname,
	headers: {'content-type': 'application/json',
		  'user-agent': 'postcollection.js/0.1.0dev'}
    };

    req = http.request(options, function(res) {
	res.on('data', function (chunk) {
	    results = results + chunk;
	});
	res.on('end', function () {
	    console.log("Results for activity " + activity.id + ": " + results);
	});
    })

    req.on('error', function(e) {
	console.log("Problem with activity " + activity.id + ": " + e.message);
    });

    req.write(JSON.stringify(activity));
    req.end();
    console.log("posted " + activity.id);
}

if (process.argv.length != 4) {
    process.stderr.write("USAGE: node postcollection.js filename.json URL\n");
    process.exit(1);
}

var fileName = process.argv[2];
var serverUrl = process.argv[3];

fs.readFile(fileName, function (err, data) {

    if (err) {
	console.log("Error reading file: " + err);
	process.exit(1);
    }

    var collection = JSON.parse(data);

    for (i in collection.items) {
	postActivity(serverUrl, collection.items[i]);
    }
});

