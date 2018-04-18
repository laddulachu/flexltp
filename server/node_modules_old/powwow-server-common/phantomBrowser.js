'use strict';

/**
 * Dependencies.
 */

var phantom = require('./bridge/node-phantom-simple');
var logger = require('./logger');
var pageService = require('./pageService');
var config = require.main.require('./config');
var http = require('http');
var fs = require('fs');

var phantomBrowser;
var mainPage = null;
var tempLocalStorageFolder = null;

if (config.phantomVisual) {
    var pv = config.phantomVisual;
    logger.debug('Send screenshots to the "' + pv.host + ':' + pv.port + '" with ' + pv.interval + 'ms inverval');
    setInterval(function () {
        if (!mainPage) {
            return false;
        }
        mainPage.renderBase64('PNG', function (err, base64) {
            try {
                var req = http.request({ method: 'POST', host: pv.host, port: pv.port });
                req.on('error', function (err) {
                    //logger.debug("Error sending screen data to phantom visual.");
                });
                req.write(base64);
                req.end();
            } catch (e) {
                //logger.debug("Error sending screen data to phantom visual.");
            }
        });
    }, pv.interval);
}

exports.getBrowser = function () {
    return phantomBrowser;
};

exports.getMainPage = function () {
    return mainPage;
};

exports.setMainPage = function (page) {
    mainPage = page;
};

exports.createBrowserInstanceAndNewPage = function (proxyInfo, callback) {
    var parameters = {
        'ignore-ssl-errors': 'true',
        'web-security': 'false',
        'load-images': 'true' // This causes a memory leak when there are popups, so not allowing this to be set for now.
    };

    // Set up remote debugging.
    if (config.remoteDebug && config.remoteDebug.enabled) {
        parameters['debug'] = config.remoteDebug.phantomRequestResponse ? 'true' : 'false';
        parameters['remote-debugger-port'] = '' + config.remoteDebug.port; // This should be a string.
        parameters['remote-debugger-autorun'] = 'yes';
    }

    // Isolate localStorage for this instance of Phantom JS.
    if(!config.localStorageIsolationOff) {
        var basePath = config.localStoragePath ? (config.localStoragePath + "/") : ".localStorage/";

        if (process.argv.length > 2) {
            tempLocalStorageFolder = basePath + process.argv[2];
        } else {
            var randomDir = Math.floor((Math.random()*1000000)) + "";
            tempLocalStorageFolder = basePath + randomDir;
        }
        logger.info("Setting local storage folder:", tempLocalStorageFolder);
        parameters['local-storage-path'] = tempLocalStorageFolder;
    }

    var createOptions = { parameters: parameters };
    // Set up optional passed in environment variables for Phantom JS.
    if (config.env) {
        createOptions.env = config.env;
    }

    // Create browser instance:
    phantom.create(createOptions, function (err, browser) {
        if (err) {
            logger.info("Error creating phantom instance", err);
            return;
        }

        phantomBrowser = browser;

        logger.info("Config file:", JSON.stringify(config));

        if (proxyInfo.host) {
            logger.info("Proxy:", JSON.stringify(proxyInfo));
            phantomBrowser.setProxy(proxyInfo.host, proxyInfo.port, proxyInfo.proxyType, proxyInfo.user, proxyInfo.password);
        }

        // Now create and load the main page.
        pageService.createPhantomPage(browser, function (page) {
            callback(page);
            logger.info('Opening URL', config.startURL);
            page.open(config.startURL, function (status) {
                logger.info('Web-page status is', status);
                if (status === 'success') {
                    logger.info('Web-page is ready.');
                    page.events.emit('onReady');
                }
            });
        });
    });
};

exports.close = function () {
    logger.info("Closing browser");
    if (phantomBrowser) {
        phantomBrowser.exit();
    }
    if(tempLocalStorageFolder) {
        try {
            // Clearing local storage folder.
            logger.info("Clearing local storage folder:", tempLocalStorageFolder);
            deleteFolderRecursive(localStoragePath);
        } catch(e) {}
    }
    process.exit();
};

exports.clearCookies = function (callback) {
    phantomBrowser.clearCookies();
};

function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};