'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');

exports.on_postlogin = function(page) {
    console.log("this is Postlogin state identification");
 
    page.onMutation("home", "", "any", 1000)
        .extract('home')
        .screen("HOME");
    
    page.action("postlogin", "approvetab");
};