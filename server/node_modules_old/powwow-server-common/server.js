'use strict';

var ASQ = require('asynquence');

var api =  require.main.require('./api');

var config =  require.main.require('./config');

var logger = require('./logger');
var stateManager = require('./stateManager');
var errors = require('./errors');
var client = require('./client');
var Page = require('./page');
var Promise = require('promise');

require('./asynquence-abort');

exports.onconnection = stateManager.onconnection;
exports.onconnectionclose = stateManager.onconnectionclose;

exports.onrequest = function(connection, request) {

    var logParams = request.params;
    if(config.log.logFilters) {
        var paramsToFilter = config.log.logFilters[request.method];
        if (paramsToFilter) {
            logParams = {};
            for (var prop in request.params) {
                if(paramsToFilter.indexOf(prop) == -1) {
                    logParams[prop] = request.params[prop];
                }
            }
        }
    }

    logger.info("<== " + request.method, {
        params : logParams
    });

    if(request.method == ".initialize") {
        if(config.initialize) {
            // Special method to call initialization method on the config object.
            var initializeMethodReturn = config.initialize.call(config, request.params);
            if(config.initializeReturnsPromise) {
                logger.info("Initialize method returned a promise");
                initializeMethodReturn.then(function(val) {
                    stateManager.initializeConnection(val);
                }, function(err) {
                    stateManager.setScreen("error", err);
                });
            } else {
               logger.info("Initialize method returns immediately");
               stateManager.initializeConnection(initializeMethodReturn); 
            }
        } else {
            logger.debug("Config.js doesn't have an initialize method");
        }
        return;
    }

    var context = {
        connection : connection,
        request : request
    };
    var seq;

    seq = ASQ(context).then(stateManager.prepareContext).then(function(done, context) {
        var page = Page(context);
        dispatchMessage(page, context);
        done();
        });
};

var dispatchMessage = function(page, context) {
    var namespace = context.request.method.split('.')[0];
    var action = context.request.method.split('.')[1];
    if ( typeof api[namespace] === 'object' && typeof api[namespace][action] === 'function') {
        try {
            stateManager.startRequest();
            api[namespace][action].call(api[namespace], page, context.request.params);
        } catch (e) {
            client.notification('error')({
                error : e.message
            });
            logger.error(e.message);
        }

    } else {
        var msg = 'The method does not exist: ' + namespace + "." + action;
        client.notification('error')({
            error : msg
        });
        logger.error(msg);
    }
};

var sendResponse = function(context, result) {
    // no response to a notification
    if (context.request && context.request.type == 'notification') {
        logger.debug({
            result : result
        }, "Unsent response to notification");
        return;
    }

    result.jsonrpc = '2.0';

    if (context.request) {
        result.id = context.request.id;
    }

    logger.debug({
        response : result
    }, "Send response");
    context.connection.send(JSON.stringify(result));
};
