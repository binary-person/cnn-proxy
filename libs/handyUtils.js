/**
 * This file exports:
 * httpOrHttps(secure, ...argg)
 * ifArrayStringIncludes(testString, array)
 * streamToString(string, encoding)
 * stringToStream(string)
 * getMime(extension)
 */

var config = require('../config.json');
var http = require('http');
var https = require('https');
var Readable = require('stream').Readable;

exports.httpOrHttps = function(secure, ...args){
    if(secure)
        return https.request(...args);
    else
        return http.request(...args);
};
exports.ifArrayStringIncludes = function(testString, array){
    for(var count = 0; count < array.length; count++)
        if(testString.includes(array[count]))
            return true;
    return false;
};
exports.streamToString = function(stream, encoding) {
    var chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString(encoding)));
    });
};
exports.stringToStream = function(string){
    var stream = new Readable();
    stream._read = ()=>{};
    stream.push(string);
    stream.push(null);
    return stream;
};
exports.getMime = function(extension){ // used to handle the default mime config.defaultMime
    return config.associateMime.hasOwnProperty(extension) ? config.associateMime[extension] : config.defaultMime;
};
exports.checkBlacklistDomain = function(domain){
    for(let stringRegex of config.whitelistDomains){
        if((new RegExp(stringRegex)).test(domain)){
            return false;
        }
    }
    for(let stringRegex of config.blacklistDomains){
        if((new RegExp(stringRegex)).test(domain)){
            return true;
        }
    }
    return false;
};