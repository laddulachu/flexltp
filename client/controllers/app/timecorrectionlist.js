angular.module('app').controller('app_timecorrectionlist', app_timecorrectionlist);
function app_timecorrectionlist($scope, app) {
    'use strict';
    app.init($scope);
     
    $scope.noRecords = 'true';
    if($scope.data.timecorrectionappn.length>0){
        $scope.noRecords = false;
    }
    $scope.timeCorrectionDetails = function(timecorrection){
        var timeCorrectionDetail = {
                "itemNo":timecorrection.$i, "name" : timecorrection.name , "reg_date": timecorrection.dateofregistration, "attendance_date" : timecorrection.attendancedate, "clock_in" : timecorrection.clockintime, "clock_out" : timecorrection.clockouttime, "reason": timecorrection.reason, "time_check":timecorrection.timecheckbox
            }
        localStorage.setItem("keyFortimeCorrectionDetails", JSON.stringify(timeCorrectionDetail));
        //app.call("timecorrectionlist.timecheckbox");
        app.go("app.timecorrectiondetails"); 
    };
}