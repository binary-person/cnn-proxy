/**
 * This file exports:
 * convertToOriginalHost(host)
 * convertToOriginalURL(proxyURL)
 * processURLQueries(path)
 */

var URL = require('url').URL;

var supportedProtocols = { // reference purposes
    's': true, // https
    'ns': false // http
};

exports.convertToOriginalHost = function(host){
    if(!host) return false;
    var splitHost = host.split('.');
    if(splitHost.length !== 3)
        return false;
    var domain = splitHost.slice(1, 3).join('.');
    var subdomain = host.split('.')[0];
    var split = subdomain.split(/(?<!_)--/g);
    
    if(split.length < 3) // a good URL should look at least contain two --: [secure, example, com]
        return false;
    
    split[0] = split[0].replace(/^https?:\/\//i, ''); // in case http(s):// exists
    
    var port = null;
    split[0] = split[0].replace(/(?<=s)(\d*)/, function(match, capture1){
        port = capture1;
        return ''; // delete the PORT part
    }); // remove PORT https://securePORT part
    if(supportedProtocols[split[0]] === undefined)
        return false;
    else{
        var isSecure = supportedProtocols[split.shift()];
        var possiblePath = '';
        domain = domain.replace(/\/[^]*/, function(match){
            if(match) possiblePath = match;
            return ''; // delete the path from domain
        });
        return {
            isSecure,
            targetHost: split.join('.').replace(/_-/g, '-') + possiblePath,
            port: port ? port : (isSecure ? 443 : 80),
            domain
        };
    }
};

exports.convertToOriginalURL = function(proxyurl){ // a nice, friendly wrapper for convertToOriginalHost
    var parsed = exports.convertToOriginalHost(proxyurl);
    if(!parsed) return proxyurl;
    
    // remove the port if it is associated with https=>443 or http=>80
    if(parsed.isSecure){
        parsed.port = parsed.port == '443' ? '' : ':'+parsed.port;
    }else{
        parsed.port = parsed.port == '80' ? '' : ':'+parsed.port;
    }
    
    return (parsed.isSecure ? 'https://' : 'http://') + parsed.targetHost.replace(/\//, parsed.port+'/');
};

exports.processURLQueries = function(path){ // used to convert query origins /?origin=hahaiknowthisisaproxysite.com to /?origin=originalsite.com
    var urlObj;
    try{ // make sure to handle deformed urls
        urlObj = new URL('https://fakeurl.com'+path);
    }catch(e){
        return path;
    }
    var keepTrackDuplicates = {};
    for(var eachQuery of urlObj.searchParams.keys()){
        if(eachQuery in keepTrackDuplicates){ // set flag so that we handle it properly
            keepTrackDuplicates[eachQuery] = false;
        }else{
            keepTrackDuplicates[eachQuery] = true;
        }
    }
    for(var eachTargetQuery in keepTrackDuplicates){
        if(keepTrackDuplicates[eachTargetQuery]){
            urlObj.searchParams.set(eachTargetQuery, exports.convertToOriginalURL(urlObj.searchParams.get(eachTargetQuery)));
        }else{
            var allQueryParams = urlObj.searchParams.getAll(eachTargetQuery);
            urlObj.searchParams.set(eachTargetQuery, exports.convertToOriginalURL(allQueryParams[0])); // by setting this, will remove all other queries (which is the reason why I handled this condition)
            for(var count = 1; count < allQueryParams.length; count++){
                urlObj.searchParams.append(eachTargetQuery, exports.convertToOriginalURL(allQueryParams[count]));
            }
        }
    }
    return urlObj.pathname+urlObj.search+urlObj.hash;
};