'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_home = function(page) {
    console.log("this is Home state identification");
         page.extract("home") 
        .screen("HOME");
}; 

exports.leaveApproval = function(page) {
    console.log("this is home state to leaveapproval state identification");

     page.onMutation("leaveapproval", "", "any", 1000)
        .extract('leaveapproval')
        .screen("LEAVEAPPROVAL");
    
        page.action("home", "leavependingforapproval");
}; 

exports.timeCorrection = function(page) {
    console.log("this is home state to time correction state identification");

    page.onMutation("timecorrectionlist", "", "any", 1000)
        .extract('timecorrectionlist')
        .screen("TIMECORRECTIONLIST");

    page.action("home", "attendancependingforapproval");
}; 