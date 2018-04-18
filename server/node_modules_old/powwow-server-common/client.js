'use strict';

/**
 * Dependencies.
 */
var logger = require('./logger');
var Promise = require('promise');
var stateManager = require('./stateManager');
/**
 * Current JSON-RPC request ID.
 */
var requestId = 0;

/**
 * Object with pending requests.
 */
var pending = {};

/**
 * Current connection
 */
var connection;

/**
 * New connection
 */
exports.onconnection = function(conn) {
    connection = conn;
};

/**
 * Connection closed
 */
exports.onconnectionclose = function(conn) {
    if (conn === connection) {
        connection = null;
    }
};

/**
 * Handle WS message with JSON-RPC response.
 */
exports.onresponse = function (context, response) {
    logger.debug({response: response}, "Handle response");

    // handle response:
    if (pending[response.id]) {
        if (response.error) {
            // RPC error:
            pending[response.id].reject(response.error);
        } else if (response.result.success === false) {
            // failed result:
            pending[response.id].reject(response.result.reason);
        } else {
            // successful result:
            pending[response.id].resolve(response.result);
        }
        delete pending[response.id];
    }
};

/**
 * Returns a function that can be used to invoke remote method.
 */
exports.method = function (name) {
    return function (params) {
        // returns promise-like object:
        return new Promise(function (resolve, reject) {
            if (!connection) {
                return;
            }

            // send JSON-RPC message:
            connection.send(JSON.stringify({
                jsonrpc: '2.0',
                method: name,
                params: params,
                id: requestId
            }));
            pending[requestId] = {resolve: resolve, reject: reject};
            requestId++;
        });
    };
};

/**
 * Returns a function that can be used to send RPC notification (request without response).
 */
exports.notification = function (name) {
    // returns promise-like object:
    return function (params) {
        if (!connection) {
            return;
        }

        // send JSON-RPC message:
        connection.send(JSON.stringify({
            jsonrpc: '2.0',
            method: name,
            params: params
        }));
        stateManager.endRequest();
        logger.info('==> ' + name + " " + JSON.stringify(params).substring(0, 80));
    };
};

exports.initialize = exports.notification('ui.initialize');
exports.showMessage = exports.notification('ui.showMessage');
exports.setScreen = function(screen) { return exports.notification('setState.' + screen); };
exports.showLoading = exports.notification('ui.showLoading');
