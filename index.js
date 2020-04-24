var config = require('./config.json');
var processURL = require('./libs/processURL.js');
var processHeaders = require('./libs/processHeaders.js');
var processBody = require('./libs/processBody.js');
var handyUtils = require('./libs/handyUtils.js');

var http = require('http');
var URL = require('url').URL;
var httpStatic = require('node-static');

var fileServer = new httpStatic.Server(config.publicFolder);

function requestHandler(client_req, client_res) {
    // Handle if client decides to fetch the main page of the proxy
    if(client_req.headers.host && client_req.headers.host.split('.').length === 2){ // root host should look something like blah.ga, resulting in a split length of 2
        fileServer.serve(client_req, client_res, function (e, res) {
            if (e && (e.status === 404))
                fileServer.serveFile('/404.html', 404, {}, client_req, client_res);
        });
        return;
    }
    
    
    // Proxying code
    var parsed = processURL.convertToOriginalHost(client_req.headers.host);
    var originalProto = client_req.headers['x-forwarded-proto']; // same reason as above comment
    var originalOrigin = client_req.headers['origin']; // same reason
    
    client_req.url = processURL.processURLQueries(client_req.url);
    
    if(!parsed){
        client_res.writeHead(400);
        client_res.end('Invalid request');
        return;
    }
    if(handyUtils.checkBlacklistDomain(parsed.targetHost)){
        client_res.writeHead(403);
        client_res.end('Sorry, you\'re not allowed to access this page');
        return;
    }
    
    var options = {
        hostname: parsed.targetHost,
        port: parsed.port,
        path: client_req.url,
        method: client_req.method,
        headers: processHeaders.clientHeaderProcesser(client_req.headers, parsed)
    };
    var proxy = handyUtils.httpOrHttps(parsed.isSecure, options, function(res) {
        var originalLength = res.headers['content-length'];
        client_res.writeHead(res.statusCode, processHeaders.serverHeaderProcesser(res.headers, parsed.domain, originalOrigin, originalProto));
        if(originalLength !== '0' && !res.headers['location']){ // if we pipe a length of 0, the client pipe's "close" event will never be called, so this handles that condition
            if(!res.headers['content-type'])
                res.headers['content-type'] = handyUtils.getMime(client_req.url.toLowerCase().split('/').pop().split('.').pop());
            if(handyUtils.ifArrayStringIncludes(res.headers['content-type'], config.filterMimeTypes))
                processBody.bodyProcessor(res, client_res, res.headers['content-type'], parsed.domain, originalProto || 'http', (parsed.isSecure ? 'https':'http')+'://'+parsed.targetHost+client_req.url);
            else
                res.pipe(client_res, {
                    end: true
                });
        }else{
            client_res.end();
        }
    }).on('error', ()=>{
        client_res.writeHead(400);
        client_res.end('Request error');
    });
    
    client_req.pipe(proxy, {
        end: true
    });
}


http.createServer(requestHandler).listen(config.port, config.bindingAddress, ()=>console.log('CNN node proxy running on '+config.bindingAddress+':'+config.port));