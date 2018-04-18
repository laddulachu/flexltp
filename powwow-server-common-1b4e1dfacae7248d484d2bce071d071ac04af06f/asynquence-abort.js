'use strict';

var ASQ = require('asynquence'),
    EventEmitter = require('events').EventEmitter;

ASQ.extend("on",function __build__(api,internals){
    return function __on__(event, callback) {
        if (!api.emitter) {
            api.emitter = new EventEmitter();
        }

        api.emitter.on(event, callback);

        return api;
    };
});

ASQ.extend("abortWithEvent",function __build__(api,internals){
    return function __abortWithEvent__() {
        api.abort();

        if (api.emitter) {
            api.emitter.emit('abort');
        }

        return api;
    };
});

ASQ.extend("thenWithAbort",function __build__(api,internals){
    return function __thenWithAbort__(seqFn) {
        var seq;

        api.then(function __then__(done) {
            seq = seqFn.apply(this, arguments).pipe(done);
        });

        api.on('abort', function() {
            if (ASQ.isSequence(seq)) {
                seq.abort();
            }
        });

        return api;
    };
});
