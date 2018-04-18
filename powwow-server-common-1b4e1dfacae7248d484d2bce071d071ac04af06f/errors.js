'use strict';

module.exports = {

    invalidRequest: {code: -32600, message: 'Invalid request'},

    parseError: {code: -32700, message: 'Parse error'},

    methodNotFound: {code: -32601, message: 'Method not found'},

    internalError: {code: -32603, message: 'Internal error'},

    connectionError: {code: -32001, message: 'Connection Error'},

    withMessage: function(message) {
        return {
            code: -1, // ??
            message: message
        };
    }
};
