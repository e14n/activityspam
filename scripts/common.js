// common.js
//
// Common utilities for activityspam scripts
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

var url = require('url'),
    http = require('http');

var postActivity = function(serverUrl, auth, activity) {

    var results = '';
    var toSend = JSON.stringify(activity);
    var req;

    var parts = url.parse(serverUrl);

    var options = {
        'auth': auth,
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
    });

    req.on('error', function(e) {
	console.log("Problem with activity " + activity.id + ": " + e.message);
    });

    req.write(toSend);
    req.end();
    console.log("posted " + activity.id + " (" + toSend.length + " chars)");
};

exports.postActivity = postActivity;