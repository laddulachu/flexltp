var logger = require('./logger');
var stateManager = require('./stateManager');
var config = require.main.require('./config');

var previousState = null;

var checkStateInProgress = false, apiCallInProgress = false;
var EventEmitter = require('events').EventEmitter;
var mutationTimeout = null;
var loadTimeout = null;
var resourceLoadTimeout = null;

exports.events = new EventEmitter();

exports.register = function () {
    stateManager.register("app", /.*/, function (page, done) {
        if (loadTimeout) {
            clearTimeout(loadTimeout);
            loadTimeout = null;
        }
        loadTimeout = setTimeout(function () {
            logger.info("******************** PAGE LOADED!!!! **********************");

            // Set size of outerwindows to something reasonable to prevent runaway resizing.
            page.evalSync(function () {
                var arrFrames = powwow.getAllFrameWindows(window);
                for (var i = 0; i < arrFrames.length; i++) {
                    var w = arrFrames[i];
                    w.innerHeight = 768; // Magic number!!!
                    w.innerWidth = 1024; // Magic number!!!
                    if (w.contentDocument) {
                        w.contentDocument.body.clientWidth = 1024; // Magic number!!!
                        w.contentDocument.body.clientHeight = 768; // Magic number!!!
                    }
                }
            });
            if(config.stateDetection.domMutations.watch) {
                page.setMutationIgnoreList(config.stateDetection.domMutations.ignoreList
                    ).onGlobalMutation(function (data) {
                    if (mutationTimeout) {
                        clearTimeout(mutationTimeout);
                        mutationTimeout = null;
                    }
                    mutationTimeout = setTimeout(function () {
                        var subData = data.substring(300); // Magic number!!!
                        subData = subData.replace(/\s/g, " ");
                        logger.info("************ Mutation:", subData);
                        exports.checkState(page, data);
                    }, 100); // Magic number!!!
                }, true);
            }

            // Check state in case we had DOM mutations before mutation handler was set up.
            setTimeout(function () {
                if(config.stateDetection.resourceLoads.watch) {
                    stateManager.registerResourceLoad("app", /.*/, function (response) {
                        if(response.contentType) {
                            var checkStateOnResourceLoad = false;
                            for(var i = 0; i < config.stateDetection.resourceLoads.checkList.length; i++) {
                                if(response.contentType.indexOf(config.stateDetection.resourceLoads.checkList[i]) >= 0) {
                                    checkStateOnResourceLoad = true;
                                }
                            }
                            if(!checkStateOnResourceLoad) {
                                // Don't do a resource load check.
                                logger.info("Ignoring content type:", response.contentType);
                                return;
                            }

                            logger.info("********** RESOURCE LOADED!!!!!",response.contentType);
                            if (resourceLoadTimeout) {
                                clearTimeout(resourceLoadTimeout);
                                resourceLoadTimeout = null;
                            }
                            resourceLoadTimeout = setTimeout(function () {
                                try {
                                    exports.checkState(page);
                                } catch(e) {
                                    logger.error(e);
                                }
                            }, 200); // Magic number!!!
                        } else {
                            logger.info("Loaded resource without content type");
                        }
                    });
                }
                exports.checkState(page);
            }, 200); // Magic number!!!
        }, 500); // Magic number!!!
    });
};

function changeState(state, page, checkStateData) {
    var api = require.main.require('./api');

    logger.info("******* State:", state, "*******");
    var namespace = state.split('.')[0];
    var action = "on_" + state.split('.')[1];

    if (typeof api[namespace] === 'object' && typeof api[namespace][action] === 'function') {
        logger.info("Found ", namespace + "." + action);
        try {
            api[namespace][action].call(api[namespace], page);
        } catch (e) {
            logger.error(e.message);
        }
    } else {
        logger.info('This state method does not exist: ' + namespace + "." + action);
        if (checkStateData.descriptor && checkStateData.screens && checkStateData.screens.length > 0) {
            page.clearData()
                .extract(checkStateData.descriptor)
                .screen(checkStateData.screens[0]);
        }
    }
}
var nullStateTimeout = null;

function screenMatches(screenName, arrScreens) {
    for (var i = 0; i < arrScreens.length; i++) {
        if (screenName == arrScreens[i]) {
            return true;
        }
    }
    return false;
}

exports.checkState = function (page, data) {
    page.checkStateUsingDescriptor()
        .then(function (checkStateData) {
            try {
                var state = checkStateData.stateVariant;
                logger.info("State detected:", previousState, "->", state);

                if (!apiCallInProgress) {
                    if (previousState === state /* && !*/) {
                        if (checkStateData.descriptor && checkStateData.screens) {
                            if (screenMatches(stateManager.getScreen(), checkStateData.screens)) {
                                logger.info("Screen is same, checking if data has changed.");
                                // Check if actual state is the same.
                                var currentStateData = stateManager.getCurrentScreen().params;
                                page.extract(checkStateData.descriptor)
                                    .data(function (extractedData) {
                                        if (dataHasBeenUpdated(currentStateData, extractedData) || stateManager.isRequestInProgress()) {
                                            logger.info("Data has change, re-evaluating state");
                                            changeState(state, page, checkStateData);
                                        }
                                    });
                            }
                        }
                        return;
                    }
                    previousState = state;
                    page.clearData();

                    // If state is null, wait some time before changing to it...
                    if (nullStateTimeout) {
                        clearTimeout(nullStateTimeout);
                        nullStateTimeout = null;
                    }

                    if (state == "null.default") { // Magic state!!!
                        nullStateTimeout = setTimeout(function () {
                            changeState(state, page, checkStateData);
                        }, 2000); // Magic number!!!
                    } else {
                        changeState(state, page, checkStateData);
                    }
                } else {
                    logger.info("API call in progress, ignoring state change.");
                    exports.events.emit('newState', state, data);
                }
            }
            catch (e) {
                logger.error(e);
            }
        });
};

exports.startAPICall = function () {
    exports.events.removeAllListeners('newState');
    apiCallInProgress = true;
};

exports.endAPICall = function () {
    apiCallInProgress = false;
    exports.events.removeAllListeners('newState');
};

function isArray(item) {
    var type = toString.call(item);
    return (type.indexOf("Array]") >= 0 || type.indexOf("NodeList]") >= 0);
}

function isObject(item) {
    var type = toString.call(item);
    return type === "[object Object]";
}

function dataHasBeenUpdated(oldValue, newValue) {
    if (isArray(newValue)) {
        // If old value isn't an array or doesn't have the same length, we have an update...
        if (!isArray(oldValue) || newValue.length !== oldValue.length) {
            return true;
        }
        for (var i = 0; i < newValue.length; i++) {
            if (dataHasBeenUpdated(oldValue[i], newValue[i])) {
                return true;
            }
        }
    } else if (isObject(newValue)) {
        var newKeys = Object.keys(newValue);
        if (!isObject(oldValue)) {
            return true;
        } else {
            var oldKeys = Object.keys(oldValue);
            if (newKeys.length > oldKeys.length) {
                return true;
            }
        }
        for (var i = 0; i < newKeys.length; i++) {
            if (dataHasBeenUpdated(oldValue[newKeys[i]], newValue[newKeys[i]])) {
                return true;
            }
        }
    } else {
        if (oldValue !== newValue) {
            return true;
        }
    }
    return false;
}
