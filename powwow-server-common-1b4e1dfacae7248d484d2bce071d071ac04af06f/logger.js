'use strict';

// Dependencies:
var fs = require('fs');
var path = require('path');
var bunyan = require('bunyan');
var serverConfig = require('./serverConfig');

// package details:
var pkg = require.main.require('./package');

// Prepare output streams:
var streams = [];
streams.push({
    stream: process.stdout,
    level: serverConfig.logLevel
});

if (process.env.ENV !== 'development' && process.env.ENV !== 'mock') {
    if(serverConfig.logDir) {
        var logFile = path.join(serverConfig.logDir, pkg.name + '-log.log');
        var logErrorFile = path.join(serverConfig.logDir, pkg.name + '-errors.log');
        // Create log directory if it doesn't exist
        if (!fs.existsSync(serverConfig.logDir)) fs.mkdirSync(serverConfig.logDir);
        // additional output streams:
        streams.push({
            path: logFile,
            level: serverConfig.logLevel
        });
        streams.push({
            path: logErrorFile,
            level: 'error'
        });
    }
}

// initialize logger with configured streams:
var logger = bunyan.createLogger({
    name: pkg.name,
    streams: streams,
    serializers: bunyan.stdSerializers
});

logger.DEBUG = bunyan.DEBUG;
logger.INFO = bunyan.INFO;
logger.ERROR = bunyan.ERROR;
logger.FATAL = bunyan.FATAL;

logger.info('Starting ' + pkg.name + ', version ' + pkg.version);

module.exports = logger;
