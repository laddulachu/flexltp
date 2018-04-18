'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_vpnprelogin = function(page) {
    console.log("this is vpn prelogin state identification");
        page.action("vpnprelogin", "continue");
}; 