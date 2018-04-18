'use strict';

var config = require.main.require('./config');

var logger = require('./logger');
var client = require('./client');
var browser = require('./phantomBrowser');
var ASQ = require('asynquence');
var path = require('path');
var fs = require('fs');
var Promise = require('promise');
var pageFactory = require('./page');
var _ = require('underscore');
var pageService = require('./pageService');
var app = require('./app');
/*************************** Module private variables ***************************/

/* Timer started when the Websocket is disconnected.  Session is kept alive for "config.lifetime" ms, then
 * closed if there isn't a reconnect before this timer expires.
 */
var teardownTimeout = null;

/* Timer started when an onLoadFinished event returns with a "fail" status. If there are no subsequent onLoadFinished
 * events with "success" within "config.loadFailTimeout" ms, then we go to the "siteDown" state.
 */
var loadFailTimer = 0;

/* List of registered state processors */
var loadFinishedProcessors = [];
var loadFinishedAndResourceLoadedProcessors = [];
var continousResourceLoadProcessorsMap = {};

/* List of registered resource load processors */
var resourceLoadProcessors = [];

/* List of registered resource request processors */
var resourceRequestProcessors = [];

/* List of registered navigation request processors */
var navigationRequestProcessors = [];

/* Page Closing processors */
var pageClosingProcessors = [];

/* Page Closing processors */
var pageCreatedProcessor = null;

/* List of registered state processors */
var loadFailedProcessors = [];

var parentPages = [];

/* Keeps current screen model.  Contains name and params of the current screen + a subscreens map.  This map maps from
 * a screen name to that screen's subscreen.  This makes it possible to set a subscreen for a screen that we haven't gone
 * to yet.
 */
var currentScreen = {
    name: null,
    params: null,
    subscreens: {}
};

var MATCHTYPE = {
    NONE: 0,
    PARTIAL: 1,
    MATCH: 2
};

/*************************** Methods ***************************/

exports.MATCHTYPE = MATCHTYPE;
exports.ASQ = ASQ;

exports.exitIfNoConnection = function() {
    teardownTimeout = setTimeout(function() {
        logger.info('Didn\'t receive a first connect in time, exiting...');
        if (browser) {
            browser.close();
        }
        teardownTimeout = null;
        process.exit();
    }, config.firstConnectTimeout || config.lifetime);
};

/* Keep track of wether the client is waiting for a response or not.*/
var requestInProgress = false;

exports.startRequest = function() {
    requestInProgress = true;
};

exports.endRequest = function() {
    requestInProgress = false;
};

exports.isRequestInProgress = function() {
    return requestInProgress;
};

/* Server screen and subscreen management methods */

exports.setScreen = function(screen, params, partialUpdateFields) {
    exports.endRequest();
    currentScreen.name = screen;

    if (params) {
        currentScreen.params = params;
    }

    if (currentScreen.params) {
        if (currentScreen.subscreens[currentScreen.name] && currentScreen.subscreens[currentScreen.name].name) {
            currentScreen.params.clientsubscreen = currentScreen.subscreens[currentScreen.name].name;
            currentScreen.params.subParams = currentScreen.subscreens[currentScreen.name].params;
        }
    }

    if (partialUpdateFields) {
        var arrFields;
        if(currentScreen.params.hasOwnProperty('clientsubscreen')) {
            arrFields = ["clientsubscreen"].concat(partialUpdateFields);
        } else {
            arrFields = partialUpdateFields;
        }
        var partialObject = createDiffObject(currentScreen.params, arrFields);
        client.setScreen(currentScreen.name)(partialObject);
    } else {
        delete currentScreen.params['$$partialFields'];
        client.setScreen(currentScreen.name)(currentScreen.params);
    }

};

exports.getCurrentScreen = function() {
    return currentScreen;
};

exports.getScreen = function() {
    return currentScreen.name;
};

exports.setSubScreen = function(screen, subscreen, subScreenParams) {
    if (!currentScreen.subscreens[screen]) {
        currentScreen.subscreens[screen] = {};
    }
    currentScreen.subscreens[screen].name = subscreen;
    currentScreen.subscreens[screen].params = subScreenParams;
};

exports.getSubScreen = function(screen) {
    return currentScreen.subscreens[screen] && currentScreen.subscreens[screen].name;
};

var proxyInfo = {
    host: '',
    port: '',
    proxyType: '',
    user: '',
    password: ''
};

if (config.proxy && config.proxy.host) {
    proxyInfo = config.proxy;
} else {
    proxyInfo = {
        host: '',
        port: '',
        proxyType: '',
        user: '',
        password: ''
    };
}

exports.setProxy = function(host, port, proxyType, user, password) {
    proxyInfo.host = host;
    proxyInfo.port = port;
    proxyInfo.proxyType = proxyType;
    proxyInfo.user = user;
    proxyInfo.password = password;

    var phantomBrowser = browser.getBrowser();
    if (phantomBrowser) {
        phantomBrowser.setProxy(proxyInfo.host,
            proxyInfo.port,
            proxyInfo.proxyType,
            proxyInfo.user,
            proxyInfo.password);
    }
};

/* WebSocket connect/disconnect methods */

exports.onconnection = function(connection) {
    logger.info('Client with address ' + connection.remoteAddress + ' connected.');
    if (teardownTimeout) {
        clearTimeout(teardownTimeout);
        teardownTimeout = null;
    }
};

exports.initializeConnection = function() {
    if (currentScreen.name) {
        logger.info('Session reconnect before lifetime timeout expiration.');
        client.initialize(config.getInitializationData());
        delete currentScreen.params['$$partialFields'];
        client.setScreen(currentScreen.name)(currentScreen.params);
    } else {
        logger.info('Creating a new session.');
        browser.createBrowserInstanceAndNewPage(proxyInfo, exports.connectToPage);
        app.register();
    }
};

exports.connectToNewPopup = function(page) {
    logger.info('Connection to a new page.');

    var parentPage = browser.getMainPage();
    if(parentPage) {
        parentPages.unshift(parentPage);
    }
    exports.connectToPage(page);
};

exports.connectToPage = function(page) {
    browser.setMainPage(page);
    page.events.on('onReady', exports.onReady);
    page.events.on('onLoadFinished', exports.onLoadFinished);
    page.events.on('onResourceReceived', exports.onResourceReceived);
    page.events.on('onResourceRequested', exports.onResourceRequested);
    page.events.on('onNavigationRequested', exports.onNavigationRequested);
    page.events.on('onPageClosing', exports.onPageClosing);
    page.events.on('onPageCreated', exports.onPageCreated);
};

exports.switchToPreviousPage = function() {
    if(parentPages.length > 0) {
        var parentPage = parentPages.shift();
        browser.setMainPage(parentPage);
        return parentPage;
    } else {
        logger.error("No previous page to switch to");
        return null;
    }
};

exports.onconnectionclose = function() {
    logger.info('Session will end in ' + config.lifetime / 1000 + 's if there is no reconnect.');
    teardownTimeout = setTimeout(function() {
        browser.close();
        currentScreen.name = null;
        currentScreen.params = null;
        currentScreen.subscreens = {};
        teardownTimeout = null;
        if (!config.keepSessionAliveOnTimeout) {
            process.exit();
        }
    }, config.lifetime);
};

/*
 * Inject helper Javascript into the loaded page.
 */
exports.prepareContext = function(done, context, request) {
    try {
        var page = (context && context.pageInfo && context.pageInfo.page) ? context.pageInfo.page : browser.getMainPage();
        if (page) {
            context.page = page;
            exports.injectJS(done, context, request, context.page);
        }
    } catch(e) {
        logger.info("Exception in prepareContext", e);
        done(context);
    }
};

exports.injectJS = function(done, context, request, page) {
    var arrInjectFiles = [];

    function injectNextJSFile(err) {
        if(err) {
            logger.info("Injection error injecting file:", err);
            done(context, request);
            return;
        }
        if (arrInjectFiles.length > 0) {
            var nextEntry = arrInjectFiles.shift();
            if(nextEntry.type) {
                if (nextEntry.type.indexOf('descriptors') >= 0) {
                    nextEntry.source = 'exports = ' + nextEntry.source;
                }

                if(nextEntry.type == "descriptors/state") {
                    nextEntry.type = "stateDescriptors";
                }
            }

            page.evaluate(function(nextEntry) {
                try {
                    eval(nextEntry.source);
                    if (nextEntry.type && window.powwow && window.powwow[nextEntry.type]) {
                        if(nextEntry.type == "stateDescriptors") {
                            exports.id = nextEntry.id;
                            window.powwow[nextEntry.type].push(exports);
                        } else {
                            window.powwow[nextEntry.type][nextEntry.id] = exports;
                        }
                    }
                } catch(e) {
                    console.error("Error injecting:", nextEntry.id);
                }
            }, nextEntry, injectNextJSFile);
        } else {
            logger.debug("All files have been injected.");
            page.evaluate(function() {
                if(window.powwow) {
                    window.powwow.descriptors_loaded = true;
                }
            }, function(err) {
                if(err) {
                    logger.info("Injection error setting descriptors loaded flag:", err);
                    done(context, request);
                    return;
                }
                logger.debug("Injection complete");
                done(context, request);
            })
        }
    }

    function addFilesToInject(injectRootDir, subDirName, arrInjectFiles) {
        var injectIndexJsonPath = path.resolve(injectRootDir, subDirName, 'index.json');
        if (!fs.existsSync(injectIndexJsonPath)) {
            logger.error('Unable to find ' + subDirName + '/index.json.  Looking here: ', injectIndexJsonPath);
            process.exit();
        }
        var filesList;
        try {
            filesList = JSON.parse(fs.readFileSync(injectIndexJsonPath));
        } catch (e) {
            logger.error('Parse error in ' + subDirName + '/index.json file', e.message);
            process.exit();
        }

        _.each(filesList, function(fileName) {
            var id = fileName.replace(/(\.js|\.json)$/, '');
            var filePath = path.resolve(injectRootDir, subDirName, fileName);
            if (!fs.existsSync(filePath)) {
                logger.error('Invalid entry in' + subDirName + '/index.json. Unable to find: ', filePath);
                process.exit();
            }
            var fileData = fs.readFileSync(filePath).toString();
            arrInjectFiles.push({source: fileData, type: subDirName, id: id});
        });
    }

    page.evaluate(function() {
        return (window.powwow && window.powwow.descriptors && window.powwow.descriptors_loaded) ? false: true;
    }, function(err, needsInjection) {
        if(needsInjection) {
            // inject env:
            page.evaluate(function(env) {
                window.powwow = window.powwow || {};
                window.powwow.ENV = env;
                window.powwow.extract = {};
                window.powwow.find = {};
                window.powwow.mutationTest = {};
                window.powwow.descriptors = {};
                window.powwow.stateDescriptors = [];
            }, process.env.ENV, function(err) {
                if(err) {
                    logger.info("Injection error initializing powwow objects", err);
                    done(context, request);
                    return;
                }
                var appInjectFileRootDir = path.dirname(require.main.filename);
                appInjectFileRootDir = path.join(appInjectFileRootDir, 'inject');

                addFilesToInject(appInjectFileRootDir, 'override', arrInjectFiles);
                addFilesToInject(appInjectFileRootDir, 'extract', arrInjectFiles);
                addFilesToInject(appInjectFileRootDir, 'find', arrInjectFiles);
                addFilesToInject(appInjectFileRootDir, 'mutationTest', arrInjectFiles);
                addFilesToInject(appInjectFileRootDir, 'descriptors', arrInjectFiles);
                addFilesToInject(appInjectFileRootDir, 'descriptors/state', arrInjectFiles);

                arrInjectFiles.unshift({source: fs.readFileSync(__dirname + '/inject/common.js').toString()});
                arrInjectFiles.unshift({source: fs.readFileSync(__dirname + '/inject/promise.js').toString()});
                logger.info("Starting file injection");
                injectNextJSFile();
            });
        } else {
            logger.info("Injection skipped, already injected.");
            done(context, request);
        }
    });
};

/*
 * Register a state processor.
 */
exports.register = function(name, patterns, fn) {
    loadFinishedProcessors.push({
        name: name,
        patterns: patterns,
        fn: fn
    });
};

exports.registerByURLAndContent = function(name, patterns, fnContentCheck, fn) {
    loadFinishedProcessors.push({
        name: name,
        patterns: patterns,
        fn: fn,
        fnContentCheck: fnContentCheck
    });
};

exports.registerByURLAndResource = function(name, patterns, resourcePattern, fn) {
    loadFinishedProcessors.push({
        name: name,
        patterns: patterns,
        resourcePattern: resourcePattern,
        fn: fn
    });
};

exports.registerResourceLoad = function(screen, resourcePattern, fn) {
    continousResourceLoadProcessorsMap[screen + resourcePattern.toString()] = {
        screen: screen,
        resourcePattern: resourcePattern,
        fn: fn
    };
};

exports.waitForResourceLoadOnce = function(testPattern, callback, timeout) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: true
    };
    resourceLoadProcessors.push(procObj);
    if (timeout) {
        procObj.timer = setTimeout(function() {
            for (var i = 0; i < resourceLoadProcessors.length; i++) {
                if (resourceLoadProcessors[i] === procObj) {
                    resourceLoadProcessors.splice(i, 1);
                    return procObj.callback();
                }
            }
        }, timeout);
    }
};

exports.waitForResourceLoad = function(testPattern, callback, timeout) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: false,
        timeout: timeout
    };
    resourceLoadProcessors.push(procObj);
    if (timeout) {
        procObj.timer = setTimeout(function() {
            for (var i = 0; i < resourceLoadProcessors.length; i++) {
                if (resourceLoadProcessors[i] === procObj) {
                    resourceLoadProcessors.splice(i, 1);
                    return procObj.callback();
                }
            }
        }, timeout);
    }
};

exports.waitForResourceRequestOnce = function(testPattern, callback, timeout) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: true
    };
    resourceRequestProcessors.push(procObj);
    if (timeout) {
        procObj.timer = setTimeout(function() {
            for (var i = 0; i < resourceRequestProcessors.length; i++) {
                if (resourceRequestProcessors[i] === procObj) {
                    resourceRequestProcessors.splice(i, 1);
                    return procObj.callback();
                }
            }
        }, timeout);
    }
};

exports.waitForResourceRequest = function(testPattern, callback, timeout) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: false,
        timeout: timeout
    };
    resourceRequestProcessors.push(procObj);
    if (timeout) {
        procObj.timer = setTimeout(function() {
            for (var i = 0; i < resourceRequestProcessors.length; i++) {
                if (resourceRequestProcessors[i] === procObj) {
                    resourceRequestProcessors.splice(i, 1);
                    return procObj.callback();
                }
            }
        }, timeout);
    }
};

exports.waitForNavigateRequestOnce = function(testPattern, callback, timeout) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: true
    };
    navigationRequestProcessors.push(procObj);
    if (timeout) {
        procObj.timer = setTimeout(function() {
            for (var i = 0; i < navigationRequestProcessors.length; i++) {
                if (navigationRequestProcessors[i] === procObj) {
                    navigationRequestProcessors.splice(i, 1);
                    return procObj.callback();
                }
            }
        }, timeout);
    }
};

exports.waitForPageClosing = function(testPattern, callback, timeout) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: true
    };
    pageClosingProcessors.push(procObj);
    if (timeout) {
        procObj.timer = setTimeout(function() {
            for (var i = 0; i < pageClosingProcessors.length; i++) {
                if (pageClosingProcessors[i] === procObj) {
                    pageClosingProcessors.splice(i, 1);
                    return procObj.callback();
                }
            }
        }, timeout);
    }
};

exports.waitForPageCreated = function(callback) {
    pageCreatedProcessor = callback;
};

exports.waitForLoadFailure = function(testPattern, callback) {
    var procObj = {
        testPattern: testPattern,
        callback: callback,
        unregisterOnMatch: true
    };
    loadFailedProcessors.push(procObj);
};

// Used to wait for events sent by powwow.sendPageMessage.
exports.waitForPageMessage = function(context, msgEvent, dataName) {
    return new Promise(function(resolve, reject) {
        context.page.events.onceIf('onCallback', function(msg) {
            if (msg && msg.event === msgEvent) {
                if (msg.data) {
                    if (dataName) {
                        context.dataMap[dataName] = msg.data;
                    } else {
                        context.dataMap = msg.data;
                    }
                }
                resolve(context);
                return true;
            }
        });
    });
};

// Used to wait for events sent by powwow.sendPageMessage.
exports.waitForPageMessageJSON = function(context, msgEvent, dataName) {
    return new Promise(function(resolve, reject) {
        var callbackFunc = function(msg) {
            if (msg && msg.event === msgEvent) {
                if (msg.data) {
                    var data = JSON.parse(msg.data);
                    if (dataName) {
                        context.dataMap[dataName] = data;
                    } else {
                        context.dataMap = data;
                    }
                }
                context.page.events.removeListener('onCallback', callbackFunc);
                resolve(context);
                return true;
            }
        };
        context.page.events.on('onCallback', callbackFunc);
    });
};

exports.waitForPageMessageWithoutDataMap = function(context, msgEvent) {
    return new Promise(function(resolve, reject) {
        context.page.events.onceIf('onCallback', function(msg) {
            if (msg && msg.event === msgEvent) {
                resolve(msg.data);
                return true;
            }
        });
    });
};

// Used to wait for events sent by powwow.sendPageMessage.
exports.waitForPageMessageContinuously = function(context, msgEvent, callback) {
    return new Promise(function(resolve, reject) {
        var callbackMethod = function(msg) {
            if(context.page !== browser.getMainPage()) {
                logger.info("Received a waitForPageMessageContinuously on a page that wasn't the main page. Ignoring it.")
                return;
            }
            if (msg && msg.event === msgEvent) {
                context.messageData = msg.data;
                callback(context);
            }
        };
        context.page.events.on('onCallback', callbackMethod);
    });
};

exports.stopWaitingForPageMessages = function(context) {
    context.page.events.stopOnceIf();
    context.page.events.removeAllListeners('onCallback');
};

exports.stopWaitingForResourceLoads = function() {
    resourceLoadProcessors = [];
};

exports.stopWaitingForResourceRequests = function() {
    resourceRequestProcessors = [];
};

exports.stopWaitingForNavigationRequests = function() {
    navigationRequestProcessors = [];
};

exports.stopWaitingForPageClose = function() {
    pageClosingProcessors = [];
};

exports.stopWaitingForPageCreate = function() {
    pageCreatedProcessor = null;
};

exports.stopWaitingForLoadFailure = function() {
    loadFailedProcessors = [];
};

// set up event listeners
exports.onReady = function() {
    if(!config.gatlingLoadTest) {
        client.initialize(config.getInitializationData());
    }
};

function testForStateMatchByContent(pageInfo, proc, page) {
    logger.debug("Begin test for state match by content function");

    ASQ({pageInfo: pageInfo}).then(exports.prepareContext).then(function(done, context) {
        try {
            var page = pageFactory(context);
            proc.fnContentCheck.call(page, page, done);
        } catch(e) {
            logger.info("Error in test for state match", e);
            done(context);
        }
    }).then(function(done, page) {
        if(page.matched) {
            logger.info('** ...STATE IS NOW: \'' + proc.name + '\'');
            if (typeof proc.fn === 'function') {
                proc.fn.call(page, page, done);
            }
        } else {
            logger.info("Partial MATCH ASYNC STATE '" + proc.name + "'");
        }
    });
}

exports.onLoadFinished = function(pageInfo) {

    if(pageInfo.page !== browser.getMainPage()) {
        logger.info("Received a load finished on a page that wasn't the main page. Ignoring it.")
        return;
    }

    (config.log && config.log.resourceLoads) &&
    logger.debug('onLoadFinished', browser.getMainPage().getUrl(), {url: pageInfo.url, status: pageInfo.status, method: pageInfo.method, frames: pageInfo.frames});
    if (pageInfo.status === 'fail' && (!pageInfo.method || pageInfo.method === 'GET')) {
        if(loadFailedProcessors.length > 0) {
            var url = browser.getMainPage().getUrl();
            for (var i = loadFailedProcessors.length - 1; i >= 0; i--) {
                if (matchUrl(loadFailedProcessors[i].testPattern, url)) {
                    var loadFailProc = loadFailedProcessors[i];
                    if (loadFailProc.timer) {
                        clearTimeout(loadFailProc.timer);
                    }
                    if (loadFailProc.unregisterOnMatch) {
                        // Remove from list.
                        loadFailedProcessors.splice(i, 1);
                    }
                    loadFailProc.callback(url);
                }
            }
        }
        else {
            loadFailTimer = setTimeout(function() {
                // Send failure message if we don't get another success within the loadFailTimeout time.
                client.setScreen("error")({
                    message: 'Unable to access ' + config.startURL
                });
            }, config.loadFailTimeout);
        }
        return;
    } else {
        if (loadFailTimer) {
            clearTimeout(loadFailTimer);
        }
    }

    function createResourceLoadCallback(proc) {
        return function() {
            logger.info('** STATE IS NOW: \'' + proc.name + '\'');

            if (typeof proc.fn === 'function') {
                logger.debug("Function match in onLoadFinished after resource load.");
                ASQ({pageInfo: pageInfo}).then(exports.prepareContext).then(function(done, context) {
                    try {
                        var page = pageFactory(context);
                        proc.fn.call(page, page, done);
                    } catch(e) {
                        logger.info("Error running page function", e);
                    }
                });
            } else {
                logger.info("fn is not a function.");
            }
        };
    }

    var noMatch = true;
    loadFinishedAndResourceLoadedProcessors = [];
    for (var i = 0; i < loadFinishedProcessors.length; i++) {
        var proc = loadFinishedProcessors[i];

        var matchResult = matchUrl(proc.patterns, pageInfo.url, pageInfo.frames, pageInfo.method);
        if (matchResult === MATCHTYPE.MATCH) {
            if (proc.resourcePattern) {
                loadFinishedAndResourceLoadedProcessors.push({
                    testPattern: proc.resourcePattern,
                    callback: createResourceLoadCallback(proc),
                    unregisterOnMatch: true
                });
            }
            else if (proc.fnContentCheck && typeof proc.fnContentCheck === 'function') {
                noMatch = false;
                testForStateMatchByContent(pageInfo, proc);
            } else {
                logger.info('** STATE IS NOW: \'' + loadFinishedProcessors[i].name + '\'');

                if (typeof loadFinishedProcessors[i].fn === 'function') {
                    ASQ({pageInfo: pageInfo}).then(exports.prepareContext).then(function(done, context) {
                        try {
                            var page = pageFactory(context);
                            loadFinishedProcessors[i].fn.call(page, page, done);
                        } catch(e) {
                            logger.info("Error running page function", e);
                        }
                    });
                } else {
                    logger.info("fn is not a function");
                }
                return;
            }
        } else if (matchResult === MATCHTYPE.PARTIAL) {
            // Partial match.
            noMatch = false;
        }

    }
    logger.info((noMatch ? 'UNMATCHED' : 'PARTIAL MATCH') + ' STATE:', pageInfo.url + ' - ' + JSON.stringify(pageInfo.frames, null, 2));
};

exports.onResourceReceived = function(response) {
    for(var entry in continousResourceLoadProcessorsMap) {
        var resourceProc = continousResourceLoadProcessorsMap[entry];
        if (matchUrl(resourceProc.resourcePattern, response.url)) {
            resourceProc.fn(response);
        }
    }

    for(var i=loadFinishedAndResourceLoadedProcessors.length -1; i >= 0; i--) {
        if (matchUrl(loadFinishedAndResourceLoadedProcessors[i].testPattern, response.url)) {
            var resourceProc = loadFinishedAndResourceLoadedProcessors[i];
            if (resourceProc.timer) {
                clearTimeout(resourceProc.timer);
            }
            if (resourceProc.unregisterOnMatch) {
                // Remove from list.
                loadFinishedAndResourceLoadedProcessors.splice(i, 1);
            }
            resourceProc.callback(response);
        }
    }

    for (var i = resourceLoadProcessors.length - 1; i >= 0; i--) {
        if (matchUrl(resourceLoadProcessors[i].testPattern, response.url)) {
            var resourceProc = resourceLoadProcessors[i];
            if (resourceProc.timer) {
                clearTimeout(resourceProc.timer);
            }
            if (resourceProc.unregisterOnMatch) {
                // Remove from list.
                resourceLoadProcessors.splice(i, 1);
            }
            resourceProc.callback(response);
        }
    }
};

exports.onResourceRequested = function(requestData) {
    for (var i = resourceRequestProcessors.length - 1; i >= 0; i--) {

        if (matchUrl(resourceRequestProcessors[i].testPattern, requestData.url)) {
            var resourceProc = resourceRequestProcessors[i];
            if (resourceProc.timer) {
                clearTimeout(resourceProc.timer);
            }
            if (resourceProc.unregisterOnMatch) {
                // Remove from list.
                resourceRequestProcessors.splice(i, 1);
            }
            resourceProc.callback(requestData);
        }
    }
};

exports.onNavigationRequested = function(url, type, willNavigate, main) {
    for (var i = navigationRequestProcessors.length - 1; i >= 0; i--) {

        if (matchUrl(navigationRequestProcessors[i].testPattern, url)) {
            var navigationProc = navigationRequestProcessors[i];
            if (navigationProc.timer) {
                clearTimeout(navigationProc.timer);
            }
            if (navigationProc.unregisterOnMatch) {
                // Remove from list.
                navigationRequestProcessors.splice(i, 1);
            }
            navigationProc.callback(url, type, willNavigate, main);
        }
    }
};

exports.onPageClosing = function(url) {
    for (var i = pageClosingProcessors.length - 1; i >= 0; i--) {

        if (matchUrl(pageClosingProcessors[i].testPattern, url)) {
            var pageCloseProc = pageClosingProcessors[i];
            if (pageCloseProc.timer) {
                clearTimeout(pageCloseProc.timer);
            }
            if (pageCloseProc.unregisterOnMatch) {
                // Remove from list.
                pageClosingProcessors.splice(i, 1);
            }
            pageCloseProc.callback(url);
        }
    }
}

exports.onPageCreated = function(newPage) {
    if(pageCreatedProcessor) {
        pageService.setupPage(newPage, function(page) {
            logger.info("New page has been set up");
            pageCreatedProcessor(page);
        });
    }
}

exports.showLoading = function(message) {
    client.showLoading({message: message});
};

/*************************** Module private methods ***************************/

var matchUrl = function(patterns, url, frames, method) {
    if (Object.prototype.toString.call(patterns) !== '[object Array]') {
        patterns = [patterns];
    }

    for (var i = 0; i < patterns.length; i++) {
        var pattern = patterns[i];
        if (pattern instanceof RegExp && pattern.test(url)) {
            return MATCHTYPE.MATCH;
        } else if (typeof pattern === 'function') {
            return pattern.call(this, url, frames, method);
        } else if (pattern === url) {
            return MATCHTYPE.MATCH;
        }
    }

    return MATCHTYPE.NONE;
};

/*************************** Private methods for creating diff objects ***************************/

function findSubObjIndex(arr, indexToFind) {
    for(var i=0; i < arr.length; i++) {
        if(arr[i].$$i == indexToFind) {
            return i;
        }
    }
    return -1;
}

function parseObjectPath(objectPath) {
    var posFirstObj = objectPath.indexOf(".");
    var fieldPart;
    var remainingPath = "";
    if(posFirstObj == -1) {
        fieldPart = objectPath;
    } else {
        fieldPart = objectPath.substring(0, posFirstObj);
        remainingPath = objectPath.substring(posFirstObj+1);
    }
    
    var posArrayStart = fieldPart.indexOf("[");
    if(posArrayStart == -1) {
        // Not an array, we have fieldPart.
        return { field: fieldPart, isArray: false, remainingPath: remainingPath };
    } else {
        var fieldIndex;
        var posArrayEnd = fieldPart.indexOf("]", posArrayStart+1);
        if(posArrayEnd == -1) {
            throw("No end block in " + fieldPart + ".");
            // Throw an error, this is wrong!
        } else {
            var indexPart = fieldPart.substring(posArrayStart+1, posArrayEnd);
            fieldIndex = parseInt(indexPart);
            if(isNaN(fieldIndex)) {
                throw("Field index in " + fieldPart + " is not a number.");
            }
        }
        fieldPart = fieldPart.substring(0, posArrayStart);
        // Now we have fieldPart and fieldIndex.
        return { field: fieldPart, isArray: true, index: fieldIndex, remainingPath: remainingPath };
    }
}

function _createDiffSubObject(obj, newObj, partialField, newObjField, arrUpdateFields) {
    var fo = parseObjectPath(partialField);
    var isLastObject = fo.remainingPath.length == 0;
    if(fo.isArray) {
        if(!newObj.hasOwnProperty(fo.field)) {
            newObj[fo.field] = [];
        }

        var subObjIndex = findSubObjIndex(newObj[fo.field], fo.index);
        var newSubObj;
        if(isLastObject) {
            newSubObj = JSON.parse(JSON.stringify(obj[fo.field][fo.index]));
            newSubObj.$$i = fo.index;

            if(subObjIndex == -1) {
                subObjIndex = newObj[fo.field].push(newSubObj) - 1;
            } else {
                newObj[fo.field][subObjIndex] = newSubObj;
            }
            arrUpdateFields.push((newObjField.length > 0 ? (newObjField + ".") : "") + fo.field + "[" + subObjIndex + "]");
            
        } else {
            // Deal with case of partial fields being "item[2].a", "item[2].b"
            if(subObjIndex == -1) {
                newSubObj = { $$i: fo.index };
                subObjIndex = newObj[fo.field].push(newSubObj) - 1;
            } else {
                newSubObj = newObj[fo.field][subObjIndex];
            }

            _createDiffSubObject(obj[fo.field][fo.index], newSubObj, fo.remainingPath, (newObjField.length > 0 ? (newObjField + ".") : "") + fo.field + "[" + subObjIndex + "]", arrUpdateFields);
        }

    } else {
        if(isLastObject) {
            arrUpdateFields.push((newObjField.length > 0 ? (newObjField + ".") : "") + fo.field);
            if(obj.hasOwnProperty(fo.field) && obj[fo.field] !== undefined) {
                newObj[fo.field] = JSON.parse(JSON.stringify(obj[fo.field]));
            } else {
                newObj[fo.field] = null;
            }
        } else {
            if(!newObj.hasOwnProperty(fo.field)) {
                newObj[fo.field] = {};
            }
            _createDiffSubObject(obj[fo.field], newObj[fo.field], fo.remainingPath, (newObjField.length > 0 ? (newObjField + ".") : "") + fo.field, arrUpdateFields);
        }
    }
}

function createDiffObject(obj, partialFieldsArray) {
    var newObj = {};
    var updateFields = [];
    for(var i = 0; i < partialFieldsArray.length; i++) {
        var partialField = partialFieldsArray[i];
        _createDiffSubObject(obj, newObj, partialField, "", updateFields);
    }
    newObj['$$partialFields'] = {
        full: partialFieldsArray,
        part: updateFields
    }
    return newObj;
}
