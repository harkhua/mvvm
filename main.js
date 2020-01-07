define(["require", "exports", "./assist/store", "./assist/ini", "./assist/helper", "./assist/util", "./parse/vNode", "./parse/dir"], function (require, exports, store_1, ini_1, helper_1, util_1, vNode_1, Dir) {
    "use strict";
    exports.__esModule = true;
    function processorWatchs(mvvm, watchs) {
        store_1.Store.save(mvvm.channel, 'watchs', watchs);
        var fn;
        var _loop_1 = function (name_1) {
            fn = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                watchs[name_1].apply(mvvm, args);
            };
            store_1.Store.on(name_1, fn);
        };
        for (var name_1 in watchs) {
            _loop_1(name_1);
        }
    }
    function processorMethods(data, methods) {
        var _methods = {};
        var _loop_2 = function (name_2) {
            _methods[name_2] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                methods[name_2].apply(data, args);
            };
        };
        for (var name_2 in methods) {
            _loop_2(name_2);
        }
        return _methods;
    }
    var Mvvm = (function () {
        function Mvvm(opts) {
            opts.beforeCreate && opts.beforeCreate.call(this);
            var data = util_1.isFunction(opts.data) ?
                opts.data() :
                opts.data;
            var mChannel = this.channel = ini_1.channel + "|" + helper_1.getMvvmId();
            store_1.Store.save(mChannel, 'data', data || {});
            store_1.Store.save(mChannel, 'mvvm', this);
            store_1.Store.save(mChannel, 'dataPathToVn', {});
            opts.methods && store_1.Store.save(mChannel, 'methods', processorMethods(data, opts.methods));
            opts.computed && store_1.Store.save(mChannel, 'computed', opts.computed);
            processorWatchs(this, opts.watch || {});
            opts.created && opts.created.call(this);
            var tpl = opts.template;
            var mount = opts.mount && helper_1.Dom.getElment(opts.mount)[0];
            if (opts.el) {
                mount = this.mount = helper_1.Dom.getElment(opts.el)[0];
                if (mount) {
                    tpl = mount.innerHTML;
                    helper_1.Dom.empty(mount);
                }
            }
            if (!tpl) {
                return;
            }
            this.template = tpl;
            var vns = this.vNode = vNode_1.parseVNode(tpl, mChannel);
            vns.el = mount;
            Dir.parse(vns.children);
            mount.appendChild(helper_1.Vnode.toDom(vns));
        }
        Mvvm.prototype.set = function (path, data) {
            var mChannel = this.channel;
            var oData = store_1.Store.read(mChannel, 'data');
            util_1.nextTick(function () {
                store_1.Store.emit(path, data, util_1.readData(oData, path));
            });
            util_1.setData(oData, data, path);
            var pathToVn = store_1.Store.read(mChannel, 'dataPathToVn');
            var depVns = [];
            depVns = pathToVn[path] || [];
            if (!depVns.length) {
                for (var _path in pathToVn) {
                    if (_path.indexOf(path) === 0) {
                        depVns = depVns.concat(pathToVn[_path]);
                    }
                }
            }
            util_1.uniqueVn(depVns).forEach(function (vn) {
                for (var dirName in vn.dep) {
                    Dir[dirName].update(vn, data);
                }
            });
        };
        Mvvm.prototype.get = function (path) {
            return util_1.readData(store_1.Store.read(this.channel, 'data'), path);
        };
        Mvvm.prototype.watch = function (path, cb) {
            var _this = this;
            store_1.Store.on(path, function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                cb.apply(_this, args);
            });
        };
        return Mvvm;
    }());
    exports.Mvvm = Mvvm;
});
