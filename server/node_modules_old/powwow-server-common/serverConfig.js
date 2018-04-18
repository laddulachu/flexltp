'use strict';

var path = require('path');

var serverConfig = {
    port: 0, // Port to start server on.  If 0, port is randomly assigned.
    logDir: null, // Log directory.  If null, logger output goes to stdout
    logLevel: 'info' // Log level
};

if (process.argv.length > 2) {
    serverConfig.port = 0;
    serverConfig.logDir = process.env.AppData ? path.join(process.env.AppData, 'powwow-logs') : null;
    serverConfig.logLevel = 'info';
} else {
    serverConfig.port = 3000;
    serverConfig.logDir = null;
    serverConfig.logLevel = 'debug';
}

module.exports = serverConfig;
