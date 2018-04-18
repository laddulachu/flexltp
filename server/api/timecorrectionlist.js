'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_timecorrectionlist = function(page) {
    console.log("this is timecorrectionlist state identification");
         page.extract("timecorrectionlist") 
        .screen("TIMECORRECTIONLIST");
}; 

exports.timeapprove = function(page, params) {
    console.log("this is time correction Approve state identification");

    page.onMutation("timecorrectionlist", "", "any", 1000)
        .onTimer(20000, "waiting")
        .extract('timecorrectionlist')
        .screen("TIMECORRECTIONLIST");

        page.update("timecorrectionlist", params)
        .action("timecorrectionlist", "approve");
};

exports.timereject = function(page, params) {
    console.log("this is time correction Reject state identification");

       page.onMutation("timecorrectionlist", "", "any", 1000)
        .onTimer(20000, "waiting")
        .extract('timecorrectionlist')
        .screen("TIMECORRECTIONLIST");
        
        page.update("timecorrectionlist", params)
        .action("timecorrectionlist", "reject");
};

exports.timecheckbox = function(page, params) {
    console.log("this is time correction checkbox state identification");

    page.onMutation("timecorrectionlist", "", "any", 1000)
        .onTimer(1000, "waiting")
        .extract('timecorrectionlist')
        .screen("TIMECORRECTIONLIST");

    var timeIndex = "timecorrectionappn["+params.itemNo+"].selectappl";
        page.update("timecorrectionlist", params)
        .action("timecorrectionlist", timeIndex);
       // .screen("timecorrectionlist");
};

exports.goToHome = function(page, params) {
    console.log("this is time correction home state identification");
    
     page.onMutation("home", "", "any", 1000)
        .extract('home')
        .screen("HOME");
    
        page.update("timecorrectionlist", params)
        .action("timecorrectionlist", "home");
};


