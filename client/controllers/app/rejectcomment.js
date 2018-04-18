angular.module('app').controller('app_rejectcomment', app_rejectcomment);
function app_rejectcomment($scope, app) {
    'use strict';
    app.init($scope);
     $scope.rejectLeave = function() {
       var comment = $scope.data.comment;
       app.call('rejectcomment.rejectcommentok', {"comment":comment});
    };

}