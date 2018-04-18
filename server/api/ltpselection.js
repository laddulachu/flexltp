'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_ltpselection = function(page) {
    console.log("this is Ltp Selection state identification");
        page.action("ltpselection", "chinaltplink");
}; 