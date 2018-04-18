'use strict';

var logger = require('./logger'),
    client = require('./client'),
    server = require('./server'),
    async = require('async');

var currentConnection;
var messageQueue;

var messageType = {
    REQUEST: "request",
    RESPONSE: "response",
    NOTIFICATION: "notification"
};

module.exports = function(connection) {
    // only allow one connection at a time
    if (currentConnection) {
        currentConnection.close(4005, "Already connected");
    }
    currentConnection = connection;

    client.onconnection(connection);
    server.onconnection(connection);

    // handle disconnection:
    connection.on('close', function () {
        logger.info('Client with address  ' + connection.remoteAddress + ' disconnected.');
        if (connection === currentConnection) {
            currentConnection = null;
        }

        server.onconnectionclose(connection);
        client.onconnectionclose(connection);
    });

    // handle message
    connection.on('message', function(message) {
        messageQueue.push({ connection: connection, message: message });
    });
};

var parseMessage = function(message) {
    if (message.type === 'utf8') {
        var parsed = JSON.parse(message.utf8Data);
        if (parsed.jsonrpc !== '2.0') {
            throw new Error('Invalid RPC version: ' + parsed.jsonrpc);
        }

        parsed.type = getType(parsed);
        if (parsed.type == null) {
            throw new Error('Unrecognized request or response');
        }

        return parsed;
    } else {
        throw new Error('Invalid string was received by the server');
    }
};

var getType = function(parsed) {
    if (typeof parsed.method != 'undefined') {
        // request or notification
        if (typeof parsed.id == 'string') {
            return messageType.REQUEST;
        } else {
            return messageType.NOTIFICATION;
        }
    } else if (typeof parsed.result != 'undefined') {
        return messageType.RESPONSE;
    } else {
        // unknown
        return null;
    }
};


var handleMessage = function(task, callback) {
    var connection = task.connection;
    var message = task.message;

    // create a sequence to send the response
    try {
        var request = parseMessage(message);
        switch (request.type) {
            case messageType.RESPONSE:
                client.onresponse(connection, request);
                break;
            case messageType.REQUEST:
            case messageType.NOTIFICATION:
                server.onrequest(connection, request);
                break;
        }
    } catch (ex) {
        // couldn't parse message
        logger.error(ex, "Error parsing message");
    }

    callback();
};

messageQueue = async.queue(handleMessage);
