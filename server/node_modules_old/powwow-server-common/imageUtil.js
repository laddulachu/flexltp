'use strict';

var Promise = require('promise');

exports.getBase64Image = function(context, imgSelector) {
    return new Promise(function(resolve, reject) {
        context.page.evaluate(function(imgSelector) {
            var imgTag = document.querySelector(imgSelector);
            return imgTag ? imgTag.getBoundingClientRect() : {top:0,left:0,width:0,height:0};
        }, imgSelector, function(rect) {
            context.page.set('clipRect', rect, function() {
                context.page.renderBase64('PNG', function(base64EncodedImage) {
                    context.page.set('clipRect',{}, function() {
                        resolve(base64EncodedImage);
                    });
                });
            });
        });
    });
};
