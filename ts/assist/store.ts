import { isFunction } from "./util";

type cb = (...args) => void;
interface events {
    [key: string]: cb[]
}
export namespace Store {
    const __CACHE__ = {
        __events__: {} as events
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

    export function setChannel(channel:string, map) {
        if (!channel) {return }
        __CACHE__[channel] = map;
    }

    export function mixChannel(channel:string, map) {
        if (!channel) {return}
        let cache = __CACHE__[channel];
        __CACHE__[channel] = mix(cache, map);
    }

    export function save(channel:string, key:string, data:any) {
        if (channel in __CACHE__) {
            __CACHE__[channel][key] = data;
        } else {
            __CACHE__[channel] = {
                [key]: data
            }
        }
    }
    
    export function read(channel:string, key?:string) {
        if (channel in __CACHE__) {
            return key ? __CACHE__[channel][key] : __CACHE__[channel];
        }
    }
    /**
     * 事件相关处理
     */
    /**
     * 事件绑定
     * @param eventName 
     * @param callback 
     */
    export function on (eventName: string, callback: cb){
        const events = __CACHE__.__events__;
        if (eventName in events) {
            events[eventName].push(callback);
        } else {
            events[eventName] = [callback];
        }
    }
    /**
     * 事件执行
     * @param eventName 
     * @param args 
     */
    export function emit (eventName: string, ...args){
        const events = __CACHE__.__events__;

        if (eventName in events) {
            const delIdx = [];
            const ents = events[eventName];
            ents.forEach((cb: cb, idx: number) => {
                try {
                    isFunction(cb) && cb.apply(cb, args);
                    if (cb["once"]) {
                        delIdx.push(idx);
                    }
                } catch (e) {
                    console.log(e);
                }
            });
            // 处理只执行一次函数
            if (delIdx.length) {
                let i = delIdx.length;
                while (--i >= 0) {
                    ents.splice(delIdx[i], 1)
                }
            }
        }
    }
    /**
     * 事件解绑
     * @param eventName 
     */
    export function off (eventName: string){
        const events = __CACHE__.__events__;
        if (!(eventName in events)) return;
        delete events[eventName];
    }
    /**
     * 单次执行事件绑定
     * @param eventName 
     * @param callback 
     */
    export function once (eventName: string, callback: cb){
        callback["once"] = true;
        on(eventName, callback);
    }
}