var logger = require('./logger');
var stateManager = require('./stateManager');
var Promise = require('promise');
var config = require.main.require('./config');

/* Sample of new API:
exports.administerDose = function(page, params) {

    // On some specific DOM mutation, e.g. a validation pop-up.
    page.onMutation(getNode, checkForMutation2, 2000)

        // Extract some data by page model.  Data gets put into a "dataStack" by every call that extracts data.
        .extract("administerMedsValidationMsg", "validationMessage")

        .ifElse(function(dataMap) { return dataMap.validationMessage.message; }, function() {
        // else branch
        }) // Main branch is if true branch.

        // Run a page model defined action
        .action("administerMedsValidationMsg", "ok")

        // Extract some more data by page model, this data is now on top of the data stack.
        .extract("administerMeds")

        // Do some kind of data stack operation.
        .data(function(data) { data.validationError = data.validationMessage; })

        // Update the client screen and data.  By default, the top of the data stack is sent.
        .screen(screens.ADMINISTERMEDICATION, ["administerDose"]);

    // On some specific DOM mutation, e.g. an inline error message shown.
    page.onMutation(getNode, checkForMutation, 2000)

        // Extract the page data of this page by page model
        .extract("administerMeds")

        // Update the client.
        .screen(screens.ADMINISTERMEDICATION, ["administerDose"]);

    // Update the page data by page model.
    page.update("administerMeds", params)
        // Then click an action.
        .action("administer");
}

Descriptors should be defined under "powwow.descriptors", so "administerMeds" maps to powwow.descriptors.administerMeds.
*/

// Random Ids
var id = newRandomId();
var eventCounter = 1;

/*
 * Returns a function that has methods that map to all the methods in the PageMethods prototype.
 */
module.exports = function (context) {

    function resetPage() {
        context.dataMap = {};
        stateManager.stopWaitingForPageMessages(context);
        stateManager.stopWaitingForResourceLoads();
        stateManager.stopWaitingForResourceRequests();
        stateManager.stopWaitingForNavigationRequests();
        stateManager.stopWaitingForPageClose();
        stateManager.stopWaitingForLoadFailure();
        stateManager.stopWaitingForPageCreate();
    }

    var pageMethods = new PageMethodsConstructor(context);

    // Reset the page data stack and unregister all callbacks.
    pageMethods.reset = resetPage;

    function exportPageMethod(promise, methodName) {
        var p = promise;
        promise[methodName] = function () {
            if (!p.then) {
                p = p();
            }
            return exportPageMethods(p.then(pageMethods[methodName].apply(pageMethods, arguments), function () {
                logger.info("Promise for " + methodName + " cancelled");
            }));
        };
    }

    function exportPageMethods(promise) {
        for (var methodName in pageMethods) {
            exportPageMethod(promise, methodName);
        }
        promise.else = promise.catch;
        return promise;
    }

    function newEmptyPromise() {
        return new Promise(function (resolve) {
            resolve(context);
        });
    }

    return exportPageMethods(newEmptyPromise);
};

function newRandomId() {
    return Math.floor(Math.random() * 100000) + "";
}
function newEventId() {
    return id + "." + (eventCounter++) + "." + newRandomId();
}

/*
 * Creates a function that when run, returns a promise that uses the passed in function as its resolve function.
 */
function newPromiseWrapper(resolveFunction) {
    return function () {
        return new Promise(function (resolve, reject) {
            try {
                resolveFunction.call(this, resolve, reject);
            } catch (e) {
                logger.error("*** PAGE API ERROR ***");
                logger.error(e);
            }
        });
    };
}

function PageMethodsConstructor(context) {
    context.dataMap = {};

    function addJSONDataToStackAndResolve(context, jsonData, dataName, resolve) {

        if ((typeof context.dataMap) != "object") {
            context.dataMap = {};
        }

        if (jsonData) {
            if (!dataName) {
                var dm = JSON.parse(jsonData);
                if ((typeof dm) == "object") {
                    for (var prop in dm) {
                        context.dataMap[prop] = dm[prop];
                    }
                }
            } else {
                context.dataMap[dataName] = JSON.parse(jsonData);
            }
        }
        resolve(context);
    }

    function addDataToStackAndResolve(dataName, resolve) {
        return function (err, jsonData) {
            addJSONDataToStackAndResolve(context, jsonData, dataName, resolve);
        };
    }

    function addPageMessageDataToStackAndResolve(dataName, resolve) {
        return function (ctx) {
            addJSONDataToStackAndResolve(context, ctx.messageData, dataName, resolve);
        };
    }

    function pageMessageResolve(resolve) {
        return function () {
            resolve(context);
        };
    }

    function waitForPageMessage(eventId, resolve) {
        stateManager.waitForPageMessage(context, eventId).then(resolve);
    }

    function waitForPageMessageJSON(eventId, resolve) {
        stateManager.waitForPageMessageJSON(context, eventId).then(resolve);
    }

    function waitForPageMessageWithoutDataMap(eventId, resolve) {
        stateManager.waitForPageMessageWithoutDataMap(context, eventId).then(resolve);
    }

    // ************* PAGE CONTEXT EVENTS *************

    this.onMutation = function (pageModel, itemId, mutationTest, timer) {
        return newPromiseWrapper(function (resolve) {
            var eventId = newEventId();
            waitForPageMessage(eventId, pageMessageResolve(resolve));
            logger.info("page.onMutation('" + eventId + "', '" + [].slice.call(arguments).join("', '") + "');");
            context.page.evaluate(function (eventId, pageModel, itemId, mutationTest, timer) {
                powwow.waitOnceForSpecificDOMMutationUsingDescriptor(
                    powwow.descriptors[pageModel],
                    itemId,
                    powwow.mutationTest[mutationTest],
                    powwow.getCurrentWindow().document,
                    (timer || 30000)
                ).then(function (mutationFound) {
                    if (mutationFound) {
                        console.log("'" + eventId + "': Mutation found");
                        powwow.sendPageMessage(eventId);
                    }
                });
            }, eventId, pageModel, itemId, mutationTest, timer, function () {
            });
        });
    };

    this.onMutationTimeout = function (pageModel, itemId, lullTimeout, timer) {
        return newPromiseWrapper(function (resolve) {
            var eventId = newEventId();
            waitForPageMessage(eventId, pageMessageResolve(resolve));
            logger.info("page.onMutationTimeout('" + eventId + "', '" + [].slice.call(arguments).join("', '") + "');");
            context.page.evaluate(function (eventId, pageModel, itemId, lullTimeout, timer) {
                powwow.waitOnceForDOMMutationLullUsingDescriptor(
                    powwow.descriptors[pageModel],
                    itemId,
                    powwow.getCurrentWindow().document,
                    lullTimeout,
                    (timer || 10000)
                ).then(function (mutationFound) {
                    if (mutationFound) {
                        console.log("'" + eventId + "': onMutationTimeout - Mutation found");
                        powwow.sendPageMessage(eventId);
                    }
                });
            }, eventId, pageModel, itemId, lullTimeout, timer, function () {
            });
        });
    };

    // ************* TAB LEVEL EVENTS *************

    this.onNavigateRequest = function (regex) {
        return newPromiseWrapper(function (resolve) {
            stateManager.waitForNavigateRequestOnce(regex, function () {
                logger.info("page.onNavigateRequest('" + regex.toString() + "');");
                resolve(context);
            });
        });
    };

    this.onLoadFailure = function (regex) {
        return newPromiseWrapper(function (resolve) {
            stateManager.waitForLoadFailure(regex, function () {
                logger.info("page.onLoadFailure('" + regex.toString() + "');");
                resolve(context);
            });
        });
    };

    this.onResourceRequest = function (regex, continuous, func) {
        return newPromiseWrapper(function (resolve) {

            if (continuous) {
                stateManager.waitForResourceRequest(regex, function (requestData) {
                    logger.info("page.onResourceRequest('" + regex.toString() + "', true);");
                    if (func) {
                        func(requestData);
                    }
                    resolve(context);
                });
            } else {
                stateManager.waitForResourceRequestOnce(regex, function (requestData) {
                    logger.info("page.onResourceRequest('" + regex.toString() + "', false);");
                    if (func) {
                        func(requestData);
                    }
                    resolve(context);
                });
            }

        });
    };

    this.onResourceLoad = function (regex, continuous, func) {
        return newPromiseWrapper(function (resolve) {
            if (continuous) {
                stateManager.waitForResourceLoad(regex, function (response) {
                    logger.info("page.onResourceLoad('" + regex.toString() + "', true);");
                    if (func) {
                        func(response);
                    }
                    resolve(context);
                });
            } else {
                stateManager.waitForResourceLoadOnce(regex, function (response) {
                    if (func) {
                        func(response);
                    }
                    logger.info("page.onResourceLoad('" + regex.toString() + "', false);");
                    resolve(response);
                });
            }
        });
    };

    this.switchToNextPopupWindow = function () {
        return newPromiseWrapper(function (resolve) {
            stateManager.waitForPageCreated(function (page) {
                logger.info("page.switchToNextPopupWindow();");
                stateManager.stopWaitingForPageCreate();
                stateManager.connectToNewPopup(page);
                resolve(page);
            });
        });
    };

    this.switchToPreviousWindow = function () {
        return newPromiseWrapper(function (resolve) {
            var page = stateManager.switchToPreviousPage();
            context.page = page;
            logger.info("page.switchToPreviousWindow();");
            resolve(page);
        });
    };

    this.onPageMessage = function (eventId, dataName) {
        return newPromiseWrapper(function (resolve) {
            return stateManager.waitForPageMessage(context, eventId, dataName).then(function () {
                logger.info("page.onPageMessage('" + eventId + "', '" + dataName + "')");
                resolve();
            });
        });
    };

    this.onAlert = function (dataName) {
        return newPromiseWrapper(function (resolve) {
            return stateManager.waitForPageMessage(context, "window.alert", dataName).then(function () {
                logger.info("page.onAlert('" + dataName + "')");
                resolve();
            });
        });
    };

    this.onConfirm = this.onConfirmCancel = function (dataName) {
        return newPromiseWrapper(function (resolve) {
            return stateManager.waitForPageMessage(context, "window.confirmCancel", dataName).then(function () {
                logger.info("page.onConfirmCancel('" + dataName + "')");
                resolve();
            });
        });
    };

    this.onConfirmOK = function (dataName) {
        return newPromiseWrapper(function (resolve) {
            return stateManager.waitForPageMessage(context, "window.confirmOK", dataName).then(function () {
                logger.info("page.onConfirmOK('" + dataName + "')");
                resolve();
            });
        });
    };

    this.setMutationIgnoreList = function (ignoreList) {
        return newPromiseWrapper(function (resolve) {
            context.page.evaluate(function (ignoreList) {
                powwow.setMutationIgnoreList(ignoreList);
            }, ignoreList, resolve);
        });
    };

    this.onGlobalMutation = function (func, allFrames) {
        return newPromiseWrapper(function (resolve) {
            logger.info("********* Adding mutation checkers..., allFrames=", allFrames);
            context.page.evaluate(function (checkAllFrames) {
                powwow.removeGlobalMutationListeners();
                powwow.addToGlobalMutationListener(document.body);
                if(checkAllFrames) {
                    var arrFrames = powwow.getAllFrameWindows(window);
                    for (var i = 0; i < arrFrames.length; i++) {
                        var w = arrFrames[i];
                        if(w.contentDocument) {
                            powwow.addToGlobalMutationListener(w.contentDocument.body);
                        }
                    }
                }
            }, allFrames, function () {
                stateManager.waitForPageMessageContinuously(context, "window.domMutation", function (context) {
                    if (func) {
                        func(context.messageData);
                    }
                    // resolve(); - We never resolve this one as we want to keep on getting events.
                });
            });
        });
    };

    this.clearData = function () {
        return newPromiseWrapper(function (resolve) {
            context.dataMap = {};
            resolve();
        });
    };

    // ********** OTHER EVENTS NOT PAGE RELATED **********

    this.onTimer = function (millis, timerName) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.onTimerStart(" + millis + (timerName ? ", '" + timerName + "'" : "") + ");");
            var t = setTimeout(function () {
                logger.info("page.onTimerEnd(" + millis + (timerName ? ", '" + timerName + "'" : "") + ");");
                resolve(context);
            }, millis);
            if (timerName) {
                if (!context.timers) {
                    context.timers = {};
                }
                context.timers[timerName] = t;
            }
        });
    };

    // Extract data from the page using the page model.
    this.extract = function (pageModel) {
        return newPromiseWrapper(function (resolve) {
            var eventId = newEventId();
            waitForPageMessageJSON(eventId, resolve);
            logger.info("page.extract('" + pageModel + "');");
            context.page.evaluate(function (pageModel, eventId) {
                if (window.powwow) {
                    var desc = powwow.getDescriptor(powwow.descriptors, pageModel);
                    powwow.extract(desc, powwow.getCurrentWindow().document).then(function (response) {
                        powwow.sendPageMessage(eventId, JSON.stringify(response));
                    });
                } else {
                    powwow.sendPageMessage(eventId, "{}");
                }
            }, pageModel, eventId, function () {

            });
        });
    };

    this.checkStateUsingDescriptor = function (testAll) {
        return newPromiseWrapper(function (resolve) {
            var eventId = newEventId();
            waitForPageMessageWithoutDataMap(eventId, resolve);
            logger.info("page.checkStateUsingDescriptor();");
            context.page.evaluate(function (eventId, testAll) {
                powwow.checkStateUsingDescriptor(testAll).then(function (data) {
                    if (testAll) {
                        powwow.sendPageMessage(eventId, data);
                    } else {
                        console.log("Found state variant:", data.stateVariant, data.descriptor, data.screens);
                        powwow.sendPageMessage(eventId, data);
                    }
                });
            }, eventId, testAll, function () {
            });
        });
    };

    // Update data using a page model.
    this.update = function (pageModel, data, noFlatten) {
        return newPromiseWrapper(function (resolve) {
            var _pageModel = pageModel;
            var _data = data;
            var eventId = newEventId();
            waitForPageMessage(eventId, resolve);
            var logMsg = (logger.level() == logger.DEBUG) ? (", " + JSON.stringify(data).substring(0, 60)) : "";
            logger.info("page.update(\'" + pageModel + "\'" + logMsg + ");");
            context.page.evaluate(function (data, eventId, pageModel, noFlatten) {
                var desc = powwow.getDescriptor(powwow.descriptors, pageModel);
                powwow.update(desc, data, powwow.getCurrentWindow().document, noFlatten).then(function () {
                    //powwow.log("powwow.update('" + pageModel + "',", JSON.stringify(data) + ")");
                    powwow.sendPageMessage(eventId);
                });
            }, _data, eventId, _pageModel, noFlatten, function () {
            });
        });
    };

    // Perform an action using a page model.  The action should be a path string in the descriptor tree.
    this.action = function (pageModel, actionPath) {
        return newPromiseWrapper(function (resolve) {
            var eventId = newEventId();
            waitForPageMessage(eventId, resolve);
            logger.info("page.action('" + pageModel + "', '" + actionPath + "');");
            context.page.evaluate(function (actionPath, eventId, pageModel) {
                powwow.action(
                    powwow.getDescriptor(powwow.descriptors, pageModel),
                    actionPath,
                    powwow.getCurrentWindow().document
                ).then(function () {
                    powwow.sendPageMessage(eventId);
                });
            }, actionPath, eventId, pageModel, function () {
            });
        });
    };

    // Set an Href.
    this.href = function (newHref) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.href('" + newHref + "');");
            context.page.evaluate(function (newHref) {
                powwow.getCurrentWindow().location = newHref;
            }, newHref, resolve);
        });
    };

    // Reload page or go back in history.
    this.history = function (n) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.history('" + n + "');");
            context.page.evaluate(function (n) {
                window.history.go(n);
            }, n, resolve);
        });
    };

    /*
     this.switchToChildWindow = function(childWindowId) {
        return newPromiseWrapper(function(resolve) {
            logger.info("page.switchToChildWindow('" + childWindowId + "');");
            context.page.evaluate(function(childWindowId) {
                powwow.switchToChildWindow(childWindowId);
            }, childWindowId, resolve);
        });
     };*/

    // Setup window.confirm to click Cancel
    this.confirmClickCancel = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.confirmClickCancel();");
            context.page.evaluate(function () {
                powwow.confirmWithCancel(powwow.getCurrentWindow());
            }, resolve);
        });
    };

    // Setup window.confirm to click OK
    this.confirmClickOK = function (nextAction) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.confirmClickOK();");
            context.page.evaluate(function (nextAction) {
                powwow.confirmWithOK(powwow.getCurrentWindow(), nextAction);
            }, nextAction, resolve);
        });
    };

    this.prepareForAlert = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.prepareForAlert();");
            context.page.evaluate(function () {
                powwow.overrideAlert(powwow.getCurrentWindow());
            }, resolve);
        });
    };
    // ************* METHODS RUN IN PAGE CONTEXT *************
    // All the function parameters for these methods are run in the context of the web page with the injected JS, not
    // the page. Functions can return and take data.

    this.evalSync = function (fn, dataName) { // Run something in the context of the page.
        return newPromiseWrapper(function (resolve) {
            context.page.evaluate(fn, context.dataMap, addDataToStackAndResolve(dataName, resolve));
        });
    };

    // Takes a function like this one:
    // function(data, eventId) {
    //   // Do some async thing, then call:
    //   powwow.sendMessage(eventId, data);
    // }
    this.evalAsync = function (fn, dataName) { // Run something in the context of the page.
        return newPromiseWrapper(function (resolve) {
            var eventId = newEventId();
            waitForPageMessage(eventId, addPageMessageDataToStackAndResolve(dataName, resolve));
            context.page.evaluate(fn, context.dataMap, eventId, function () {
            });
        });
    };

    // Continue if some condition is met int the data stack.
    this.ifElse = function (funcDataMap, funcElse) {
        return newPromiseWrapper(function (resolve, reject) {
            var returnVal = funcDataMap.call(this, context.dataMap);
            if (returnVal) {
                logger.info("page.ifElse() was true, continuing on main path");
                resolve(context);
            } else {
                logger.info("page.ifElse() was false, evaluating branch.");
                if (funcElse) {
                    funcElse.call(this, context.dataMap);
                }
                reject(context); // -> Adding this in will allow for a rejoining of all branches with a "catch".
            }
        });
    };

    // Do some kind of data stack operation.
    this.data = function (funcDataMap) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.data();");
            funcDataMap.call(this, context.dataMap);
            resolve(context);
        });
    };

    // Do something
    this.run = function (func) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.run();");
            func.call(this);
            resolve(context);
        });
    };

    // Either screen(screen, subscreen) OR
    // screen(screen, arrPartialFields, dataName)
    this.screen = function (screen, arrPartialFields, dataName) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.screen('" + screen + "'" +
                (arrPartialFields ? ", " + JSON.stringify(arrPartialFields) : '') + (dataName ? "," + dataName : '') +
                ");");
            var secondParamIsArray = toString.call(arrPartialFields).indexOf("Array") >= 0;
            if (secondParamIsArray) {
                stateManager.setScreen(screen, dataName
                    ? context.dataMap[dataName]
                    : context.dataMap, arrPartialFields);
            } else {
                // Fix issue where subscreen changes without meaning to change it.  Need to explicitly call
                // "setSubScreen(null)" to unset it now.
                if (arrPartialFields) {
                    stateManager.setSubScreen(screen, arrPartialFields);
                }
                stateManager.setScreen(screen, context.dataMap);
            }
            resolve(context);
        });
    };

    this.subscreen = function (screen, subscreen) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.subscreen('" + screen + "', '" + subscreen + "');");
            stateManager.setSubScreen(screen, subscreen);
            resolve(context);
        });
    };

    // Old Check State function, renamed from checkState to checkLoadedPage
    this.checkLoadedPage = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.checkState();");
            context.page.onLoadFinished('success');
        });
    };

    // Save an image of the page.
    this.render = function (filename) {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.render('" + filename + "');");
            context.page.render(filename, resolve);
        });
    };

    this.updateUserAgentAndViewport = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.updateUserAgentAndViewport();");
            context.page.get('settings.userAgent', function (err, userAgent) {
                if (config.userAgentReplacement) {
                    userAgent = config.userAgentReplacement;
                } else if (config.userAgentSuffix) {
                    userAgent = userAgent + " " + config.userAgentSuffix;
                }
                logger.info("User-Agent:", userAgent);
                context.page.set('settings.userAgent', userAgent, function () {
                    var viewportSize = config.viewportSize;
                    if (!viewportSize) {
                        viewportSize = { width: 1024, height: 768 };
                    }
                    if (!viewportSize.width) { viewportSize.width = 1024; }
                    if (!viewportSize.height) { viewportSize.height = 768; }
                    context.page.set('viewportSize', viewportSize, function () {
                        resolve(context);
                    });
                });
            });
        });


    };

    // Close the page.
    this.close = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.close();");
            context.page.close(resolve);
        });
    };

    // Unload the page.
    this.unload = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.unload();");
            context.page.evaluate(function () {
                window.onunload();
            }, resolve);
        });
    };

    // Log a message
    this.log = function (message) {
        return newPromiseWrapper(function (resolve) {
            logger.info(message);
            resolve(context);
        });
    };

    this.cancelTimer = function (timerName) {
        return newPromiseWrapper(function (resolve) {
            if (context.timers) {
                var t = context.timers[timerName];
                if (t) {
                    logger.info("page.cancelTimer('" + timerName + "');");
                    clearTimeout(context.timers[timerName]);
                    delete context.timers[timerName];
                }
            }
            resolve(context);
        });
    };

    this.done = function () {
        return newPromiseWrapper(function (resolve) {
            logger.info("page.done();");
            resolve(context);
        });
    };

}
