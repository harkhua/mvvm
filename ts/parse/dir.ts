import { Vnode, Dom } from "../assist/helper";
import { Store } from "../assist/store";
import { isDefined, unique, isArray, extend, readData, isString, isBoolean, kebabCase, parsePath, nextTick, setData, strTrim } from "../assist/util";
import { parseVNode } from "./vNode";

const leftSpace = "{{";
const rightSpace = "}}";
const textReg = /{{([\s\S]+?)}}/;
const RFILTERS = /[^|]\|\s*(\w+)\s*(\([^)]*\))?/g;
const textMark = /([^a-zA-z_$\d\.\[\]]+)/g;
const dirRe = /^v-|^@|^:/;
const onRe = /^@|^v-on:?/;
const bindRe = /^:|^v-bind:?/;
const ifRe = /^v-(if|else-if|else)$/;
const modifierRe = /\.[^.\]]+(?=[^\]]*$)/g;
/**
 * 解析{{}}文本
 * @param str 
 */
function parseExpr (str: string){
    const result = [];
    if (textReg.test(str)) {
        let val, start = 0, stop;
        do {
            stop = str.indexOf(leftSpace, start);
            if (stop === -1) break;

            val = str.slice(start, stop);
            if (val) {
                result.push({
                    expr: val
                })
            }
            // 计算开始位置
            start = stop + leftSpace.length;
            // 查找结束位置
            stop = str.indexOf(rightSpace, start);
            if (stop === -1) break;
            // 拿到space中间字符串
            val = str.slice(start, stop);

            if (val) {
                // 预留过滤
                const leach = []
                if (val.indexOf("|") > 0) { // 注意排除短路与
                    val = val.replace(RFILTERS, function(c, d, e) {
                        leach.push(d + (e || ""))
                        return c.charAt(0)
                    })
                }
                result.push({
                    value: val,
                    expr: true,
                    filters: leach.length ? leach : void 0
                })
            }

            start = stop + rightSpace.length;

        } while(true);

        val = str.slice(start)
        if (val) { //}} 右边的文本
            result.push({
                expr: val
            })
        }
    }

    return result;
}
/**
 * 根据对应path存入对应vNode
 * @param paths 
 * @param vn 
 */
function saveVnToDataPath (paths: string[], vn: vNode){
    const oDataPathToVn = Store.read(vn.channel, "dataPathToVn");
    paths.forEach (path => {
        if (!oDataPathToVn[path]) {
            oDataPathToVn[path] = [];
        }
        path && oDataPathToVn[path].push(vn);
    })
}
/**
 * 获取指令的local data
 * @param vn 
 */
function getLocalData (vn: vNode){
    if (vn.localData) {
        return vn.localData
    }
    if (!vn.parent) {
        return null;
    }
    return getLocalData(vn.parent);
}
function getRealDataPath (vn: vNode, path: string, dirKey?: string): string[]{
    const paths = path.replace(textMark, ',').split(',');

    if (vn.isForDir) {
        const localData = getLocalData (vn);
        return paths.map(p => {
            return localData ? p.replace(
                localData.$__vn__.dep[dirKey || 'VFor'][0].item, 
                localData.path
            ) : p
        });
    }
    return paths;
}
/**
 * 解析出具体 参数名
 * @param code 
 */
function getVariables (code: string){
    // const keywords =
    //     // 关键字
    //     'break,case,catch,continue,debugger,default,delete,do,else,false' + ',finally,for,function,if,in,instanceof,new,null,return,switch,this' + ',throw,true,try,typeof,var,void,while,with'

    //     // 保留字
    //     + ',abstract,boolean,byte,char,class,const,double,enum,export,extends' + ',final,float,goto,implements,import,int,interface,long,native' + ',package,private,protected,public,short,static,super,synchronized' + ',throws,transient,volatile'

    //     // ECMA 5 - use strict
    //     + ',arguments,let,yield'

    //     + ',undefined';
    const rrexpstr = /\/\*(?:.|\n)*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|'[^']*'|"[^"]*"|[\s\t\n]*\.[\s\t\n]*[$\w\.]+/g
    const rsplit = /[^\w$]+/g;
    const rkeywords = /\bbreak\b|\bcase\b|\bcatch\b|\bcontinue\b|\bdebugger\b|\bdefault\b|\bdelete\b|\bdo\b|\belse\b|\bfalse\b|\bfinally\b|\bfor\b|\bfunction\b|\bif\b|\bin\b|\binstanceof\b|\bnew\b|\bnull\b|\breturn\b|\bswitch\b|\bthis\b|\bthrow\b|\btrue\b|\btry\b|\btypeof\b|\bvar\b|\bvoid\b|\bwhile\b|\bwith\b|\babstract\b|\bboolean\b|\bbyte\b|\bchar\b|\bclass\b|\bconst\b|\bdouble\b|\benum\b|\bexport\b|\bextends\b|\bfinal\b|\bfloat\b|\bgoto\b|\bimplements\b|\bimport\b|\bint\b|\binterface\b|\blong\b|\bnative\b|\bpackage\b|\bprivate\b|\bprotected\b|\bpublic\b|\bshort\b|\bstatic\b|\bsuper\b|\bsynchronized\b|\bthrows\b|\btransient\b|\bvolatile\b|\barguments\b|\blet\b|\byield\b|\bundefined\b/g;
    const rnumber = /\b\d[^,]*/g;
    const rcomma = /^,+|,+$/g;
    code = code
        .replace(rrexpstr, '')
        .replace(rsplit, ',')
        .replace(rkeywords, '')
        .replace(rnumber, '')
        .replace(rcomma, '');

    return code ? code.split(/,+/) : []
}
/**
 * 获取随机参数名
 * @param name 
 */
function getDataName (name: string){
    return `Z_${name}${new Date().getTime()}`;
}
/**
 * 从data中获取对应解析值
 * @param vn
 * @param val 
 */
function getExprVal (vn: vNode, val: string) {
    const aVars = unique(getVariables(val));
    if (!aVars.length) {
        return val;
    }
    const assigns = [];
    const dataName = [];
    const store = [];
    aVars.forEach((item, idx) => {
        dataName.push(getDataName(item))
        assigns.push(`${item}=${dataName[idx]}.${item}`);
        store.push(getData(vn, item))
    })
    dataName.push(`\nvar ${assigns.join(",")}; \nreturn ${val}`);
    const fn = Function.apply(Function, dataName);

    try {
        return fn.apply(fn, store);
    } catch (e) {
        // console.log(e);
        return null;
    }

}
/**
 * 获取数据源
 * @param vn 
 * @param path 
 */
function getData (vn: vNode, path: string) {
    const firstPath = parsePath(path)[0]
    const baseData = getLocalData(vn);
    if (baseData && firstPath in baseData) {
        return baseData;
    }
    const globalData = Store.read(vn.channel, 'data');
    if (globalData && firstPath in globalData) {
        return globalData
    }
    const computeds = Store.read(vn.channel, 'computed');
    if (computeds && firstPath in computeds) {
        return {}[path] = computeds[firstPath].call(globalData);
    }
    return null;
}
/**
 * 复制节点
 * @param vn 
 * @param parent 
 */
function copyVn (vn: vNode, parent?: vNode) {
    const newVn = {
        id: Vnode.getId(),
        attr: vn.attr ? extend(true, {}, vn.attr) : {},
        dir: vn.attr ? extend(true, {}, vn.dir) : {},
        name: vn.name,
        isForDir: true,
        children: [],
        channel: vn.channel,
        localData: null,
        text: vn.text || null,
        dep: vn.attr ? extend(true, {}, vn.dep) : {},
        parent: parent || vn.parent,
        forEndVn: vn.endVn || null,
    } as vNode;

    if (vn.children && vn.children.length) {
        vn.children.forEach (child => {
            newVn.children.push(
                copyVn(child, newVn)
            )
        })
    }
    return newVn;
}
/**
 * 处理虚拟节点变动
 * @param oldVn 
 * @param newVn 
 * @param beforeInsert 
 */
function patchVnode (oldVn: vNode, newVn: vNode, beforeInsert?: Node){
    if (oldVn === newVn || newVn.noParse) return;
    const elem = newVn.el = oldVn.el;
    
    const oldCh = oldVn.children;
    const ch = newVn.children;

    if (!isDefined (newVn.text)) {
        if (isDefined(oldCh) && isDefined(ch) && oldCh.length && ch.length) { // 新旧vnode都存在 子vnode
            updateChildren(elem, oldCh, ch, beforeInsert);
        } else if (isDefined(oldCh) && oldCh.length) { // 只有旧vnode 存在子vnode
            // 清空子节点
            oldCh.length = 0;
            // 清空dom子节点
            Dom.removeNode(elem);
        } else if (isDefined(ch)) {
            // 添加子节点
            Vnode.addVnodes(elem, null, ch, 0, ch.length - 1);
        } else if (isDefined(oldVn.text)) { // 若都不存在，且oldVn有text，则清空文本内容
            Dom.setTextContent(elem, '');
            oldVn.text = '';
        }
    } else if (newVn.text !== oldVn.text) {
        Dom.setTextContent(elem, newVn.text);
        oldVn.text = newVn.text;
    }
}
function createOldIdxMap (children: vNode[], beginIdx: number, endIdx: number){
    let i, key;
    const map = {};
    for (i = beginIdx; i <= endIdx; ++i) {
        key = children[i]._idx;
        if (isDefined(key)) {
            map[key] = i;
        }
    }
    return map
}
function findIdxInOld (node: vNode, oldCh: vNode[], start: number, end: number){
    for (let i = start; i < end; i++) {
        const c = oldCh[i];
        if (isDefined(c) && Vnode.sameVnode(node, c)) {
            return i;
        }
    }
}
function updateChildren (elem: Node, oldCh: vNode[], ch: vNode[], beforeInsert?: Node) {
    let newStartIdx = 0,
        oldStartIdx = 0,
        newEndIdx = ch.length - 1,
        oldEndIdx = oldCh.length - 1,
        newStartVnode = ch[newStartIdx],
        oldStartVnode = oldCh[oldStartIdx],
        newEndVnode = ch[newEndIdx],
        oldEndVnode = oldCh[oldEndIdx];
    let oldIdxMap, idxInOld, vnodeToMove, refElm;

    while(oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
        if (!isDefined(oldStartVnode)) {
            oldStartVnode = oldCh[++oldStartIdx]
        } else if (!isDefined(oldEndVnode)) {
            oldEndVnode = oldCh[--oldEndIdx]
        // 下面四个if两两对比新旧vnode的头尾
        } else if (Vnode.sameVnode(oldStartVnode, newStartVnode)) {
            patchVnode(oldStartVnode, newStartVnode, beforeInsert)
            newStartVnode = ch[++newStartIdx]
            oldStartVnode = oldCh[++oldStartIdx]
        } else if (Vnode.sameVnode(oldEndVnode, newEndVnode)) {
            patchVnode(oldEndVnode, newEndVnode, beforeInsert)
            newEndVnode = ch[--newEndIdx]
            oldEndVnode = oldCh[--oldEndIdx]
        } else if (Vnode.sameVnode(oldStartVnode, newEndVnode)) {
            patchVnode(oldStartVnode, newEndVnode, beforeInsert)
            Dom.insertBefore(elem, oldStartVnode.el, Dom.nextSibling(oldEndVnode.el))
            oldStartVnode = oldCh[++oldStartIdx]
            newEndVnode = ch[--newEndIdx]
        } else if (Vnode.sameVnode(oldEndVnode, newStartVnode)) {
            patchVnode(oldEndVnode, newStartVnode, beforeInsert)   
            Dom.insertBefore(elem, oldEndVnode.el, oldStartVnode.el)
            oldEndVnode = oldCh[--oldEndIdx]
            newStartVnode = ch[++newStartIdx]
        } else {
            if (!isDefined(oldIdxMap)) {
                oldIdxMap = createOldIdxMap(oldCh, oldStartIdx, oldEndIdx);
            }
            oldIdxMap = isDefined(newStartVnode._idx) 
                ? oldIdxMap[newStartVnode._idx]
                : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
            if (!isDefined(idxInOld)) { // New element
                Vnode.addVn(newStartVnode, elem, oldStartVnode.el, ch, newStartIdx);
            } else {
                vnodeToMove = oldCh[idxInOld];
                if (Vnode.sameVnode(vnodeToMove, newStartVnode)) {
                    patchVnode(vnodeToMove, newStartVnode, beforeInsert);
                    oldCh[idxInOld] = undefined;
                } else {
                    // same key but different element. treat as new element
                    Vnode.addVn(newStartVnode, elem, oldStartVnode.el, ch, newStartIdx);
                }
            }
            newStartVnode = ch[++newStartIdx];
        }
    }
    // 循环结束，若oldStartIdx大于oldEndIdx，说明剩余的newVnode是多出来的，调用addVnodes添加到文档中；
    // 若newStartIdx > newEndIdx, 则说明剩余的oldVnode是多余的，调用removeVnodes方法删除。
    if (oldStartIdx > oldEndIdx) {
        const oldEndVn = oldCh[oldEndIdx];
        refElm = isDefined(oldEndVn) ? 
            Dom.nextSibling(oldEndVn.el) : 
            beforeInsert;
        Vnode.addVnodes(elem, refElm, ch, newStartIdx, newEndIdx);
    } else if (newStartIdx > newEndIdx) {
        Vnode.removeVnodes(elem, oldCh, oldStartIdx, oldEndIdx)
    }
}
/**
 * 解析bind值
 * @param obj 
 */
function parseBind (name: string, obj: any, result?: {[key: string]: any}){
    if (!result) {
        result = {};
    }
    if (name) {
        !result[name] && (result[name] = []);
        if (isArray(obj)) {
            obj.forEach(item => {
                parseBind(name, item, result);
            })
        } else if (isString(obj)) {
            result[name].push(obj);
        } else {
            for (let key in obj) {
                if (isBoolean(obj[key])) {
                    obj[key] && result[name].push(key);
                } else {
                    if (name === 'style') {
                        parseBind(name, `${kebabCase(key)}: ${obj[key]}`, result);
                    } else {
                        parseBind(name, obj[key], result);
                    }
                }
            }
        }
    } else {
        for (let key in obj) {
            //!result[key] && (result[name] = []);
            parseBind(key, obj[key], result)
        }
    }
    
    return result;
}
/**
 * 解析事件指令修饰符
 * @param name 
 */
function parseModifiers (name: string) {
    const match = name.match(modifierRe);
    if (match) {
        const ret = {};
        match.forEach(m => { 
            ret[m.slice(1)] = true; 
        });
        return ret
    }
}
export namespace VText {
    export const dirKey = "VText";
    export function init (vn: vNode, value: string){
        if (vn.name !== '#text') {
            delete vn.dir["v-text"];
            vn.children.length = 0;
            const childVn = {
                id: Vnode.getId(),
                name: "#text",
                text: `{{${value.replace(textMark, '}}$1{{')}}}`,
                channel: vn.channel,
                dep: {},
                isForDir: vn.isForDir,
                parent: vn
            }
            vn.children.push(childVn);
            return;
        }
        parse(vn, value);
    }
    function parseTextVal (vn: vNode, oDirective: dirExpr){
        // 解析参数
        vn.text = (oDirective.value as Array<textExprVal>).map(exprVal => {
            if (!exprVal.expr) {
                return getExprVal(vn, exprVal.val)
            }
            return exprVal.val;
        }).join("");
    }
    export function parse (vn: vNode, value: string){
        if (!value) {
            return;
        }
        const exprs = parseExpr(value);
        if (exprs.length) {
            const oDirective = {
                value: [],
                expr: ''
            }

            while(exprs.length) {
                const expr = exprs.shift();
                if (expr.value) {
                    oDirective.value.push({
                        val: expr.value,
                        expr: false
                    });
                    saveVnToDataPath(
                        getRealDataPath(vn, expr.value), 
                        vn
                    );
                } else if (expr.expr){
                    oDirective.value.push({
                        val: expr.expr,
                        expr: true
                    });
                }
            }
            if (!vn.dep[dirKey]) {
                vn.dep[dirKey] = [];
            }
            vn.dep[dirKey].push(oDirective);
            parseTextVal(vn, oDirective);
        }
    }
    export function update (vn: vNode){
        parseTextVal(vn, vn.dep[dirKey][0]);
        // 更新dom text
        Dom.setTextContent(vn.el, vn.text);
    }
}
export namespace VHtml {
    export const dirKey = "VHtml";
    export function init (vn: vNode, value: string){
        parse(vn, value);
    }
    export function parse (vn: vNode, value: string){
        const tpl = getExprVal(vn, value);
        if (tpl) {
            vn.children = parseVNode(tpl, vn.channel).children;
            saveVnToDataPath(
                getRealDataPath(vn, value), 
                vn
            )
            if (!vn.dep[dirKey]) {
                vn.dep[dirKey] = [];
            }
            vn.dep[dirKey].push({
                value
            });
        }
    }
    export function update (vn: vNode, tpl: string){
        // const path = <string>vn.dep[dirKey][0].value;
        // const tpl = getExprVal(vn, path);
        if (tpl) {
            const newVn = parseVNode(tpl, vn.channel);
            parseItemVn(newVn);
            updateChildren(vn.el, vn.children, newVn.children);
            vn.children = newVn.children;
        }
    }
}
export namespace VBind {
    export const dirKey = "VBind";
    export function init (vn: vNode, value: string, name: string){
        name = name.replace(bindRe, '');
        saveVnToDataPath(
            getVariables(value), 
            vn
        )
        if (!vn.dep[dirKey]) {
            vn.dep[dirKey] = [];
        }
        vn.dep[dirKey].push({
            value: name,
            expr: value
        });
        // console.log(value);
        parse(vn, value, name);
    }
    export function parse (vn: vNode, value: string, name: string){
        const oBind = parseBind(
            name,
            getExprVal(vn, value)
        );
        let attrVals;
        for (let name in oBind) {
            attrVals = oBind[name];
            if (attrVals && attrVals.length) {
                vn.attr[name] = attrVals;
            }
        }
    }
    export function update (vn: vNode, newVal){
        const deps = vn.dep[dirKey];
        let oBind, name;
        deps.length && deps.forEach(depVal => {
            name = <string>depVal.value;
            oBind = parseBind(
                name,
                getExprVal(vn, <string>depVal.expr)
            )
            Vnode.setAttr(
                <HTMLElement>vn.el,
                name,
                oBind[name]
            )
        });
    }
}
export namespace VFor {
    export const dirKey = 'VFor';
    export function init (vn: vNode, value: string){
        value = value.replace(/[\(\)]/g, "");
        const match = /^\s*([\$0-9a-z_]+)(\s*,\s*([\$0-9a-z_]+))?\s+in\s+([\$0-9a-z_][\$0-9a-z_\.]+)/ig.exec(value);
        if (match) {
            const oDirective = {
                item: match[1],
                index: match[3] || "$index",
                value: match[4] // 待解析数据路径
            };
            if (!vn.dep[dirKey]) {
                vn.dep[dirKey] = [];
            }
            // vn -> dirDep -> dir expr -> dir update
            vn.dep[dirKey].push(oDirective);
            // data -> vn
            const baseData = getLocalData(vn);
            saveVnToDataPath([
                `${
                    baseData && baseData.$__vn__ ? `${
                        match[4].replace(
                            baseData.$__vn__.dep[dirKey][0].item, 
                            baseData.path
                        )
                    }` : match[4]
                }`
            ], vn);
            parse(vn, oDirective.value);
        }
    }
    function forDataToVn (
        vn: vNode, 
        data: any[], 
        callback: (newVn: vNode, item, idx: number) => void
    ) {
        const baseData = getLocalData(vn);
        const expr = vn.dep[dirKey][0];
        const path = <string>expr.value;
        data && data.length && data.forEach((item, idx) => {
            const newVn = copyVn(vn);
            const oLocalData = {
                path: `${
                    baseData && baseData.$__vn__ ? `${
                        path.replace(
                            baseData.$__vn__.dep[dirKey][0].item, 
                            baseData.path
                        )
                    }` : path
                }[${idx}]`,
                $__vn__: vn
            }
            oLocalData[expr.item] = item;
            oLocalData[expr.index] = idx;
            newVn.localData = oLocalData;
            callback(newVn, item, idx);
        })
    }
    export function parse (vn: vNode, path: string){
        const oData = getExprVal(vn, path);
        delete vn.dir['v-for'];
        const parentChildren = vn.parent.children;
        const vNodes = [];
        vn.noParse = true;
        const forEndVn = vn.endVn = <vNode>{
            id: Vnode.getId(),
            name: '#comment',
            text: `for${new Date().getTime()}`
        };
        parentChildren.splice(vn._idx + 1, 0, forEndVn);
        if (isArray(oData)) {
            forDataToVn(
                vn,
                oData,
                function (newVn, item, idx){
                    vNodes.push(newVn);
                    // 插入到虚拟节点中
                    parentChildren.splice(vn._idx + idx + 1, 0, newVn);
                }
            )
            vn.__forItemVns__ = vNodes;
        }
    }
    export function update (vn: vNode, newData){
        const oldVns = vn.__forItemVns__ || [];
        const newVns = [];
        if (isArray(newData)) {
            forDataToVn(
                vn,
                newData,
                function (newVn, item, idx) {
                    parseItemVn(newVn);
                    // Vnode.toDom(newVn);
                    newVn._idx = idx + 1;
                    newVns.push(newVn);
                }
            )
        }
        updateChildren(vn.parent.el, oldVns, newVns, (vn.endVn || <vNode>{}).el);
        vn.__forItemVns__ = newVns;
        // patchVnode(oldVns, newVns);
    }
}
export namespace VModel {
    function setInputChecked(el: HTMLInputElement, checkedData: string|string[]){
        const iptVal = el.value;
        if (isArray(checkedData)) {
            el.checked = (<string[]>checkedData).findIndex(val => {
                return val === iptVal;
            }) > -1;
            return;
        }
        el.checked = iptVal === <string>checkedData;
    }
    function setSelecteChecked(el: HTMLSelectElement, checkedData: string) {
        const children = el.children;
        let len = children.length;
        let child;
        while(len--) {
            child = children[len];
            child.selected = child.value === checkedData;
        }
    }
    const MODELPARSE = {
        "text": function (vn: vNode, path: string){
            VBind.init(vn, path, 'value');
            function iptValChanged (newVal: string){
                const Mvvvm = Store.read(vn.channel, 'mvvm');
                Mvvvm.set(
                    getRealDataPath(vn, path).join("."),
                    newVal
                )
            }
            nextTick(function (){
                const el = <HTMLInputElement>vn.el;
                Dom.bindEvent(
                    el,
                    'input',
                    function (e: Event){
                        iptValChanged(el.value)
                    }
                )
                Dom.bindEvent( // 兼容IE8
                    el,
                    'propertychange',
                    function (e: TransitionEvent){
                        if(e.propertyName == "value"){ // 只有属性值为value的变动才触发
                            iptValChanged(el.value)
                        }
                    }
                )
            });

        },
        "checkbox": function (vn: vNode, value: string){
            nextTick(function (){
                const el = <HTMLInputElement>vn.el;
                setInputChecked(el, getExprVal(vn, value));
                Dom.bindEvent(
                    el,
                    'change',
                    function (e: Event){
                        const checked = el.checked;
                        const iptVal = el.value;
                        let checkedData = getExprVal(vn, value);
                        let isSetVal = false;
                        if (isArray(checkedData)) {
                            const idx = checkedData.findIndex(val => {
                                return val === iptVal;
                            });
                            const isAdd = idx === -1 && checked;
                            const isDel = idx > -1 && !checked;
                            if (isAdd) { //add
                                checkedData.splice(
                                    checkedData.length - 1,
                                    0,
                                    iptVal
                                )
                            } else if (isDel){ // del
                                checkedData.splice(idx, 1)
                            }
                            isSetVal = isAdd || isDel;
                        } else {
                            isSetVal = checkedData !== iptVal;
                            checkedData = [checkedData, iptVal];
                        }
                        const Mvvvm = Store.read(vn.channel, 'mvvm');
                
                        isSetVal && Mvvvm.set(
                            getRealDataPath(vn, value).join("."),
                            checkedData
                        )
                    }
                )
            })
        },
        "radio": function (vn: vNode, value: string){
            nextTick(function (){
                const el = <HTMLInputElement>vn.el;
                setInputChecked(el, getExprVal(vn, value));
                Dom.bindEvent(
                    el,
                    'change',
                    function (e: Event){
                        const iptVal = el.value;
                        if (getExprVal(vn, value) !== iptVal) {
                            const Mvvvm = Store.read(vn.channel, 'mvvm');
                            Mvvvm.set(
                                getRealDataPath(vn, value).join("."),
                                iptVal
                            )
                        }
                    }
                )
            })
        },
        "select": function (vn: vNode, value: string){
            nextTick(function (){
                const el = <HTMLSelectElement>vn.el;
                setSelecteChecked(el, getExprVal(vn, value));
                Dom.bindEvent(
                    el,
                    'change',
                    function (e: Event){
                        const selectVal = el.value;
                        // let checkedData = getExprVal(vn, value);
                        if (getExprVal(vn, value) !== selectVal) {
                            const Mvvvm = Store.read(vn.channel, 'mvvm');
                            Mvvvm.set(
                                getRealDataPath(vn, value).join("."),
                                selectVal
                            )
                        }
                    }
                )
            })
        }
    }
    export const dirKey = 'VModel';
    export function init (vn: vNode, value: string){
        saveVnToDataPath(
            getRealDataPath(vn, value),
            vn
        )
        if (!vn.dep[dirKey]) {
            vn.dep[dirKey] = [];
        }
        vn.dep[dirKey].push({
            expr: value
        });
        parse(vn, value);
    }
    export function parse (vn: vNode, value: string){
        const tag = vn.name;
        const type = vn.attr.type;
        let parseFn;
        if (tag === 'input') {
            parseFn = MODELPARSE[type] || MODELPARSE["text"];
            
        } else if (tag === "select"){
            parseFn = MODELPARSE[tag];
        }
        parseFn(vn, value);
    }
    export function update (vn: vNode, newVal){
        const tag = vn.name;
        if (tag === 'text') {
            return;
        }
        if (tag === 'input') {
            setInputChecked(<HTMLInputElement>vn.el, newVal);
        } else if (tag === "select"){
            setSelecteChecked(<HTMLSelectElement>vn.el, newVal)
        }
    }
}
export namespace VOn {
    // KeyboardEvent.keyCode aliases
    const keyCodes = {
      esc: 27,
      tab: 9,
      enter: 13,
      space: 32,
      up: 38,
      left: 37,
      right: 39,
      down: 40,
      'delete': [8, 46]
    };
  
    // KeyboardEvent.key aliases
    const keyNames = {
      // #7880: IE11 and Edge use `Esc` for Escape key name.
      esc: ['Esc', 'Escape'],
      tab: 'Tab',
      enter: 'Enter',
      // #9112: IE11 uses `Spacebar` for Space key name.
      space: [' ', 'Spacebar'],
      // #7806: IE11 uses key names without `Arrow` prefix for arrow keys.
      up: ['Up', 'ArrowUp'],
      left: ['Left', 'ArrowLeft'],
      right: ['Right', 'ArrowRight'],
      down: ['Down', 'ArrowDown'],
      // #9112: IE11 uses `Del` for Delete key name.
      'delete': ['Backspace', 'Delete', 'Del']
    };
    // #4868: modifiers that prevent the execution of the listener
    // need to explicitly return null so that we can determine whether to remove
    // the listener for .once

    function genGuard (condition: string) {
        return ("if(" + condition + ")return null;");
    };

    const modifierCode = {
        stop: '$event.stopPropagation();',
        prevent: '$event.preventDefault();',
        self: genGuard("$event.target !== $event.currentTarget"),
        ctrl: genGuard("!$event.ctrlKey"),
        shift: genGuard("!$event.shiftKey"),
        alt: genGuard("!$event.altKey"),
        meta: genGuard("!$event.metaKey"),
        left: genGuard("'button' in $event && $event.button !== 0"),
        middle: genGuard("'button' in $event && $event.button !== 1"),
        right: genGuard("'button' in $event && $event.button !== 2")
    };
    const eventCode = '$event';
    function hyphenate (str: string) {
        return str.replace(/\B([A-Z])/g, '-$1').toLowerCase();
    }
    function isKeyNotMatch (expect: string|number|Array<number|string>, actual: string|number) {
        if (Array.isArray(expect)) {
            return expect.indexOf(actual) === -1
        } else {
            return expect !== actual
        }
    }
    
    /**
     * Runtime helper for checking keyCodes from config.
     * exposed as Vue.prototype._k
     * passing in eventKeyName as last argument separately for backwards compat
     */
    function checkKeyCodes (
        eventKeyCode,
        key,
        builtInKeyCode,
        eventKeyName,
        builtInKeyName
    ) {
        const mappedKeyCode = keyCodes[key] || builtInKeyCode;
        if (builtInKeyName && eventKeyName && !keyCodes[key]) {
            return isKeyNotMatch(builtInKeyName, eventKeyName)
        } else if (mappedKeyCode) {
            return isKeyNotMatch(mappedKeyCode, eventKeyCode)
        } else if (eventKeyName) {
            return hyphenate(eventKeyName) !== key
        }
    }
    function genFilterCode (key: string) {
        const keyVal = parseInt(key, 10);
        if (keyVal) {
          return ("$event.keyCode!==" + keyVal)
        }
        const keyCode = keyCodes[key];
        const keyName = keyNames[key];
        return (
          "checkKeyCodes($event.keyCode," +
          (JSON.stringify(key)) + "," +
          (JSON.stringify(keyCode)) + "," +
          "$event.key," +
          "" + (JSON.stringify(keyName)) +
          ")"
        )
      }
    function genKeyFilter (keys: string[]) {
        return ("if(!('button' in $event)&&" + (keys.map(genFilterCode).join('&&')) + ")return null;")
    }
    function getEventFnCode (modifiers: {[key: string]: boolean}, methodArgs: methodArgs){
        // const code = [];
        const {method, args} = methodArgs;
        // function arguments code;
        const argCodes = args.map((arg, idx) => {
            return arg !== eventCode ? `method__${idx}__` : eventCode;
        });
        let code = '';
        let genModifierCode = '';
        const keys = [];
        // 处理 修饰符
        for (let key in modifiers) {
            if (modifierCode[key]) {
                genModifierCode += modifierCode[key];
                // left / right
                if (keyCodes[key]) {
                    keys.push(key);
                }
            } else if (key === 'exact') {
                genModifierCode += genGuard(
                    ['ctrl', 'shift', 'alt', 'meta']
                        .filter(keyModifier => {
                            return !modifiers[keyModifier];
                        })
                        .map(keyModifier => {
                            return ("$event." + keyModifier + "Key");
                        })
                        .join('||')
                );
            } else {
                keys.push(key);
            }
        }
        if (keys.length) {
            code += genKeyFilter(keys);
        }
        // Make sure modifiers like prevent and stop get executed after key filtering
        if (genModifierCode) {
            code += genModifierCode;
        }
        // return code
        return ['checkKeyCodes', method].concat(argCodes, [code + `\nreturn ${method}(${argCodes.join(',')})`]);
    }
    function parseMethodArgs (expr: string): methodArgs{
        const exec = /(.*?)\(([\s\S]+?)\)/.exec(expr);
        // console.log('parseMethodArgs', exec);
        if (exec && exec.length) {
            const _args =  exec[2].split(',');
            const args = [];
            let isFindEventCode = false;
            _args.forEach(arg => {
                args.push(strTrim(arg));
                if (arg === eventCode) {
                    isFindEventCode = true;
                }
            })
            if (!isFindEventCode) {
                args.push(eventCode)
            } 
            return {
                method: exec[1],
                args
            }
        }
        return {
            method: expr,
            args: [eventCode]
        }
    }
    export const dirKey = 'VOn';
    export function init (vn: vNode, value: string, name: string){
        name = name.replace(onRe, "");
        const modifiers = parseModifiers(name);
        if (modifiers) {
            name = name.replace(modifierRe, '');
        }
        console.log(value, name, modifiers);
        parse(vn, value, name, modifiers)
    }
    export function parse (vn: vNode, expr: string, type: string, modifiers: {[key: string]: boolean}){
        nextTick(function (){
            const el = vn.el;
            const {method, args} = parseMethodArgs(expr);
            Dom.bindEvent(el, type, function (e: Event){
                const methods = Store.read(vn.channel, 'methods');
                const callback = Function.apply(
                    Function, 
                    getEventFnCode(modifiers, {method, args})
                );
                const _args = [checkKeyCodes, methods[method]];
                args.forEach(arg => {
                    if (arg !== '$event') {
                        _args.push(getExprVal(vn, arg));
                    }
                })
                _args.push(e);
                try {
                    callback.apply(
                        callback,
                        _args
                    )
                } catch (_e) {  
                    console.log(_e);
                }
            })
        })
    }
    export function update (){}
}
export namespace VClass {
    export const dirKey = 'VClass';
    export function init (vn: vNode, value: string){
        VBind.init(vn, value, 'class');
    }
    export function parse (){}
    export function update (){}
}
export namespace VShow {
    export const dirKey = 'VShow';
    export function init (vn: vNode, value: string){
        console.log(vn, value);
        saveVnToDataPath(
            getRealDataPath(vn, value), 
            vn
        );
        if (!vn.dep[dirKey]) {
            vn.dep[dirKey] = [];
        }
        vn.dep[dirKey].push({
            expr: value
        });
        parse(vn, value);
    }
    const noneDisplayVal = 'none';
    function updateDisplayVal (el: HTMLElement, isShow: boolean, oldDisplayVal: string) {
        const currentShow = el.style.display !== noneDisplayVal;

        if (isShow !== currentShow) {
            if (isShow) {
                el.style.display = oldDisplayVal !== noneDisplayVal ? oldDisplayVal : 'block';
            } else {
                el.style.display = noneDisplayVal;
            }
        }
    } 
    export function parse (vn: vNode, value: string){
        nextTick(function (){
            const el = <HTMLElement>vn.el;
            // 缓存初始display的旧值
            const oldDisplayVal = vn.oldDisplayVal = el.style.display;
            const isShow = !!getExprVal(vn, value);

            updateDisplayVal(el, isShow, oldDisplayVal);
        })
    }
    export function update (vn: vNode) {
        const dep = vn.dep[dirKey][0];
        updateDisplayVal(
            <HTMLElement>vn.el,
            !!getExprVal(vn, <string>dep.expr),
            vn.oldDisplayVal
        );
    }
}
export namespace VIf {
    const cacheProcesseIfDir = [];
    function findPrevIfVn (vns: vNode[], currentIdx: number){
        let prev;
        let len = currentIdx;
        while(--len > -1) {
            const vn = vns[len];
            if (!('dirIf' in vn)){
                break;
            }
            if (vn && vn.__ifExprVNodes__) {
                if (len > 0 && vns[len - 1] && 'dirIf' in vns[len - 1]) {
                    throw 'Directive(v-if) cannot be nested.'
                }
                prev = vn;
                break;
            }
        }
        return prev;
    }
    const elseIfMap = {
        'v-else-if': 'else if',
        'v-else': 'else'
    }
    /**
     * 不能多层 if else-if else嵌套
     * if 优先级低
     * 建议使用 v-show 指令
     */
    export const dirKey = 'VIf';
    export function init (vn: vNode, value: string, dirName: string){
        const parent = vn.parent;
        const parentChildren = parent.children;
        if (dirName === 'v-if'){
            const __ifExprVNodes__ = [{
                expr: value,
                vn,
                dir: 'if'
            }];
            cacheProcesseIfDir.push(__ifExprVNodes__);
            const fragment = Vnode.createFragmentVn(<vNode>{
                __ifExprVNodes__,
                dirIf: true,
                parent,
                channel: vn.channel,
                dep: {}
            });
            vn.parent = fragment;
            parentChildren.splice(vn._idx, 1, fragment);
        } else if (elseIfMap[dirName]) {
            vn.dirIf = true;
            const prev = findPrevIfVn(parentChildren, vn._idx);
            if (prev){
                prev.__ifExprVNodes__.push({
                    expr: value,
                    vn,
                    dir: elseIfMap[dirName]
                })
                vn.parent = prev.parent;
            } else {
                console.log(`${dirName} between v-if and v-esle(-if) will be ignored.`)
            }
        }
    }
    export function parse (){
        // 解析缓存节点
        while(cacheProcesseIfDir.length) {
            const exprVns = cacheProcesseIfDir.splice(cacheProcesseIfDir.length - 1, 1)[0];
            const processeCode = [];
            const vnArgsCode = [];
            const args = [getExprVal];
            const parent = exprVns[0].vn.parent;
            let realPath = [];
            for (let i = exprVns.length - 1; i > -1; i--) {
                const {expr, vn, dir} = exprVns[i];
                // 从原先父节点卸载 vnode
                if (i > 0) {
                    const parentChildren = parent.parent.children;
                    parentChildren.splice(vn._idx, 1);
                }
                if (expr) {
                    realPath = realPath.concat(getRealDataPath(parent, expr));
                }
                // 解析生成 if else 判断函数
                const vnNameCode = `_vn_${i}_`;
                vnArgsCode.push(vnNameCode);
                args.push(vn);
                const judgeCode = `(_p(${vnNameCode}, "${expr}"))`;
                const returnCode = `{return ${vnNameCode}}`;
                if (dir === 'else') {
                    processeCode.push(`else ${returnCode}`);
                } else {
                    processeCode.push(`${dir} ${judgeCode} ${returnCode}`)
                }
            }
            saveVnToDataPath(unique(realPath), parent);
            const judgeFn = Function.apply(
                Function, 
                [
                    '_p'
                ].concat(
                    vnArgsCode,
                    [processeCode.reverse().join("")]
                )
            )
            try {
                const exprFn = () => {
                    return judgeFn.apply(
                        judgeFn,
                        args
                    )
                }
                parent.children = [exprFn()];
                if (!parent.dep[dirKey]) {
                    parent.dep[dirKey] = [];
                }
                parent.dep[dirKey].push({
                    expr: exprFn
                });
            } catch (e){
                console.log(e);
            }
        }
    }
    export function update (vn: vNode){
        const expr = <defFn>vn.dep[dirKey][0].expr;
        const newVns = [expr()];
        updateChildren(vn.parent.el, vn.children, newVns);
        vn.children = newVns;
    }
}
// 指令name对应指令处理模块
const DirMap = {
    "v-for": VFor,
    "v-text": VText,
    "v-html": VHtml,
    "v-on": VOn,
    "v-bind": VBind,
    "v-model": VModel,
    "v-class": VClass,
    "v-show": VShow,
    "v-if": VIf,
    "v-else-if": VIf,
    "v-else": VIf
}
function _parse (vn: vNode){
    const channel = vn.channel;
    const oDir = vn.dir;
    const oData = window["$__data"] = Store.read(channel, 'data');
    for (let key in oDir) {
        let dirName;
        // console.log(key, oDir[key]);
        if(dirRe.test(key)){
            if (onRe.test(key)) { // on
                dirName = 'v-on';
            } else if (bindRe.test(key)) { // bind
                dirName = 'v-bind';
            }
            // 常规标签
            const oDirective = DirMap[dirName || key];
            if (oDirective && oDirective.init) {
                oDirective.init(vn, oDir[key], key);
            }
        }
    }
    if (vn.name === '#text') {
        VText.init(vn, vn.text);
    }
}
function parseItemVn (vn: vNode){
    _parse(vn);
    if (!vn.noParse) {
        if (vn.children && vn.children.length) {
            parse(vn.children, true);
            // children = children.concat(vn.children);
        }
    }
}
/**
 * 解析指令
 * @param vns 
 * @param isNoProcesse 是否解析优先级低的指令
 */
export function parse (vns: vNode[], isNoProcesse?: boolean){
    let idx = -1;
    let vn;
    while (++idx < vns.length) {
        vn = vns[idx] as vNode;
        vn._idx = idx;
        parseItemVn(vn);
    }
    if (!isNoProcesse) {
        // 处理if指令
        VIf.parse();
    }
}

