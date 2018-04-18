'use strict';

var stateManager = require('powwow-server-common').stateManager;
var config = require('../config');
var states = stateManager.states;

exports.on_leaveapproval = function (page) {
    console.log("this is Leave Approval state identification");
    page.extract("leaveapproval")
        .screen("LEAVEAPPROVAL");
};

exports.leveapprove = function (page, params) {
    console.log("this is Leave Approve state identification");

    page.onMutation("approvecomment", "", "any", 1000)
        .extract('approvecomment')
        .screen("APPROVECOMMENT");

    page.update("leaveapproval", params)
        .action("leaveapproval", "approve");
};

exports.levereject = function (page, params) {
    console.log("this is Leave Reject state identification");

    page.onMutation("rejectcomment", "", "any", 1000)
        .extract('rejectcomment')
        .screen("REJECTCOMMENT");

    page.update("leaveapproval", params)
        .action("leaveapproval", "reject");

};

exports.leavecheckbox = function (page, params) {
    console.log("this is Leave chechbox state identification");

    page.onMutation("approvecomment", "", "any", 1000)
        .extract('leaveapproval')
        .screen("LEAVEAPPROVAL");

    var leaveIndex = "leaveappn[" + params.itemNo + "].leavecheck";
    page.update("leaveapproval", params)
        .action("leaveapproval", leaveIndex);
    //.screen("leaveapproval");
};

exports.goToHome = function (page, params) {
    console.log("this is leave home state identification");

    page.onMutation("home", "", "any", 1000)
        .extract('home')
        .screen("HOME");

    page.update("leaveapproval", params)
        .action("leaveapproval", "home");
};



