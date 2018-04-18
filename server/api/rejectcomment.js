'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_rejectcomment = function(page) {
    console.log("this is Reject Comment state identification");
         page.extract("rejectcomment") 
            .screen("REJECTCOMMENT");
}; 

exports.rejectcommentok = function(page, params) {
    console.log("this is Leave Reject comment ok state identification");
    
     page.onMutation("leaveapproval", "", "any", 1000)
        .onTimer(8000, "waiting")
        .extract('leaveapproval')
        .screen("LEAVEAPPROVAL");

        page.update("rejectcomment", params)
        .action("rejectcomment", "ok");
};

exports.rejectcommentcancel = function(page, params) {
    console.log("this is Leave Reject comment cancel state identification");

     page.onMutation("leaveapproval", "", "any", 1000)
        .extract('leaveapproval')
        .screen("LEAVEAPPROVAL");
    
        page.update("rejectcomment", params)
        .action("rejectcomment", "cancel");
};