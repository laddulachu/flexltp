angular.module('app').service('$appEventHandler', function ($rootScope, $injector) {
    'use strict';
    this.processServerStateEvent = function (serverState, request) {
        var app = $injector.get('app');
        app.serverState = serverState;
        var newState = serverState + (request.params && request.params.clientSubState ? ('.' + request.params.clientSubState) : '');
        newState = newState.toLowerCase();

        var previousClientState = app.clientState;

        if(!app.events) {
            app.events = {};
        }

        // If request is for a partial field update and the state isn't changing and we already have data for the current state...
        if(request.params.partialUpdateFields && previousClientState === newState && app.events[serverState]) {
          for(var i=0; i < request.params.partialUpdateFields.length; i++) {
              app.events[serverState][request.params.partialUpdateFields[i]] = request.params[request.params.partialUpdateFields[i]];
          }
          $rootScope.$broadcast('eventReceived', app.events[serverState]);
          return null;
        } else {
          app.events[serverState] = request.params;
        }

        app.clientState = newState;
        if(previousClientState === newState) {
            // Only need to broadcast if we aren't changing states.  If we are changing states, new state will already pick up the data.
            $rootScope.$broadcast('eventReceived', request.params);
        }
        return app.clientState;

    };
});
