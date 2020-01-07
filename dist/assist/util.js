define(["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    var ObjProto = Object.prototype;
    var FuncProto = Function.prototype;
    var TOSTRING = ObjProto.toString;
    var rword = /[^, ]+/g;
    var rwindow = /^\[object (?:Window|DOMWindow|global)\]$/;
    var hasOwnProperty = ObjProto.hasOwnProperty;
    function isDefined(obj) {
        return obj !== undefined && obj !== null;
    }
    exports.isDefined = isDefined;
    function isObject(obj) {
        var type = typeof obj;
        return type === 'object' || (type === 'function' && TOSTRING.call(obj) === '[object Object]');
    }
    exports.isObject = isObject;
    exports.isArray = Array.isArray || function (obj) {
        return TOSTRING.call(obj) === '[object Array]';
    };
    function isString(obj) {
        return TOSTRING.call(obj) === '[object String]';
    }
    exports.isString = isString;
    function isNumber(obj) {
        return TOSTRING.call(obj) === '[object Number]';
    }
    exports.isNumber = isNumber;
    function isBoolean(obj) {
        return obj === true || obj === false || TOSTRING.call(obj) === '[object Boolean]';
    }
    exports.isBoolean = isBoolean;
    exports.isFunction = typeof alert === "object" ?
        function (obj) {
            try {
                return /^\s*\bfunction\b/.test(obj + "");
            }
            catch (e) {
                return false;
            }
        } :
        function (obj) {
            return TOSTRING.call(obj) === "[object Function]";
        };
    function splitStr2Obj(source) {
        var result = {};
        source.match(rword).forEach(function (key) {
            result[key] = key;
        });
        return result;
    }
    exports.splitStr2Obj = splitStr2Obj;
    function unique(arr) {
        var tmpl = {};
        var result = [];
        arr.forEach(function (item) {
            if (!(item in tmpl)) {
                tmpl[item] = 1;
                result.push(item);
            }
        });
        return result;
    }
    exports.unique = unique;
    function uniqueVn(arr) {
        var tmpl = {};
        var result = [];
        arr.forEach(function (item) {
            if (!(item.id in tmpl)) {
                tmpl[item.id] = 1;
                result.push(item);
            }
        });
        return result;
    }
    exports.uniqueVn = uniqueVn;
    function has(obj, key) {
        return obj != null && hasOwnProperty.call(obj, key);
    }
    var _isWindow = function (obj) {
        if (!obj)
            return false;
        return obj == obj.document && obj.document != obj;
    };
    if (!_isWindow(window)) {
        _isWindow = function (obj) {
            return rwindow.test(TOSTRING.call(obj));
        };
    }
    exports.isWindow = _isWindow;
    function isPlainObject(obj, key) {
        if (!obj || !isObject(obj) || obj.nodeType || exports.isWindow(obj)) {
            return false;
        }
        try {
            if (obj.constructor && !has(obj, "constructor") && !has(obj.constructor.prototype, "isPrototypeOf")) {
                return false;
            }
        }
        catch (e) {
            return false;
        }
        return key === void 0 || has(obj, key);
    }
    exports.isPlainObject = isPlainObject;
    function extend() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var src;
        var copyIsArray;
        var copy;
        var name;
        var options;
        var clone;
        var i = 1;
        var deep = false;
        var target = args[0] || {};
        var length = args.length;
        if (typeof target === "boolean") {
            deep = target;
            target = arguments[1] || {};
            i = 2;
        }
        if (typeof target !== "object" && !exports.isFunction(target)) {
            target = {};
        }
        if (length === i) {
            target = this;
            --i;
        }
        for (; i < length; i++) {
            if ((options = arguments[i]) != null) {
                for (name in options) {
                    src = target[name];
                    copy = options[name];
                    if (target === copy) {
                        continue;
                    }
                    if (deep && copy && (isPlainObject(copy) || (copyIsArray = exports.isArray(copy)))) {
                        if (copyIsArray) {
                            copyIsArray = false;
                            clone = src && exports.isArray(src) ? src : [];
                        }
                        else {
                            clone = src && isPlainObject(src) ? src : {};
                        }
                        target[name] = extend(deep, clone, copy);
                    }
                    else if (copy !== undefined) {
                        target[name] = copy;
                    }
                }
            }
        }
        return target;
    }
    exports.extend = extend;
    function parsePath(path) {
        return path.match(/[^\.\[\]]+/g);
    }
    exports.parsePath = parsePath;
    function readData(data, path) {
        var aPath = parsePath(path);
        if (data && aPath && aPath.length) {
            aPath.forEach(function (key) {
                data = data && isDefined(data[key]) ? data[key] : null;
            });
            return data;
        }
        return null;
    }
    exports.readData = readData;
    function setData(data, val, path) {
        var _data = data;
        var key, i = -1;
        var aPath = parsePath(path);
        var len = aPath.length;
        try {
            while (++i < len) {
                key = aPath[i];
                if (i === len - 1) {
                    _data = _data[key] = val;
                }
                else {
                    _data = isDefined(_data[key])
                        ? _data[key] = _data[key]
                        : _data[key] = {};
                }
            }
        }
        catch (err) {
            console.log(err);
        }
    }
    exports.setData = setData;
    exports.nextTick = (function () {
        var nextTasks = [];
        var nextHandler;
        var Promise = window['Promise'];
        var setImmediate = window["setImmediate"];
        var isNativePromise = typeof Promise === 'function' && /native code/.test(Promise.toString());
        return function (fn, thisArg) {
            if (thisArg) {
                fn = function () {
                    fn.apply(thisArg);
                };
            }
            nextTasks.push(fn);
            if (nextHandler) {
                return;
            }
            nextHandler = function () {
                var tasks = nextTasks.slice(0);
                nextTasks.length = 0;
                nextHandler = null;
                for (var i = 0, l = tasks.length; i < l; i++) {
                    tasks[i]();
                }
            };
            if (typeof setImmediate === 'function') {
                setImmediate(nextHandler);
            }
            else if (typeof MessageChannel === 'function') {
                var channel = new MessageChannel();
                var port = channel.port2;
                channel.port1.onmessage = nextHandler;
                port.postMessage(1);
            }
            else if (isNativePromise) {
                Promise.resolve().then(nextHandler);
            }
            else {
                setTimeout(nextHandler, 0);
            }
        };
    })();
    function kebabCase(str) {
        return str.replace(/([A-Z])/g, "-$1").toLowerCase();
    }
    exports.kebabCase = kebabCase;
    var nativeKeys = Object.keys;
    function values(obj) {
        var _keys = keys(obj);
        var length = _keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[_keys[i]];
        }
        return values;
    }
    function indexOf(obj, value, isSorted) {
        return obj.indexOf(value, isSorted);
    }
    function contains(obj, target, fromIndex) {
        if (obj == null)
            return false;
        if (obj.length !== +obj.length)
            obj = values(obj);
        return indexOf(obj, target, typeof fromIndex == 'number' && fromIndex) >= 0;
    }
    var hasEnumBug = !{ toString: null }.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
    function collectNonEnumProps(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var proto = typeof obj.constructor === 'function' ? FuncProto : ObjProto;
        while (nonEnumIdx--) {
            var prop = nonEnumerableProps[nonEnumIdx];
            if (prop === 'constructor' ? has(obj, prop) : prop in obj &&
                obj[prop] !== proto[prop] && !contains(keys, prop)) {
                keys.push(prop);
            }
        }
    }
    function keys(obj) {
        if (!isObject(obj))
            return [];
        if (nativeKeys)
            return nativeKeys(obj);
        var keys = [];
        for (var key in obj)
            if (has(obj, key))
                keys.push(key);
        if (hasEnumBug)
            collectNonEnumProps(obj, keys);
        return keys;
    }
    exports.keys = keys;
    function equal(a, b, aStack, bStack) {
        if (aStack === void 0) { aStack = []; }
        if (bStack === void 0) { bStack = []; }
        if (a === b)
            return a !== 0 || 1 / a === 1 / b;
        if (a == null || b == null)
            return a === b;
        var className = toString.call(a);
        if (className !== toString.call(b))
            return false;
        switch (className) {
            case "[object RegExp]":
            case "[object String]":
                return "" + a === "" + b;
            case "[object Number]":
                if (+a !== +a)
                    return +b !== +b;
                return +a === 0 ? 1 / +a === 1 / b : +a === +b;
            case "[object Date]":
            case "[object Boolean]":
                return +a === +b;
        }
        var areArrays = className === "[object Array]";
        if (!areArrays) {
            if (typeof a != "object" || typeof b != "object")
                return false;
            var aCtor = a.constructor;
            var bCtor = b.constructor;
            if (aCtor !== bCtor && !(exports.isFunction(aCtor) && aCtor instanceof aCtor &&
                exports.isFunction(bCtor) && bCtor instanceof bCtor)
                && ('constructor' in a && 'constructor' in b)) {
                return false;
            }
        }
        var length = aStack.length;
        while (length--) {
            if (aStack[length] === a)
                return bStack[length] === b;
        }
        aStack.push(a);
        bStack.push(b);
        if (areArrays) {
            length = a.length;
            if (length !== b.length)
                return false;
            while (length--) {
                if (!equal(a[length], b[length], aStack, bStack))
                    return false;
            }
        }
        else {
            var _keys = keys(a);
            var key = void 0;
            length = _keys.length;
            if (keys(b).length !== length)
                return false;
            while (length--) {
                key = _keys[length];
                if (!(has(b, key) && equal(a[key], b[key], aStack, bStack)))
                    return false;
            }
        }
        aStack.pop();
        bStack.pop();
        return true;
    }
    exports.equal = equal;
    function strTrim(str) {
        return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    }
    exports.strTrim = strTrim;
});
