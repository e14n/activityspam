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

var config = require('../config'),
    _ = require('underscore'),
    User = require('../models/user').User,
    NoSuchThingError = require('databank').NoSuchThingError,
    Tokenizer = require('../lib/tokenizer').Tokenizer,
    SpamFilter = require('../lib/spamfilter').SpamFilter;

exports.index = function(req, res, next) {
    res.render('index', { title: 'Home', 
                          site: (config.site) ? config.site : "ActivitySpam" });
};

exports.api = function(req, res, next) {
    res.render('api', { title: 'API', 
                        site: (config.site) ? config.site : "ActivitySpam" });
};

exports.loginForm = function(req, res, next) {
    res.render('login', { title: 'Login', 
                          error: null,
                          site: (config.site) ? config.site : "ActivitySpam" });
};

exports.registerForm = function(req, res, next) {
    res.render('register', { title: 'Register', 
                             error: null,
                             site: (config.site) ? config.site : "ActivitySpam" });
};

exports.login = function(req, res, next) {

    var user, email, password,
        showError = function(message) {
            res.render('login', { title: 'Login',
                                  error: message,
                                  site: (config.site) ? config.site : "ActivitySpam" });
        };

    if (!_(req.params).has('email')) {
        showError("No email.");
        return;
    }

    if (!_(req.params).has('password')) {
        showError("No password.");
        return;
    }

    User.get(req.params.email, function(err, user) {
        if (err) {
            showError("Incorrect email or password.");
            return;
        }

        user.checkPassword(req.params.password, function(err, match) {
            if (!match) {
                showError("Incorrect email or password.");
                return;
            }
            req.session.email = email;
            res.redirect('/apps', 303);
        });
    });
};

exports.register = function(req, res, next) {
    var user, email, password,
        showError = function(message) {
            res.render('register', { title: 'Register',
                                     error: message,
                                     site: (config.site) ? config.site : "ActivitySpam" });
        };

    if (!_(req.params).has('email')) {
        showError("No email.");
        return;
    }

    email = req.params.email;

    if (!_(req.params).has('password')) {
        showError("No password.");
        return;
    }

    password = req.params.password;

    if (!_(req.params).has('confirm')) {
        showError("No password confirmation.");
        return;
    }

    confirm = req.params.confirm;

    if (confirm !== password) {
        showError("Passwords don't match.");
        return;
    }

    User.get(req.params.email, function(err, old) {
        var newUser;
        if (old) {
            showError("User already exists");
            return;
        }
        newUser = {email: email,
                   password: password};
        User.create(newUser, function(err, user) {
            req.session.email = email;
            res.redirect('/apps', 303);
        });
    });
};

exports.apps = function(req, res, next) {
    res.render('apps', { title: 'Apps', 
                          site: (config.site) ? config.site : "ActivitySpam" });
};

exports.thisIsSpam = function(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 
        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }
        SpamFilter.train('spam', req.body, function(err, trainrec) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: err.message}));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(trainrec));
            }
        });
    });
};

exports.thisIsHam = function(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 
        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }
        SpamFilter.train('ham', req.body, function(err, trainrec) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: err.message}));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(trainrec));
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

        if (!authenticated) {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end(JSON.stringify("Not authorized"));
            return;
        }

        var tokens = uniq(Tokenizer.tokenize(req.body));

        SpamFilter.test(tokens, function(err, decision) {
            if (err) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(err.message));
            } else {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(decision));
            }
        });
    });
};

exports.testTokenize = function(req, res, next) {
    req.authenticate(['oauth'], function(error, authenticated) { 

        if (error) {
            console.log(error);
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(err.message));
            return;
        }

        if (authenticated) {
            var tokens = Tokenizer.tokenize(req.body);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(tokens));
        }
    });
};
