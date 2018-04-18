'use strict';

// dependencies:
var WebSocketServer = require('websocket').server;
var http = require('http');
var request = require('request');
var serverConfig = require('./serverConfig');
var config = require.main.require('./config');
var logger = require('./logger');
var onConnection = require('./handler');
var stateManager = require('./stateManager');

module.exports = function() {

    // initialize HTTP server:
    var httpServer = http.createServer(function (request, response) {
        logger.debug('Received request for:' + request.url);
        response.writeHead(404, {'Access-Control-Allow-Origin': '*'});
        response.end();
    });
    
    httpServer.listen(serverConfig.port, function () {
        logger.info('Server is listening on port ' + httpServer.address().port);
    });
    
    // initialize WS server:
    var wsServer = new WebSocketServer({
        httpServer: httpServer,
        autoAcceptConnections: true,
        maxReceivedFrameSize: 0x100000,
        maxReceivedMessageSize: 0x1000000,
        keepalive: config.gatlingLoadTest ? false : true
    });
    
    wsServer.on('connect', onConnection);
    
    process.once('SIGUSR2', function () {
        logger.info("Received shutdown signal from nodemon.");
        wsServer.shutDown();
        httpServer.close();
        process.kill(process.pid, 'SIGUSR2');
    });
    
    process.once('SIGINT', function () {
        logger.info("Received Control+C interrupt, shutting down.");
        wsServer.shutDown();
        httpServer.close();
        process.exit();
    });
    
    process.once('SIGTERM', function () {
        logger.info("Shutting down due to SIGTERM.");
        wsServer.shutDown();
        httpServer.close();
        process.exit();
    });

    // If launched by appserver, we'll have a sessionId passed in.  Register with the appServer.
    if (process.argv.length > 2) {
        var sessionId = process.argv[2];
        var protocol = config.appServerProtocol || "http";
        var hostname = config.appServerHost || "localhost";
        var url = protocol + '://' + hostname + ':' + config.appServerPort + '/sessions/' + sessionId +
            '/register?proxyPath=' + encodeURIComponent('ws://localhost:' + httpServer.address().port) +
            '&webSocket=true';
        request.get({url: url, rejectUnauthorized: config.hasOwnProperty('appServerRejectUnauthorized') ? config.appServerRejectUnauthorized : false}, function (error, response) {
            if (error) {
                logger.error({reqErr: error}, 'Error registering, exiting...');
                process.exit();
            } else if (response.statusCode != 200) {
                logger.error('Error ' + response.statusCode + ' registration failed, exiting...');
                process.exit();
            } else {
                logger.info('Registered with AppServer', url);
                stateManager.exitIfNoConnection();
            }
        });
    }

};
