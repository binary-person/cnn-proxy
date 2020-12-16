# CNN Proxy
[<img src="https://svgur.com/i/KR4.svg" width="50%">](https://www.skysilk.com/ref/LoN8hTt8Mu)

Table of contents:

- [Project details](#project-details)
	- [Goals of this project](#goals-of-this-project)
	- [Current features and limitations](#current-features-and-limitations)
- [Running your own CNN proxy](#running-your-own-cnn-proxy)
	- [Requirements](#requirements)
	- [Installation](#installation)
		- [Prerequisites](#prerequisites)
		- [Cloning and running the source code](#cloning-and-running-the-source-code)
		- [Cloudflare setup](#cloudflare-setup)
- [config.json documentation](#config.json-documentation)
	- [bindingAddress](#bindingaddress)
	- [port](#port)
	- [defaultIPv6](#defaultipv6)
	- [enableFilterJavascript](#enablefilterjavascript)
	- [obscureDomainChecking](#obscuredomainchecking)
	- [injectCode](#injectcode)
	- [injectionCodePath](#injectioncodepath)
	- [removeCachingHeaders](#removecachingheaders)
	- [removeAllIntegrityAttributes](#removeallintegrityattributes)
	- [publicFolder](#publicfolder)
	- [filterMimeTypes](#filtermimetypes)
	- [associateMime](#associatemime)
	- [defaultMime](#defaultmime)
	- [blacklistDomains](#blacklistdomains)
- [Ending notes](#ending-notes)


## Project details

The CNN proxy uses Cloudflare, Nginx, and Node, hence the name CNN (no, it's not Central News Network. Has nothing to do with that.)<br>
Cloudflare handles the SSL and caching. Nginx handles all websocket requests and forwards all requests to the Node app which aren't websockets. Finally, the Node app processes the headers of the server and the client.


### Goals of this project

This project is intended to fully proxy all requests including websockets. Unlike some URL based proxies out there (examples are [Node Unblocker](https://github.com/nfriedly/node-unblocker) and [mirrorrr](https://github.com/bslatkin/mirrorrr); both great projects nevertheless), CNN uses subdomains as a way to handle proxying so that the 'href="/assets/picture.png"' problem is solved easily.<br>
Because this proxy uses subdomains as a way to proxy, it is relatively easy to use a simple `String.replace` function to automatically grab all (sub)domain links like "https://example.com" and convert that to the proxying (sub)domain.


### Current features and limitations

This proxy handles all the origin and referer headers, converting them to their original URLs before sending it to the server to avoid server rejection because of a differing origin. It also strips Cloudflare headers before sending to the server.<br>
Nginx plays a big part in websocket handling. a request at wss://proxyurl will automatically have Nginx handle it. Other URLs like http(s):// are handled and sent directly to the node app.


Currently, this proxy can proxy:
- Google Search
- Google Maps
- YouTube
- Discord
- Any sites that are hosted on ports other than the default (like https for 443 and http for 80)
- Any sites with logins
- Any sites with websockets
- And probably a bunch of other sites that I didn't test


Here's just some of the list of proxying perks and features:
- Client injection features
	- List of APIs that are wrapped (so when a site uses these APIs to make a request, they will always go through CNN):
		- `new Websocket`
		- `new XMLHttpRequest`
		- `window.fetch`
		- `new Request`
		- `window.open`
		- `window.postMessage` (doesn't always work, especially if the code uses `window.parent.postMessage`)
		- Changes in the DOM:
		- attribute changes are handled and converted to the proxy URL
		- appending elements to the DOM are handled and each attribute is scanned and converted to the proxy URL
- Server header processing features
	- Strips Cloudflare's anti-DDoS headers before sending to the server
	- Converts the "origin" and "referer" to their original URLs before sending to the server
	- Converts the "location" header to the proxy URL before sending to the client
	- Set cors headers to the origin URL
	- Loops through each set-cookie header and changes the "domain" value to the proxy's
	- Has the feature of blocking specific URLs, useful for adblocking


The following limitations of this CNN proxy server are sadly unfixable (to the extent of my knowledge and laziness). However, if anyone wants to make a pull request, I will be more than happy to review the code and merge.
- Google logins
- Captchas and all those other "are you a bot" scripts. It may work, may not work
- All the `window.location.href = 'https://no-way-youre-using-that-proxysite.com'` in the code


## Running your own CNN proxy

There is a lot more requirements compared to that of URL proxies (like [Node Unblocker](https://github.com/nfriedly/node-unblocker)) since this is a proxying method based on subdomains.<br>
Also, be warned that your site may receive a bunch of fraud alerts. I've received multiple fraud alerts from Freenom and Chrome (makes sense but whatever).<br>
To give you a general overview of the networking:
```
1. A request is made at https://proxysite on Cloudflare's network
2. Cloudflare forwards the request to your server's nginx on port 80
3. From here, things can go two ways.
	3a. If the request is a websocket, let nginx handle it and proxy the request
	3b. If the request isn't a websocket, nginx will forward the request to the locally hosted node app on port 8888 (or another port configured under config.json)
```


### Requirements

You will need the following:
- A domain that you fully own (at least be able to change the nameservers)
- A Cloudflare account
- A server/VPS/computer/\*whatever you want to call it\* and have sudo/admin privileges (for later installation)
- Ubuntu 18.04 (although this may work for a bunch of other Linux distros and probably even Windows, this guide is specifically for Ubuntu 18.04)


### Installation

#### Prerequisites

Before anything, always check that you've updated everything.

```
$ sudo apt-get update
$ sudo apt-get upgrade # this is recommended, but it's optional
```

If you have git installed already, then skip this step.

```
$ sudo apt-get install git
```

If you have node installed already, then skip this step.

```
# credit: https://github.com/nodesource/distributions
$ curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
$ sudo apt-get install -y nodejs
```

If you have nginx installed already, then skip this step.

```
$ sudo apt-get install nginx
```

If you have the Lua nginx module installed already, then skip this step.

```
$ sudo apt-get install lua-nginx-redis
```

#### Cloning and running the source code

For this tutorial, we are going to use "~/cnn-proxy" to store the code needed to run the node app.<br>
Additionally, we are going to overwrite "/etc/nginx/nginx.conf" so if you previously modified the file, make sure to make a backup of it by running a simple command like `sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak`.


To start, we need to get clone the repo.

```
$ git clone https://github.com/scheng123/cnn-proxy.git ~/cnn-proxy
```

Overwrite the existing nginx.conf, replacing it with CNN's nginx.conf.
```
$ sudo cp ~/cnn-proxy/nginx.conf /etc/nginx/nginx.conf
```

Now we need to update the changes.
```
$ sudo service nginx restart
```
Note that if this command doesn't work, you have an app running on port 80 that's conflicting with this.

Change directory to the cloned CNN proxy and install the required modules.

```
$ cd ~/cnn-proxy
$ npm install
```

Just run `node index.js` and you're good to go! (no you're not)


Optional: To make this script start at system startup, we will be using `pm2` to do it.

```
# Install pm2
$ sudo npm install -g pm2
# Run the index.js script using pm2
$ pm2 start index.js
# Run the command in order to config pm2 to startup scripts
$ sudo pm2 startup
# Finally to save the run configuration
$ pm2 save
```

#### Cloudflare setup

Oh, you thought we were done here? Not by a long shot!<br>
As you saw in the requirements, you need a domain and a Cloudflare account.<br>
Here are the steps:
1. Create a Cloudflare account if you haven't already
2. Click on "Add site" in the top right corner
3. Paste your domain name into the input area and click on "Add site"
4. Change your nameservers in your domain to your assigned Cloudflare nameservers. (Lookup on how to change your nameservers for your specific domain registrar)
5. Add an A record, entering `@` for the "name" and your machine's IP address for the "value." Must be IPv4
6. Add another A record, entering `*` for the "name" and your machine's IP address for the "value." Must be IPv4
7. Now click next, and if it tells you to configure SSL and security items, skip it for now.
8. And just like that, you're good to go! It should be accessible through your domain if you setup everything correctly.


## config.json documentation

The default/recommended config should look something like this:

```
{
    "bindingAddress": "127.0.0.1",
    "port": 8888,
    "sessionPeriod": 604800000,
    "sessionCookieName": "CNN_PROXY_SESSION_ID",
    "defaultIPv6": false,
    "enableFilterJavascript": false,
    "obscureDomainChecking": false,
    "injectCode": true,
    "injectionCodePath": "injection.html",
    "removeCachingHeaders": false,
    "removeAllIntegrityAttributes": true,
    "publicFolder": "public_root/",
    "filterMimeTypes": [
        "/html",
        "/css",
        "/javascript",
        "/json"
    ],
    "associateMime": {
    	"" : "text/html",
    	"html" : "text/html",
    	"js": "application/javascript",
    	"css": "text/css"
    },
    "defaultMime": "application/octet-stream",
    "blacklistDomains": [
        "example\\.com"
    ],
    "whitelistDomains": []
}
```

Just to clarify, "filtering" simply means to process the file and replace all occurrences of "http(s)://domain.com" with "http(s)://proxysite.com" amongst other things.


### bindingAddress

type: `String`<br>
Highly recommended that this option is set to `"127.0.0.1"` since this app shouldn't be available publically other than locally, which is only accessed by nginx.


### defaultIPv6

type: `boolean`<br>
Enabling this will force nodejs's requests to default to IPv6. Doesn't not work if your machine doesn't have a IPv6 address.<br>
This is super duper not recommended since requests to non-IPv6 websites will break.


### port

type: `Integer`<br>
If you are planning to change this value, be sure to update the the port under `upstream` in the nginx.conf so that nginx can reach the node app.<br>
Note that this can be overridden by specifying an argument like so: `node index.js 8889`


### sessionPeriod

type: `Integer`<br>
Takes a value in ms. On every `sessionPeriod` ms, the server will generate a new session that users are required to set as their cookie. A value of `0` disables this.


### sessionCookieName

type: `String`<br>
Specifies the cookie name for the session ID.


### enableFilterJavascript

type: `boolean`<br>
Enabling this may break some pages. Disabling prevents the filtering/processing of the `<script>` tag. Best to keep this off since all the javascript web requests are wrapped with code injection.


### obscureDomainChecking

type: `boolean`<br>
Replaces all occurrences of 'window.location.href' with '"https://originalurl"'. This is used against client-side scripts which might include this in order to detect if the website is running under their site.<br>
This option has a high probability that it would break pages. Also, this option is not affected by `enableFilterJavascript`.


### injectCode

type: `boolean`<br>
This option will enable the functionality for injecting javascript code that wraps websocket requests amongst other stuff (like XMLHttpRequest requests).


### injectionCodePath

type: `String`<br>
This option will only be effective if `injectCode` is enabled. This specifies the path to the html file used for injecting code.


### removeCachingHeaders

type: `boolean`<br>
This option is best used for debugging and testing. All it does is set the `expires` header to the 1990s.


### removeAllIntegrityAttributes

type: `boolean`<br>
This option is best used if you have `enableFilterJavascript` enabled. It should be enabled anyhow since it changes the `integrity=` attribute to `nointegrity=`, just in case if the `src=` file it's referencing got changed by the proxy.<br>
May break some pages.


### publicFolder

type: `String`<br>
This option is for specifying the folder to serve when a user visits the root domain (root domain is "https://domain.com", not "https://subdomain.domain.com").<br>
404 pages will use publicFolder/404.html.<br>
Must include a slash at the end.


### filterMimeTypes

type: `Array[...String]`<br>
This option is used for determining whether to run the filtering function for a given mime (content-type).<br>
Note that the test function is `String.includes` so a value like `["/javascript"]` would match `text/javascript` and `application/javascript`.


### associateMime

type: `Object`<br>
This option is used for cases where the server doesn't forward a `content-type`. In such cases, the mime is determined by the end of the URL excluding query strings. `https://somesite.com/style.css?somestuff=somestuff` <= where `css` is fed into the Object and the resultant mime should return. More details in the later paragraphs.<br>
An example of use would be that the server sends an HTML file but doesn't send a `content-type` header. This will assign the missing header and the subsitute mime will get compared with `filterMimeTypes` to determine if the body content should be passed through the filtering function.<br>
This option accepts an Object where the property name is the extension and the property value is the resultant mime for that extension.<br>
Example:

```
{
	"" : "text/html", // assuming that the path is somewhat like https://blah.com/something/
	"html" : "text/html", // https://blah.com/something.html
	"js": "application/javascript", // https://blah.com/something/somescript.js
	"css": "text/css" // https://blah.com/something/style.css
}
```


### defaultMime

type: `String`<br>
This option is used to determine what mime to associate with content-type in case the associating mime cannot be found in `associateMime`.


### blacklistDomains

type: `Array[..."regex"]`<br>
This option determines whether to block the domain or not.<br>
Because JSON doesn't like regexes, the regex is to be put inside a string and be passed into the function `new RegExp(stringRegex)`. Therefore, the test function is `(new RegExp(stringRegex)).test(targetDomain)`.<br>
An example of blocking everything would be `[^]*` and an example of blocking `example.com` would be `example\\.com`.


### whitelistDomains

type: `Array[..."regex"]`<br>
This option determines whether to allow the domain or not.<br>
This is essentially the same as `blacklistDomains`, but this takes precedence. A use case would be to have a wildcard blacklistDomain `[^]*` to block everything and using this option to allow certain websites.


## Ending notes
This software is released under GNU General Public License version 3. A copy of this license is available in the repository's root directory with a file named "LICENSE."<br>
I may work on this project more, or I may not touch it for a couple of years. Either way, if you wish to contribute, make a pull request and I'll be more than happy to take a look at it.


Made with love,<br>
Simon Cheng