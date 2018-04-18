'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_login = function(page) {
    console.log("this is login state identification");
         page.extract("login") 
        .screen("LOGIN");
};

exports.login = function(page, params) {
	console.log("this is login action state identification");
    page.update("login", params)
        .action("login", "login");
}; 