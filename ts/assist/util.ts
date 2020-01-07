const ObjProto = Object.prototype;
const FuncProto = Function.prototype;
const TOSTRING = ObjProto.toString;
const rword = /[^, ]+/g;
const rwindow = /^\[object (?:Window|DOMWindow|global)\]$/;
const hasOwnProperty = ObjProto.hasOwnProperty;

export function isDefined (obj: any): boolean {
    return obj !== undefined && obj !== null;
}
export function isObject (obj: any): boolean {
    const type = typeof obj;
    return type === 'object' || (
        type === 'function' && TOSTRING.call(obj) === '[object Object]'
    );
}
export const isArray = Array.isArray || function (obj: any): boolean {
    return TOSTRING.call(obj) === '[object Array]';
}
export function isString (obj: any): boolean {
    return TOSTRING.call(obj) === '[object String]';
}
export function isNumber (obj: any): boolean {
    return TOSTRING.call(obj) === '[object Number]';
}
export function isBoolean (obj: any): boolean {
    return obj === true || obj === false || TOSTRING.call(obj) === '[object Boolean]';
}
export const isFunction = typeof alert === "object" ?
    function (obj: any): boolean {
        try {
            return /^\s*\bfunction\b/.test(obj + "")
        } catch (e) {
            return false;
        }
    } :
    function (obj: any): boolean {
        return TOSTRING.call(obj) === "[object Function]";
    }
/**
 * 用逗号将字符串分割
 * @param source 
 */
export function splitStr2Obj(source: string): {[key: string]: string}{
    const result = {};
    source.match(rword).forEach(key => {
        result[key] = key;
    })
    return result;
}
/**
 * 去除字符串数组和数字数组重复项
 * @param arr 
 */
export function unique (arr: Array<string|number>) {
    const tmpl = {};
    const result = [];
    arr.forEach(item => {
        if (!(item in tmpl)) {
            tmpl[item] = 1;
            result.push(item);
        }
    })
    return result;
}
/**
 * 去除重复vn
 * @param arr 
 */
export function uniqueVn (arr: Array<vNode>): Array<vNode> {
    const tmpl = {};
    const result = [];
    arr.forEach(item => {
        if (!(item.id in tmpl)) {
            tmpl[item.id] = 1;
            result.push(item);
        }
    })
    return result;
}

/**
 * 判断对象自身是否包含key属性
 * @param obj 
 * @param key 
 */
function has (obj: Object, key: string) {
    return obj != null && hasOwnProperty.call(obj, key);
}
/**
 * 判断是否是window对象
 * @param obj 
 */
let _isWindow = function (obj: any): boolean {
    if (!obj) return false;
    // 利用IE678 window == document为true,document == window竟然为false的神奇特性
    return obj == obj.document && obj.document != obj;
}

// 补充标准浏览器window对象检测
if (!_isWindow(window)) {
    _isWindow = function(obj) {
        return rwindow.test(TOSTRING.call(obj))
    };
}
export const isWindow = _isWindow;
/**
 * 是否是javascript对象
 * @param obj 
 * @param key 
 */
export function isPlainObject (obj: any, key?: string) {
    if (!obj || !isObject(obj) || obj.nodeType || isWindow(obj)) {
        return false;
    }
    try { //IE内置对象没有constructor
        if (obj.constructor && ! has(obj, "constructor") && ! has(obj.constructor.prototype, "isPrototypeOf")) {
            return false;
        }
    } catch (e) { //IE8 9会在这里抛错
        return false;
    }
    return key === void 0 || has(obj, key)
}
/**
 * 对象拷贝
 * @param args 
 */
export function extend<T>(...args): T{
    let src;
    let copyIsArray;
    let copy;
    let name;
    let options;
    let clone;
    let i = 1;
    let deep = false;
    let target = args[0] || {};
	const length = args.length;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction(target) ) {
		target = {};
	}

	if ( length === i ) {
		target = this;
		--i;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && isArray(src) ? src : [];

					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
}

export function parsePath (path: string): string[]{
    return path.match(/[^\.\[\]]+/g);
}
/**
 * 读取数据
 * @param data 
 * @param path 
 */
export function readData (data: Object, path: string){
    const aPath = parsePath(path);
    if (data && aPath && aPath.length) {
        aPath.forEach(key => {
            data = data && isDefined(data[key]) ? data[key] : null;
        })

        return data;
    } 
    return null;
}
/**
 * 设置数据
 * @param data 
 * @param val 
 * @param path 
 */
export function setData (data: Object, val: any, path: string){
    let _data = data;
    let key, i = -1;
    const aPath = parsePath(path);
    const len = aPath.length;
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

export const nextTick = (function (){
    /**
     * 下一个周期要执行的任务列表
     *
     * @inner
     * @type {Array}
     */
    const nextTasks = [];

    /**
     * 执行下一个周期任务的函数
     *
     * @inner
     * @type {Function}
     */
    let nextHandler;

    /**
     * 浏览器是否支持原生Promise
     * 对Promise做判断，是为了禁用一些不严谨的Promise的polyfill
     *
     * @inner
     * @type {boolean}
     */
    const Promise = window['Promise'];
    const setImmediate = window["setImmediate"]
    const isNativePromise = typeof Promise === 'function' && /native code/.test(Promise.toString());

    /**
     * 在下一个时间周期运行任务
     *
     * @inner
     * @param {Function} fn 要运行的任务函数
     * @param {Object=} thisArg this指向对象
     */
    return function (fn: () => void, thisArg?) {
        if (thisArg) {
            fn = function (){
                fn.apply(thisArg);
            }
        }
        nextTasks.push(fn);

        if (nextHandler) {
            return;
        }

        nextHandler = function () {
            const tasks = nextTasks.slice(0);
            nextTasks.length = 0;
            nextHandler = null;

            for (let i = 0, l = tasks.length; i < l; i++) {
                tasks[i]();
            }
        };

        // 非标准方法，但是此方法非常吻合要求。
        /* istanbul ignore next */
        if (typeof setImmediate === 'function') {
            setImmediate(nextHandler);
        }
        // 用MessageChannel去做setImmediate的polyfill
        // 原理是将新的message事件加入到原有的dom events之后
        else if (typeof MessageChannel === 'function') {
            const channel = new MessageChannel();
            const port = channel.port2;
            channel.port1.onmessage = nextHandler;
            port.postMessage(1);
        }
        // for native app
        else if (isNativePromise) {
            Promise.resolve().then(nextHandler);
        }
        else {
            setTimeout(nextHandler, 0);
        }
    }
})()

/**
 * 驼峰命名转 短横线命名
 * @param str 
 */
export function kebabCase (str: string){
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
const nativeKeys = Object.keys;
function values(obj) {
    const _keys = keys(obj);
    const length = _keys.length;
    const values = Array(length);
    for (let i = 0; i < length; i++) {
        values[i] = obj[_keys[i]];
    }
    return values;
}
function indexOf(obj, value, isSorted) {
    return obj.indexOf(value, isSorted);
}
function contains(obj, target, fromIndex?) {
    if (obj == null)
        return false;
    if (obj.length !== +obj.length)
        obj = values(obj);
    return indexOf(obj, target, typeof fromIndex == 'number' && fromIndex) >= 0;
}
const hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
const nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
function collectNonEnumProps(obj, keys) {
    let nonEnumIdx = nonEnumerableProps.length;
    const proto = typeof obj.constructor === 'function' ? FuncProto : ObjProto;
    while (nonEnumIdx--) {
        const prop = nonEnumerableProps[nonEnumIdx];
        if (prop === 'constructor' ? has(obj, prop) : prop in obj &&
            obj[prop] !== proto[prop] && !contains(keys, prop)) {
            keys.push(prop);
        }
    }
}
export function keys (obj: any) {
    if (!isObject(obj))
        return [];
    if (nativeKeys)
        return nativeKeys(obj);
    const keys = [];
    for (let key in obj)
        if (has(obj, key))
            keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug)
        collectNonEnumProps(obj, keys);
    return keys;
}
export function equal (a: any, b: any, aStack = [], bStack = []) {
    // 0 -0
    if (a === b)
        return a !== 0 || 1 / a === 1 / b;
    // null undefined
    if (a == null || b == null)
        return a === b;
    // 类型 对比
    const className = toString.call(a);
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
    const areArrays = className === "[object Array]";
    if (!areArrays) {
        if (typeof a != "object" || typeof b != "object")
            return false;
        const aCtor = a.constructor;
        const bCtor = b.constructor;
        if (aCtor !== bCtor && !(isFunction(aCtor) && aCtor instanceof aCtor &&
            isFunction(bCtor) && bCtor instanceof bCtor)
            && ('constructor' in a && 'constructor' in b)) {
            return false;
        }
    }
    let length = aStack.length;
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
        const _keys = keys(a)
        let key;
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

export function strTrim (str: string): string {
    return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}