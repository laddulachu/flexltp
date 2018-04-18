angular.module('app').controller('app_leavedetails', app_leavedetails);
function app_leavedetails($scope, app, $ionicHistory) {
    'use strict';
    app.init($scope);
    $scope.leave = JSON.parse(localStorage.getItem('keyForLeaveDetails'));
    localStorage.removeItem('keyForLeaveDetails');
    if(!$scope.leave.leave_check){
        app.call('leaveapproval.leavecheckbox',{"itemNo": $scope.leave.itemNo});
    }
    $scope.myGoBack = function() {
        $ionicHistory.goBack();
    };
    $scope.approveLeave = function() {
        app.call("leaveapproval.leveapprove");
    };
    $scope.rejectLeave = function() {
        app.call("leaveapproval.levereject");
    };
    
}