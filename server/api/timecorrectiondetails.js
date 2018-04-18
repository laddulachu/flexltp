'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_timecorrectiondetails = function(page) {
    console.log("this is time correction details state identification");
         page.extract("timecorrectiondetails") 
        .screen("TIMECORRECTIONDETAILS");
}; 

exports.goToHome = function(page, params) {
    console.log("this is time correction home state identification");

     page.onMutation("home", "", "any", 1000)
        .extract('home')
        .screen("HOME");
    
        page.update("timecorrectionlist", params)
        .action("timecorrectionlist", "home");
};


exports.goToTimePage =function(page, params) {
    page.action("home", "attendancependingforapproval");
};

