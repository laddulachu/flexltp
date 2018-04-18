angular.module('app').controller('app_timecorrectiondetails', app_timecorrectiondetails);
function app_timecorrectiondetails($scope, app, $ionicHistory) {
    'use strict';
    app.init($scope);
    $scope.timecorrection = JSON.parse(localStorage.getItem('keyFortimeCorrectionDetails'));
    localStorage.removeItem('keyFortimeCorrectionDetails');
    if(!$scope.timecorrection.time_check){
        app.call('timecorrectionlist.timecheckbox',{"itemNo": $scope.timecorrection.itemNo});
    }
    $scope.myGoBack = function() {
        $ionicHistory.goBack();
    };
    $scope.approveCorrection = function() {
       app.call('timecorrectionlist.timeapprove');
       app.clientState = "app.timecorrectiondetails";
    };
    $scope.rejectCorrection = function() {
        app.call('timecorrectionlist.timereject');
        app.clientState = "app.timecorrectiondetails";
    };
}