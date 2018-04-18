'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_approvecomment = function(page) {
    console.log("this is Approve Comment state identification");
        page.extract("approvecomment") 
        .screen("APPROVECOMMENT");
}; 

exports.approvecommentok = function(page, params) {
    console.log("this is Leave Approve comment ok state identification");
    
      page.onMutation("leaveapproval", "", "any", 1000)
        .onTimer(8000, "waiting")
        .extract('leaveapproval')
        .screen("LEAVEAPPROVAL");

        page.update("approvecomment", params)
        .action("approvecomment", "ok");
};

exports.approvecommentcancel = function(page, params) {
    console.log("this is Leave Approve comment cancel state identification");

      page.onMutation("leaveapproval", "", "any", 1000)
        .extract('leaveapproval')
        .screen("LEAVEAPPROVAL");
    
        page.update("approvecomment", params)
        .action("approvecomment", "cancel");
};