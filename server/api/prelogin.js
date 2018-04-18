'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_prelogin = function(page) {
    console.log("this is Prelogin state identification");
      page.action("prelogin", "link");
};