/**
 * This file exports:
 * bodyProcessor(bodyPipe, clientPipe, contentType, domain, clientProtocol, originalURL)
 */

var config = require('../config.json');
var handyUtils = require('../libs/handyUtils.js');
var replaceStream = require('replacestream');
var fs = require('fs');

var codeInjection = '';
if(config.injectCode) codeInjection = fs.readFileSync(config.injectionCodePath); // Storing it in the memory is better than piping the file every single time a user requests it

exports.bodyProcessor = async function(bodyPipe, clientPipe, contentType, domain, clientProtocol, originalURL){
    if(config.obscureDomainChecking) // may break some pages. if someone can come up with something that detects " and ', that'll be great
        bodyPipe = bodyPipe.pipe(replaceStream(/window\.location\.href|location\.href/ig, '"'+originalURL+'"'));
    
    var raw = null; // if file is html, it has to be processed as a whole, not with streams
    if(config.enableFilterJavascript || (!contentType.includes('/html') && !contentType.includes('/javascript')))
        bodyPipe = bodyPipe
        .pipe(replaceStream(/(?<="|'|\()(http:\/\/|https:\/\/|\/\/)([^\/"'):]*)(?::(\d+))?/ig,
        function(match, protocolCap, bodyURLCap, optionPortCap){ // cap for capture
            protocolCap = (protocolCap.toLowerCase()==='//'?clientProtocol+'://':protocolCap);
            return clientProtocol+'://'+(protocolCap.toLowerCase()==='https://'?'s':'ns')+(optionPortCap ? optionPortCap : '')+'--'+bodyURLCap.replace(/-/g, '_-').replace(/\./g, '--')+'.'+domain;
        }));
    else if(!contentType.includes('/javascript')){ // unless someone can make a regex that matches anything but inside a script tag, this is a dirty way to do it
        raw = await handyUtils.streamToString(bodyPipe, 'utf-8');
        if(config.removeAllIntegrityAttributes) raw = raw.replace(/integrity=/ig, 'nointegrity=');
        raw = raw.split(/(?=<script)|(?<=\/script>)/i).map(function(eachSplit){
            if(/^<script/i.test(eachSplit)){
                return eachSplit;
            }else{
                return eachSplit.replace(/(?<="|'|\()(http:\/\/|https:\/\/|\/\/)([^\/"'):]*)(?::(\d+))?/ig, // same regex as in the few liens above
                function(match, protocolCap, bodyURLCap, optionPortCap){ // cap for capture
            protocolCap = (protocolCap.toLowerCase()==='//'?clientProtocol+'://':protocolCap);
                    return clientProtocol+'://'+(protocolCap.toLowerCase()==='https://'?'s':'ns')+(optionPortCap ? optionPortCap : '')+'--'+bodyURLCap.replace(/-/g, '_-').replace(/\./g, '--')+'.'+domain;
                });
            }
        }).join('');
    }
    
    // code injection
    if(config.injectCode && contentType.includes('/html')){
        raw = raw ? raw : await handyUtils.streamToString(bodyPipe, 'utf-8'); // ?: used to handle if raw wasn't already assigned
        if(/<head>/i.test(raw))
            raw = raw.replace(/(<head>)/i, '$1'+codeInjection);
        else if(/<body>/i.test(raw))
            raw = raw.replace(/(<body>)/i, '$1'+codeInjection);
        else if(/<html>/i.test(raw))
            raw = raw.replace(/(<html>)/i, '$1'+codeInjection);
        else if(/<!doctype/i.test(raw))
            raw = raw.replace(/(<!doctype(.*)>)/i, '$1'+codeInjection);
        else
            raw = codeInjection + raw;
    }
    (raw ? handyUtils.stringToStream(raw) : bodyPipe).pipe(clientPipe, {
        end: true
    });
};