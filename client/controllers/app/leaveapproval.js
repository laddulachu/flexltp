angular.module('app').controller('app_leaveapproval', app_leaveapproval);
function app_leaveapproval($scope, app) {
    'use strict';
    app.init($scope);
    $scope.noRecords = 'true';
    if($scope.data.leaveappn.length>0){
        $scope.noRecords = false;
    }
    $scope.leaveDetails = function(leave){
        var leaveDetail = {
                "itemNo":leave.$i, "name" : leave.name , "leave_type": leave.leavetype, "duration" : leave.duration, "start_date" : leave.startdate, "end_date" : leave.enddate, "reason": leave.reason, "leave_check":leave.selectleave
            }
        localStorage.setItem("keyForLeaveDetails", JSON.stringify(leaveDetail));
        //app.call("leaveapproval.leavecheckbox");
        app.go("app.leavedetails"); 
    };
}