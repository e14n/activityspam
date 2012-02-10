// Tokenizer for activity spam filter
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

var BOUNDARY = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_]+/;
var BOUNDARYG = /[ \n\r\t<>\/"\'.,!\?\(\)\[\]&:;=\\{}\|\-_]+/g;

var Tokenizer = {

    tokenString: function(str) {
        return str.replace(BOUNDARYG, '-');
    },

    tokenArray: function(str) {
        return str.split(BOUNDARY).filter(function (s) { return (s.length > 0); });
    },

    makeDigrams: function(parts) {
        var i, dg = [];

        for (i = 0; i < parts.length; i++) {
            if (i === 0) {
                dg.push("^" + parts[i]);
            }
            if (i == parts.length - 1) {
                dg.push(parts[i] + "^");
            } else {
                dg.push(parts[i] + "^" + parts[i+1]);
            }
        }

        return dg;
    },

    isArray: function(obj) {
        if (obj.constructor.toString().indexOf("Array") == -1) {
            return false;
        } else {
            return true;
        }
    },

    tokenize: function(obj) {
        var tokens = [],
            prefixer = function(full) {
                return function(part) { return full + '=' + part; };
            },
            prop, full, parts, fixer, prefixed, digrams, prefixedDigrams, fp, i;

        if (this.isArray(obj)) {
            full = (arguments.length == 2) ? arguments[1]+'.length' : 'length';
            tokens.push(full+'='+obj.length);
        }

        for (prop in obj) {
            fp = [];
            if (this.isArray(obj)) {
                fp.push((arguments.length == 2) ? arguments[1]+'.N' : 'N');
            } else {
                fp.push((arguments.length == 2) ? arguments[1]+'.'+prop : prop);
            }
            for (i in fp) {
                full = fp[i];
                switch (typeof(obj[prop])) {
                case "string":
                    fixer = prefixer(full);
                    parts = this.tokenArray(obj[prop]);
                    tokens = tokens.concat(parts);
                    digrams = this.makeDigrams(parts);
                    tokens = tokens.concat(digrams);
                    prefixed = parts.map(fixer);
                    tokens = tokens.concat(prefixed);
                    prefixedDigrams = digrams.map(fixer);
                    tokens = tokens.concat(prefixedDigrams);
                    break;
                case "number":
                case "boolean":
                    tokens.push(full+'='+this.tokenString(obj[prop].toString()));
                    break;
                case "object":
                    tokens = tokens.concat(this.tokenize(obj[prop], full));
                    break;
                default:
                    // XXX: loggit
                    break;
                }
            }
        }
        return tokens;
    }
};

exports = Tokenizer;
