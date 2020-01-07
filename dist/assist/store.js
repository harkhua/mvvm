define(["require", "exports", "./util"], function (require, exports, util_1) {
    "use strict";
    exports.__esModule = true;
    var Store;
    (function (Store) {
        var __CACHE__ = {
            __events__: {}
        };
        function mix(x, y) {
            if (!x) {
                return y;
            }
            if (y) {
                for (var key in y) {
                    if (y.hasOwnProperty(key)) {
                        x[key] = y[key];
                    }
                }
            }
            return x;
        }
        function setChannel(channel, map) {
            if (!channel) {
                return;
            }
            __CACHE__[channel] = map;
        }
        Store.setChannel = setChannel;
        function mixChannel(channel, map) {
            if (!channel) {
                return;
            }
            var cache = __CACHE__[channel];
            __CACHE__[channel] = mix(cache, map);
        }
        Store.mixChannel = mixChannel;
        function save(channel, key, data) {
            var _a;
            if (channel in __CACHE__) {
                __CACHE__[channel][key] = data;
            }
            else {
                __CACHE__[channel] = (_a = {},
                    _a[key] = data,
                    _a);
            }
        }
        Store.save = save;
        function read(channel, key) {
            if (channel in __CACHE__) {
                return key ? __CACHE__[channel][key] : __CACHE__[channel];
            }
        }
        Store.read = read;
        function on(eventName, callback) {
            var events = __CACHE__.__events__;
            if (eventName in events) {
                events[eventName].push(callback);
            }
            else {
                events[eventName] = [callback];
            }
        }
        Store.on = on;
        function emit(eventName) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var events = __CACHE__.__events__;
            if (eventName in events) {
                var delIdx_1 = [];
                var ents = events[eventName];
                ents.forEach(function (cb, idx) {
                    try {
                        util_1.isFunction(cb) && cb.apply(cb, args);
                        if (cb["once"]) {
                            delIdx_1.push(idx);
                        }
                    }
                    catch (e) {
                        console.log(e);
                    }
                });
                if (delIdx_1.length) {
                    var i = delIdx_1.length;
                    while (--i >= 0) {
                        ents.splice(delIdx_1[i], 1);
                    }
                }
            }
        }
        Store.emit = emit;
        function off(eventName) {
            var events = __CACHE__.__events__;
            if (!(eventName in events))
                return;
            delete events[eventName];
        }
        Store.off = off;
        function once(eventName, callback) {
            callback["once"] = true;
            on(eventName, callback);
        }
        Store.once = once;
    })(Store = exports.Store || (exports.Store = {}));
});
