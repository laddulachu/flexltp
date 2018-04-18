'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_leavedetails = function(page) {
    console.log("this is Leave details state identification");
         page.extract("leavedetails") 
        .screen("LEAVEDETAILS");
}; 


exports.goToHome = function(page, params) {
    console.log("this is leave home state identification");

     page.onMutation("home", "", "any", 1000)
        .extract('home')
        .screen("HOME");
    
        page.update("leaveapproval", params)
        .action("leaveapproval", "home");
};

exports.goToLeavePage =function(page, params) {

    page.action("home", "leavependingforapproval");
};



