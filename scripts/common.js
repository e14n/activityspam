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

var postActivity = function(serverUrl, auth, activity, callback) {

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

    if (!callback) {
        callback = postReport(activity);
    }
    
    req = http.request(options, function(res) {
        var body = '';

	res.on('data', function (chunk) {
	    body = body + chunk;
	});

	res.on('end', function () {
            callback(null, res, body);
	});
    });

    req.on('error', function(err) {
        callback(err, null);
    });

    req.write(toSend);
    req.end();
};

var postReport = function(activity) {
    return function(err, res, body) {
        if (err) {
            console.log("Error posting activity " + activity.id);
            console.error(err);
        } else {
            console.log("Results of posting " + activity.id + ": " + body);
        }
    };
};

exports.postActivity = postActivity;
exports.postReport = postReport;
