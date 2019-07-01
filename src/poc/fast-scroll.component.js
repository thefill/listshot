require('angular');

const FastScroll = require('./fast-scroll.component.class');

module.exports = angular.module('fast-scroll-module', [])
    .component('fastScroll', {
        templateUrl: 'template/fast-scroll.template.html',
        controllerAs: 'ctrl',
        bindings: {
            groupCount: '<',
            groupHeight: '<',
            groupExpanded: '<',
            count: '<',
            height: '<',
            container: '<',
            onChange: '&',
        },
        controller: FastScroll
    });