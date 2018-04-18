'use strict';

var EventEmitter = require('events').EventEmitter;
var config = require.main.require('./config');
var logger = require('./logger');

exports.setupPage = function(newPage, callback) {

    function setup(page) {
        page.events = new EventEmitter();
        page.onLoadFinishedDebounceTimer = null;
        page.mainPageFramesMap = {};
        page.lastResourceRequestInfo = {};

        page.getUrl = function() {
            return page.phantomUrl;
        };

        // prevent possible-eventemitter-memory-leak-detected exception
        page.events.setMaxListeners(0);

        page.eventListeners = [];

        // fire the event until it returns true
        page.events.onceIf = function(event, cb) {
            var eventListenerObj = {
                event : event
            };
            var wrappedListener = function() {
                if (cb.apply(this, arguments)) {
                    for (var i = 0; i < page.eventListeners.length; i++) {
                        if (page.eventListeners[i] === eventListenerObj) {
                            page.eventListeners.splice(i, 1);
                            return;
                        }
                    }
                    page.events.removeListener(event, wrappedListener);
                }
            };
            eventListenerObj.listener = wrappedListener;
            page.events.on(event, wrappedListener);
            page.eventListeners.push(eventListenerObj);
        };

        page.events.stopOnceIf = function() {
            while (page.eventListeners.length > 0) {
                var eventListenerObj = page.eventListeners.shift();
                page.events.removeListener(eventListenerObj.event, eventListenerObj.listener);
            }
        };

        // includeJs but only call the callback once (not for every
        // subsequent
        // page load
        page.includeJsOnce = function(js, cb) {
            page.includeJs(js, function() {
                if (cb.called) {
                    return;
                }
                cb.called = true;
                cb.apply(this, arguments);
            });
        };

        function normalizeUrl(url) {
            var locationofhash = url.indexOf("#");
            if(locationofhash > 0) {
                url = url.substring(0, locationofhash);
            }
            return url;
        }

        page.onNavigationRequested = function(url, type, willNavigate, main) {
            if (main === true) {
                if(url.indexOf("#") >= 0) {
                    var normalizedUrl = normalizeUrl(url);
                    // If URL is in the map already...
                    if(page.mainPageFramesMap[normalizedUrl] && page.mainPageFramesMap[normalizedUrl].frames.length > 0) {
                        logger.info('RELOAD OF AN OLD URL:', url);
                        page.phantomUrl = normalizedUrl;
                        if (page.lastResourceRequestInfo && page.lastResourceRequestInfo.url == normalizedUrl) {
                            page.mainPageFramesMap[normalizedUrl].method = page.lastResourceRequestInfo.method;
                        }
                        return;
                    }
                }
                logger.info('window.url =', url);
                page.phantomUrl = url;
                page.mainPageFramesMap[url] = {
                    frames : []
                };
                if (page.lastResourceRequestInfo && page.lastResourceRequestInfo.url == url) {
                    page.mainPageFramesMap[url].method = page.lastResourceRequestInfo.method;
                }
            } else {
                logger.info('frame[].url =', url);
                var frames = page.mainPageFramesMap[page.getUrl()].frames;
                if(frames.length > 20) { // Keep up to 20 frames.
                    frames.splice(0, frames.length-20);
                }
                var addFrameToList = true;

                if(url.indexOf("#") >= 0) {
                    var normalizedUrl = normalizeUrl(url);
                    // Check if URL is already in list of frames, and if it is, don't add it.
                    for(var i=0; i < frames.length; i++) {
                        if(frames[i] === normalizedUrl) {
                            addFrameToList = false;
                            break;
                        }
                    }
                }
                if(addFrameToList) {
                    frames.push(url);
                }
            }
            page.events.emit('onNavigationRequested', url, type, willNavigate, main);
        };

        page.onClosing = function(closingPage) {
            logger.debug("Page closing:", closingPage.url);
            page.events.emit('onPageClosing', closingPage.url);
        };

        page.onLoadStarted = function() {
            logger.debug("Load started");
            page.events.emit('onLoadStarted');
        };

        // page.onInitialized = function() {
        //     logger.debug("onInitialized");
        //     page.events.emit('onInitialized');
        // };

        page.onPageCreated = function(newPage) {
            logger.debug("New page created");
            page.events.emit('onPageCreated', newPage);
        };

        page.onLoadFinished = function(status) {
            var objPage = page.mainPageFramesMap[page.getUrl()];
            var frames = objPage && objPage.frames;
            var method = objPage && objPage.method;

            // Call project specific on page load handler that can be used to do things like override page
            // specific JS.  This cannot be done effectively after a state is registered because there is a slight delay
            // after page load to handle cases where we get duplicate page load events because of iframes in a page.
            if(config.onPageLoad) {
                logger.debug("Calling config.onPageLoad for " + page.getUrl());
                config.onPageLoad(page, frames, method);
            }

            logger.info('Load ' + ((!frames || frames.length == 0) ? "(PAGE):" : "(FRAME):"), page.getUrl(), frames);
            if (frames && frames.length > 0 && frames[frames.length - 1] == "about:blank") {
                if (page.onLoadFinishedDebounceTimer) {
                    clearTimeout(page.onLoadFinishedDebounceTimer);
                    page.onLoadFinishedDebounceTimer = null;
                }
                page.onLoadFinishedDebounceTimer = setTimeout(function() {
                    page.onLoadFinishedDebounceTimer = null;
                    page.events.emit('onLoadFinished', {
                        url: page.getUrl(),
                        status : status,
                        frames : frames,
                        method : method,
                        page: page
                    });
                }, 200);
            } else {
                if (page.onLoadFinishedDebounceTimer) {
                    clearTimeout(page.onLoadFinishedDebounceTimer);
                    page.onLoadFinishedDebounceTimer = null;
                }
                page.events.emit('onLoadFinished', {
                    url: page.getUrl(),
                    status : status,
                    frames : frames,
                    method : method,
                    page: page
                });
            }
        };

        page.onUrlChanged = function(newUrl) {
            if(newUrl.indexOf("#") >= 0) {
                var normalizedUrl = normalizeUrl(newUrl);
                // If URL is in the map already...
                if(page.mainPageFramesMap[normalizedUrl] && page.mainPageFramesMap[normalizedUrl].frames.length > 0) {
                    logger.info('RELOAD OF AN OLD URL:', newUrl);
                    page.phantomUrl = normalizedUrl;
                    if (page.lastResourceRequestInfo && page.lastResourceRequestInfo.url == newUrl) {
                        page.mainPageFramesMap[newUrl].method = page.lastResourceRequestInfo.method;
                    }
                    page.events.emit('onUrlChanged', newUrl);
                    return;
                }
            }
            logger.info('NEW URL:', newUrl);
            page.phantomUrl = newUrl;
            // Clear the map of loaded pages.
            page.mainPageFramesMap[newUrl] = {
                frames : []
            };
            if (page.lastResourceRequestInfo && page.lastResourceRequestInfo.url == newUrl) {
                page.mainPageFramesMap[newUrl].method = page.lastResourceRequestInfo.method;
            }

            page.events.emit('onUrlChanged', newUrl);
        };

        page.onCallback = function(msg) {
            page.events.emit('onCallback', msg);
        };

        page.onResourceRequested = function(requestData, networkRequest) {
            /* logger.debug('***** Resource requested *****');
             logger.debug("URL:", requestData.url);
             logger.debug("Time:", requestData.time);
             logger.debug("Method:", requestData.method);
             logger.debug("ID:", requestData.id);

             logger.debug("****** HEADERS ******");
             for(var i=0; i < requestData.headers.length; i++) {
             logger.debug("Name=", requestData.headers[i].name, " Value=",
             requestData.headers[i].value);
             }
             */
            (config.log && config.log.resourceRequests) && logger.debug("onResourceRequested URL:", requestData.url);
            page.lastResourceRequestInfo.url = normalizeUrl(requestData.url);
            page.lastResourceRequestInfo.method = requestData.method;
            page.events.emit('onResourceRequested', requestData);
        };

        page.onResourceReceived = function(response) {
             /*logger.debug('***** Resource received *****');
             logger.debug("URL:", response.url);
             logger.debug("Time:", response.time);
             logger.debug("Status code:", response.status);
             logger.debug("Content Type:", response.contentType);
             logger.debug("Stage:", response.stage);
             logger.debug("ID:", response.id);
             logger.debug("BodySize:", response.bodySize);

             logger.debug("****** HEADERS ******");
             for(var i=0; i < response.headers.length; i++) {
             logger.debug("Name=", response.headers[i].name, " Value=",
             response.headers[i].value);
             }
             */
            if (response.stage == "end") {
                if (config.log && config.log.resourceLoads) {
                    if(response.url.substring(0, 5) == "data:") {
                        logger.info("Resource received: ", response.url.substring(0, 40) + "...");
                    } else {
                        logger.info("Resource received:", response.url);
                    }
                }
                page.events.emit('onResourceReceived', response);
            }
        };

        page.onConsoleMessage = function(message) {
            logger.info('@Console: ' + message);
        };

        // causes assertion errors
        page.onError = function(msg, trace) {
            logger.error("Javascript error:", {
                phantomError : msg,
                trace : trace
            });
        };

        page.get('settings.userAgent', function(err, userAgent) {
            if(config.userAgentReplacement) {
                userAgent = config.userAgentReplacement;
            } else if (config.userAgentSuffix) {
                userAgent = userAgent + " " + config.userAgentSuffix;
            }
            logger.info("User-Agent:", userAgent);
            page.set('settings.userAgent', userAgent, function() {
                var viewportSize = config.viewportSize;
                if(!viewportSize) {
                    viewportSize = {width:1024, height:768};
                }
                if(!viewportSize.width) { viewportSize.width = 1024; }
                if(!viewportSize.height) { viewportSize.height = 768; }
                page.set('viewportSize', viewportSize, function() {
                   callback.call(page, page);
                });
            });
        });

    }

    setup(newPage);
};

exports.createPhantomPage = function(browser, callback) {
    // create page instance:
    browser.createPage(function(err, page) {
        exports.setupPage(page, callback);
    });
};

exports.clearCookies = function(browser, callback) {
    browser.clearCookies(callback);
};

