import { Store } from "./assist/store";
import { channel, clockCls } from "./assist/ini";
import { getMvvmId, Dom, Vnode } from "./assist/helper";
import { isFunction, setData, uniqueVn, readData, nextTick } from "./assist/util";
import { parseVNode } from "./parse/vNode";
import * as Dir from "./parse/dir";
/**
 * 处理数据监听事件
 * @param channel 
 * @param watchs 
 */
function processorWatchs (mvvm: Mvvm, watchs: {[key: string]: watchFn}){
    Store.save(mvvm.channel, 'watchs', watchs);
    let fn;
    for (let name in watchs){
        fn = function (...args){
            watchs[name].apply(mvvm, args);
        }
        Store.on(name, fn);
    }
}
function processorMethods (
    data: anyMap, 
    methods: {[key: string]: (...args) => void}
) {
    const _methods = {};
    for(let name in methods) {
        _methods[name] = function (...args) {
            methods[name].apply(data, args);
        }
    }
    return _methods;
}
export class Mvvm {
    channel: string; // 类缓存渠道
    mount: HTMLElement;
    template: string;
    vNode: vNode;
    constructor (opts: mvvmCfg){
        // 初始化前
        opts.beforeCreate && opts.beforeCreate.call(this);
        // 初始化
        const data = isFunction(opts.data) ? 
            (opts.data as () => anyMap)() : 
            opts.data as anyMap;

        const mChannel = this.channel = `${channel}|${getMvvmId()}`;
        // 缓存数据
        Store.save(mChannel, 'data', data || {});
        // 缓存实例类
        Store.save(mChannel, 'mvvm', this);
        // 缓存数据path对应vnode
        Store.save(mChannel, 'dataPathToVn', {});
        // 缓存事件
        opts.methods && Store.save(
            mChannel,
            'methods',
            processorMethods(data, opts.methods)
        );
        // 缓存computed
        opts.computed && Store.save(mChannel, 'computed', opts.computed);
        // 处理数据监听事件
        processorWatchs(this, opts.watch || {});
        // 初始化完成后
        opts.created && opts.created.call(this);

        // 解析节点
        let tpl = opts.template;
        let mount = opts.mount && Dom.getElment(opts.mount)[0];
        if (opts.el) {
            mount = this.mount = Dom.getElment(opts.el)[0];
            if (mount) {
                tpl = mount.innerHTML;
                Dom.empty(mount);
            }
        }

        if (!tpl) {
            return;
        }
        this.template = tpl;
        const vns = this.vNode = parseVNode(tpl, mChannel);
        vns.el = mount;
        // 处理指令
        Dir.parse(vns.children);
        // 挂载回节点
        mount.appendChild(Vnode.toDom(vns));
        Dom.removeClass(mount, clockCls);
    }
    /**
     * 设置数据
     * @param path 
     * @param data 
     */
    set (path: string, data?){
        /**
         * 1、通过路径获取对应虚拟节点
         * 2、通过id去除重复虚拟节点
         * 3、获取解析指令
         * 4、重新解析指令后调用 update函数
         * 5、更新数据
         */
        const mChannel = this.channel
        const oData = Store.read(mChannel, 'data');
        nextTick(function (){
            Store.emit(path, data, readData(oData, path))
        })
        setData(oData, data, path);

        const pathToVn = Store.read(mChannel, 'dataPathToVn');
        let depVns = [] as vNode[];
        depVns = pathToVn[path] || [];
        if (!depVns.length) {
            for (let _path in pathToVn) {
                if (_path.indexOf(path) === 0) {
                    depVns = depVns.concat(pathToVn[_path]);
                }
            }
        }
        uniqueVn(depVns).forEach(vn => {
            for (let dirName in vn.dep){
                Dir[dirName].update(vn, data);
            }
        });
    }
    /**
     * 获取数据
     * @param path 
     */
    get (path: string){
        return readData(
            Store.read(this.channel, 'data'), 
            path
        );
    }
    watch (path: string, cb: watchFn) {
        Store.on(path, (...args) => {
            cb.apply(this, args);
        });
    }
}