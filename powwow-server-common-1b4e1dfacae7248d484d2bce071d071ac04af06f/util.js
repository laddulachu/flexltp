'use strict';

var moment = require('moment');
var fs = require('fs');

var config = require.main.require('./config');

var logger = require('./logger');
var stateManager = require('./stateManager');
var client = require('./client');
var browser = require('./phantomBrowser');

/*
 * Method to take a snapshot of the current view of the screen.
 */
exports.snapshot = function (page, params) {
    logger.debug("util.snapshot");

    //Create root folder as required
    var sbRoot = './Snapshots';
    var filename = sbRoot + "/snapshot-" + moment().format("MMDDYY-HHmmss") + ".png";

    if (!fs.existsSync(sbRoot)) {
        fs.mkdirSync(sbRoot);
    }

    page.render(filename).then(function() {
        client.notification("util.snapshot")({filename: filename});
    });
};

/*
 * Method to report issues on app hang by taking a snapshot and dumping the HTML file
 */
exports.reportIssue = function(page, params) {
    logger.debug("util.reportIssues");

    //Create root folder as required
    var sbRoot = './Snapshots';
    var fileHTML = sbRoot + "/" + moment().format("MMDDYY-HHmmss") + "-HTML" + ".html";
    var fileSnapshot = sbRoot + "/" + moment().format("MMDDYY-HHmmss") + "-snapshot" + ".png";

    if (!fs.existsSync(sbRoot)) {
        fs.mkdirSync(sbRoot);
    }

    page.render(fileSnapshot)
        .evalSync(function() {
            var doc = (window.document) ? document.body.outerHTML : 'No window.document';
            return JSON.stringify({document: doc});
        })
        .data(function(data) {
            fs.writeFile(fileHTML, data.document, function(err) {
                if(err) {
                    return logger.info("Error dumping HTML", err);
                }
            });
        })
        .checkState();
};

/*
 * Method to return the current URL.
 */
exports.getUrl = function (ASQ, params) {
    logger.debug("util.getUrl");

    //Return connect URL
    ASQ.then(function (done, context) {
        client.notification("util.getUrl")(
            {startUrl: config.startURL, currentUrl: browser.getUrl(), state: stateManager.getScreen()});
        done(context);
    });

};

/*
 * Method to take a snapshot of the current view of the screen and save the current URL to file.
 */
exports.supportBundle = function (ASQ, params) {
    logger.debug("util.supportBundle");

    ASQ.then(function (done, context) {
        //Create root folder as required
        var sbRoot = './SupportBundles';

        if (!fs.existsSync(sbRoot)) {
            fs.mkdirSync(sbRoot);
        }

        //Create new bundle folder
        var sbId = Math.floor(Math.random() * 90000) + 10000;
        var sbDir = './SupportBundles/' + sbId;

        if (!fs.existsSync(sbDir)) {
            fs.mkdirSync(sbDir);
        }

        //Save snapshot
        var filename = sbDir + "/snapshot-" + moment().format("MMDDYY-HHmmss") + ".png";
        context.page.render(filename);

        //Save state to file
        var urlfilename = sbDir + "/state-" + moment().format("MMDDYY-HHmmss") + ".txt";
        fs.writeFile(urlfilename,
            "Date and Time: " + moment().format("YYYY-MM-DD HH:mm:ss") + "\r\nStart URL: " + config.startURL + "\r\nCurrent URL: " + browser.getUrl() + "\r\nScreen: " + stateManager.getScreen(),
            function (err) {
                if (err) {
                    return logger.error(err);
                }
            });

        //Done
        client.notification("util.supportBundle")({bundleId: sbId});
        done(context);
    });
};

/*
 * Test method that fills in fields using the passed in field page model.
 */
exports.setData = function (ASQ, params) {
    ASQ.then(function (done, context) {
        stateManager.waitForPageMessage(context, "setDone").then(function() {
            done(context);
        });
        context.page.evaluate(function () {
            if (typeof params.descriptor == "string") {
                eval("params.descriptor = " + params.descriptor);
            }
            powwow.setData(params.descriptor, params.values).then(function() {
                powwow.sendPageMessage("setDone");
            });
        }, params, function () {
        });
    });
};

/*
 * Test method that fills in fields using the passed in field page model.
 */
exports.callAction = function (ASQ, params) {
    ASQ.then(function (done, context) {
        context.page.evaluate(function () {
            if (typeof params.descriptor == "string") {
                eval("params.descriptor = " + params.descriptor);
            }
            powwow.callAction(params.descriptor, params.action);
        }, function () {
            done(context);
        }, params);
    });
};

/*
 * Text method to extract data fields using the passed in field page model.
 */
exports.getData = function (ASQ, params) {
    ASQ.then(function (done, context) {
        context.page.evaluate(function (params) {
            if (typeof params == "string") {
                eval("var params = " + params);
            }
            var response = powwow.getData(params);
            return JSON.stringify(response);
        }, params, function (jsonResponse) {
            var response = JSON.parse(jsonResponse);
            client.notification("util.getData")(response);
            done(context);
        });
    });
};

/*
 * Changes the subscreen of the application.  Params are:
 * {
 *     screen: 'screen',
 *     subscreen: 'subscreen'
 * }
 */
exports.setSubScreen = function (ASQ, params) {
    logger.debug('util.setSubScreen');

    ASQ.then(function (done, context) {
        var error = stateManager.validateScreenName(params.screen, params.subscreen);
        if (error.length == 0 && stateManager.getScreen() !== params.screen) {
            error = "Unable to switch subscreens because current screen is \"" + stateManager.getScreen() + "\", not \"" + params.screen + "\".";
        }
        if (error.length > 0) {
            client.notification(stateManager.screens.ERROR)({
                error: error
            });
        } else {
            stateManager.setSubScreen(params.screen, params.subscreen);
            stateManager.setScreen(params.screen);
        }
        done(context, {
            success: true
        });
    });
};
