angular.module('app').controller('app_approvecomment', app_approvecomment);
function app_approvecomment($scope, app) {
    'use strict';
    app.init($scope);
    
     $scope.approveLeave = function() {
       var comment = $scope.data.comment;
       app.call('approvecomment.approvecommentok', {"comment":comment});
    };

 
}