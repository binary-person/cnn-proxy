/**
 * This file exports:
 * clientHeaderProcesser(headers, paarsed)
 * serverHeaderProcesser(headers, domain, origin, protocol)
 */

var config = require('../config.json');
var processURL = require('../libs/processURL.js');

// client => clientHeaderProcesser => server
exports.clientHeaderProcesser = function(headers, parsed){
    headers.host = parsed.targetHost;
    
    if(headers['referer']) headers['referer'] = processURL.convertToOriginalURL(headers['referer']);
    if(headers['origin']) headers['origin'] = processURL.convertToOriginalURL(headers['origin']);
    if(headers['authority']) headers['authority'] = processURL.convertToOriginalURL(headers['authority']);
    
    if(headers['cf-ipcountry']) delete headers['cf-ipcountry'];
    if(headers['x-forwarded-for']) delete headers['x-forwarded-for'];
    if(headers['cf-ray']) delete headers['cf-ray'];
    if(headers['x-forwarded-proto']) delete headers['x-forwarded-proto'];
    if(headers['cf-visitor']) delete headers['cf-visitor'];
    if(headers['cf-connecting-ip']) delete headers['cf-connecting-ip'];
    if(headers['cdn-loop']) delete headers['cdn-loop'];
    
    return headers;
};

// server => serverHeaderProcesser => client
exports.serverHeaderProcesser = function(headers, domain, origin, protocol){
    // I do not know what made me think that I should make the site more vulnerable to attacks
    // if(!headers['access-control-expose-headers']){
    //     var listExposeHeaders = [];
    //     for(var headerName in headers)
    //         if(!['cache-control', 'content-language', 'content-type', 'expires', 'last-modified', 'pragma'].includes(headerName))
    //             listExposeHeaders.push(headerName);
    //     if(listExposeHeaders.length)
    //         headers['access-control-expose-headers'] = listExposeHeaders.join(', ');
    // }
    
    if(headers['location'] && /^https?:\/\/|^\/\//i.test(headers['location'])){
        headers['location'] = headers['location'].replace(/^(http:\/\/|https:\/\/|\/\/)([^\/:]*)(?::(\d+))?/ig, // regex adopted from injection.html
        function(match, protocolCap, bodyURLCap, optionPortCap){
            protocolCap = (protocolCap.toLowerCase()==='//'?protocol+'://':protocolCap);
            return protocol+'://'+(protocolCap.toLowerCase()==='https://'?'s':'ns')+(optionPortCap ? optionPortCap : '')+'--'+bodyURLCap.replace(/-/g, '_-').replace(/\./g, '--')+'.'+domain;
        });
    }
    
    if(headers['set-cookie'] && headers['set-cookie'].length)
        for(var c = 0; c < headers['set-cookie'].length; c++)
            headers['set-cookie'][c] = headers['set-cookie'][c].replace(/(?<!;)$/, ';').replace(/(?<=domain=)(.*)(?=;)/ig, '.'+domain);
    if(config.removeCachingHeaders) headers['expires'] = 'Mon, 1 Jan 1990 00:00:00 GMT';
    delete headers['content-security-policy'];
    headers['content-length'] = null; // SUPER IMPORTANT for making sure a stream doesn't just cut or extend
    headers['access-control-allow-origin'] = origin ? origin : '*';
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS, HEAD';
    headers['access-control-allow-credentials'] = 'true';
    delete headers['x-frame-options'];
    return headers;
};