'use strict';
module.exports = {
    startURL: 'https://chinaltptest.hkd.flextronics.com/centralltp/',
    baseURL: 'https://chinaltptest.hkd.flextronics.com/centralltp/',
    appServerPort: 443,
    appServerProtocol: 'http',
    appServerHost: 'localhost',
    proxyHost: 'localhost',
    staticFilesRootDir: '../static/',
    staticFilesTempDir: 'temp/',
    timeout: 1 * 60 * 1000,
    lifetime: 3 * 60 * 1000,
    firstConnectTimeout: 1 * 60 * 1000,
    keepSessionAliveOnTimeout: false,
    loadFailTimeout: 30 * 1000,
    loadImages: false,
    //userAgentSuffix: 'Powwow/1.0',
    userAgentReplacement: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36',

    log: {
        actions: true,
        action_params: true,
        navigation: true,
        resourceLoads: true,
        setStates: true,
        setDatas: true,
        getDatas: true,
        errors: true
    },
     // See: https://github.com/powwowinc/PowwowTools/tree/master/PhantomVisual
    phantomVisual: {
        host: 'localhost',
        port: 8082,
        interval: 1000
    },
    remoteDebug: {
        enabled: true,
        port: 8093,
        phantomRequestResponse: false
    },

    getInitializationData: function () {
        return {};
    },
    initialize: function (initData) {
    },
    onPageLoad: function (page, frames, method) {
    },
    onPagePreLoad: function (page) {
    }
};
