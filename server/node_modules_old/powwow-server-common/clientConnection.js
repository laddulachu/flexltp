'use strict';

var logger = require('./logger');
var client = require('./client');

exports.initialize = client.notification('ui.initialize');
exports.showMessage = client.notification('ui.showMessage');
exports.setScreen = function(screen) {
    // This is 'setState' instead of 'setScreen' for backwards compatibility.
    return client.notification('setState.' + screen);
};
