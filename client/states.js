angular.module('app').config(function ($stateProvider) {
    'use strict';
    $stateProvider.state('app', {
        abstract: true,
        controller: 'app',
        templateProvider: function (app) {
            return app.templateProvider('app');
        }
    }).state('app.login', {
        views: {
            app: {
                controller: 'app_login',
                templateProvider: function (app) {
                    return app.templateProvider('app.login');
                }
            }
        }
    }).state('app.menu', {
        views: {
            app: {
                controller: 'app_menu',
                templateProvider: function (app) {
                    return app.templateProvider('app.menu');
                }
            }
        }
    }).state('app.multiselect', {
        views: {
            app: {
                controller: 'app_multiselect',
                templateProvider: function (app) {
                    return app.templateProvider('app.multiselect');
                }
            }
        }
    }).state('app.approvecomment', {
        views: {
            app: {
                controller: 'app_approvecomment',
                templateProvider: function (app) {
                    return app.templateProvider('app.approvecomment');
                }
            }
        }
    }).state('app.approved', {
        views: {
            app: {
                controller: 'app_approved',
                templateProvider: function (app) {
                    return app.templateProvider('app.approved');
                }
            }
        }
    }).state('app.correctionapprovecomment', {
        views: {
            app: {
                controller: 'app_correctionapprovecomment',
                templateProvider: function (app) {
                    return app.templateProvider('app.correctionapprovecomment');
                }
            }
        }
    }).state('app.correctionapproved', {
        views: {
            app: {
                controller: 'app_correctionapproved',
                templateProvider: function (app) {
                    return app.templateProvider('app.correctionapproved');
                }
            }
        }
    }).state('app.correctionrejectcomment', {
        views: {
            app: {
                controller: 'app_correctionrejectcomment',
                templateProvider: function (app) {
                    return app.templateProvider('app.correctionrejectcomment');
                }
            }
        }
    }).state('app.correctionrejected', {
        views: {
            app: {
                controller: 'app_correctionrejected',
                templateProvider: function (app) {
                    return app.templateProvider('app.correctionrejected');
                }
            }
        }
    }).state('app.home', {
        views: {
            app: {
                controller: 'app_home',
                templateProvider: function (app) {
                    return app.templateProvider('app.home');
                }
            }
        }
    }).state('app.leaveapproval', {
        views: {
            app: {
                controller: 'app_leaveapproval',
                templateProvider: function (app) {
                    return app.templateProvider('app.leaveapproval');
                }
            }
        }
    }).state('app.leavedetails', {
        views: {
            app: {
                controller: 'app_leavedetails',
                templateProvider: function (app) {
                    return app.templateProvider('app.leavedetails');
                }
            }
        }
    }).state('app.rejectcomment', {
        views: {
            app: {
                controller: 'app_rejectcomment',
                templateProvider: function (app) {
                    return app.templateProvider('app.rejectcomment');
                }
            }
        }
    }).state('app.rejected', {
        views: {
            app: {
                controller: 'app_rejected',
                templateProvider: function (app) {
                    return app.templateProvider('app.rejected');
                }
            }
        }
    }).state('app.timecorrectiondetails', {
        views: {
            app: {
                controller: 'app_timecorrectiondetails',
                templateProvider: function (app) {
                    return app.templateProvider('app.timecorrectiondetails');
                }
            }
        }
    }).state('app.timecorrectionlist', {
        views: {
            app: {
                controller: 'app_timecorrectionlist',
                templateProvider: function (app) {
                    return app.templateProvider('app.timecorrectionlist');
                }
            }
        }
    }).state('app.prelogin', {
       
    }).state('app.vpnprelogin', {
       
    }).state('app.postlogin', {
       
    });
});