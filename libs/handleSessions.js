/**
 * This file exports:
 * isSessionValid(cookies)
 * getID()
 */

var config = require('../config.json');

var lastSessionUpdate = Date.now();
var currentSession = makeID();

exports.getID = function(){
    if(lastSessionUpdate + config.sessionPeriod < Date.now()){
        currentSession = makeID();
        lastSessionUpdate = Date.now();
    }
    return currentSession;
};
exports.isSessionValid = function(cookies) {
    if (config.sessionPeriod === 0) {
        return true;
    } else {
        var parsedCookies = parseCookies(cookies);
        return parsedCookies[config.sessionCookieName] === exports.getID();
    }
};

// credit to https://stackoverflow.com/a/3409200/6850723
function parseCookies (rc) {
    var list = {};

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

// credit to https://stackoverflow.com/a/1349426/6850723
function makeID() {
    var length = 6;
    var result = '.';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return Math.floor(Date.now()/1000) + result;
}
