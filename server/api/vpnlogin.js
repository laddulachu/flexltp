'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_vpnlogin = function(page) {
    console.log("this is vpn login state identification");
    page.extract("vpnlogin");
}; 