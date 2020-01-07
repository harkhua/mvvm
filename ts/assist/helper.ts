import { Store } from "./store";
import { isString, isArray } from "./util";

/**
 * 节点相关操作
 */
export namespace Dom {
    const doc = document;
    export function createElem (tagName: string){
        return doc.createElement(tagName)
    }

    export function createText (text: string) {
        return doc.createTextNode(text);
    }

    export function createComment (text: string){
        return doc.createComment(text);
    }

    export function appendChild (node: Node, child: Node) {
        node.appendChild(child);
    }

    export function parentNode (node: Node): Node {
        return node.parentNode;
    }

    export function removeChild (parent: Node, child: Node){
        parent.removeChild(child);
    }

    export function nextSibling (elm: Node): Node {
        return elm.nextSibling;
    }

    export function insertBefore (parent: Node, elm: Node, nextElm: Node){
        parent.insertBefore(elm, nextElm);
    }

    export function setTextContent (elm: Node, content: string){
        if ("textContent" in elm) {
            elm.textContent = content;
        }
        else if ("innerText" in elm) {
            (elm as HTMLElement)["innerText"] = content;
        } else {
            (elm as HTMLElement)["nodeValue"] = content
        }
    }
    export function insert (parent: Node, elm: Node, ref: Node){
        if (parent) {
            if (!ref) {
                appendChild(parent, elm)
            } else {
                insertBefore(parent, elm, ref);
            }
        }
    }
    export function removeNode (elm: Node){
        const parent = parentNode(elm);

        if (parent) {
            removeChild(parent, elm);
        }
    }
    export function createFragment (): DocumentFragment {
        return doc.createDocumentFragment();
    }
    
    export function empty (elem: Node){
        let firstChild;
        while (firstChild = elem.firstChild) {
            if (firstChild.nodeType === 1) {
                empty (firstChild);
            }
            removeChild(elem, firstChild);
        }
    }
    export function getElment (selector: string, context?: Document): HTMLElement[]{
        // 判断非空
        if (!selector) {
            return this;
        }
        let elem;
        // 匹配ID tag class
        const rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/;
        const result = [];
        const match = rquickExpr.exec(selector);
        context = (!context || !context.nodeType) ? doc : context;

        if (match && match[1]) {
            // ID
            elem = doc.getElementById(match[1]);
            result[0] = elem;
        } else if (match && match[2]) {
            elem = context.getElementsByTagName(match[2]);
            for (let i = 0; i < elem.length; i++) {
                result.push(elem[i]);
            }
        } else if (match && match[3]) {
            if (context.getElementsByClassName) {
                elem = context.getElementsByClassName(match[3]);
            } else {
                elem = context.getElementsByTagName("*");
            }
            for (let i = 0, len = elem.length; i < len; i++) {
                if (elem[i].className && elem[i].className.indexOf(match[3]) > -1) {
                    result.push(elem[i]);
                }
            }
        } else {
            return [];
        }

        return result;
    }
    /**
     * 事件监听
     * @param target 
     * @param type 
     * @param callback 
     */
    export function bindEvent (target: Node, type: string, callback: (e: Event) => void){
        if (window.dispatchEvent) {
            target.addEventListener(type, callback, false)
        } else {
            target.attachEvent("on" + type, callback)
        }
    }
    export function setAttribute (elem: HTMLElement, name: string, val: string){
        elem.setAttribute(name, val);
    }
}
/**
 * 虚拟节点相关
 */
export namespace Vnode {
    let __ID__ = 0;
    export function getId (): number{
        return __ID__++;
    }

    export function toId (vNodeId: number): vNode{
        const vNodes = Store.read('vNode') as vNode[];

        return vNodes && vNodes.length ? vNodes[vNodeId] : null;
    }
    /**
     * 把子节点插入父节点
     * @param children 
     * @param parent 
     */
    function childVnToDom (children: vNode[], parent: Node){
        if (children && children.length) {
            children.forEach(item => {
                const dom = toDom(item);
                dom && parent.appendChild(dom);
            })
        }
    }
    const baseAttrMap = {
        value: 1,
        checked: 1
    }
    export function setAttr (node: HTMLElement, name: string, value: string|string[]) {
        // const node = <HTMLElement>vnode.el;
        if (isString(value)) {
            if (baseAttrMap[name]) {
                node[name] = value;
            } else {
                node.setAttribute(name, <string>value);
            }
        } else if (isArray(value)) {
            if (name === 'class') {
                node.setAttribute(name, (value as string[]).join(" "));
            } else if (name === 'style') {
                node.setAttribute(name, (value as string[]).join(";"));
            } else {
                (value as string[]).forEach(val => {
                    if (baseAttrMap[name]) {
                        node[name] = val;
                    } else {
                        node.setAttribute(name, val);
                    }
                })
            }
        }
    }
    /**
     * 虚拟节点转dom
     * @param vnode 
     */
    export function toDom (vnode: vNode) {
        const nodeName = vnode.name;
        if (vnode.noParse) return;
        let node;
        switch(nodeName){
            case '#Fragment':
                node = Dom.createFragment();
                childVnToDom(vnode.children || [], node);
                return node;
            case '#text':
                return vnode.el = Dom.createText(vnode.text);
            case '#comment':
                return vnode.el = Dom.createComment(vnode.text);
            case 'template': 
                // 循环子节点 用文档节点包裹起来 插入当前位置
                node = Dom.createFragment();
                childVnToDom(vnode.children || [], node);
                return node;
            default:
                node = Dom.createElem(nodeName);
                const attrs = vnode.attr || {};
                if (attrs) {
                    for (let key in attrs) {
                        setAttr(node, key, attrs[key])
                    }
                }
                childVnToDom(vnode.children || [], node);
                vnode.el = node;
                return node;
        }
    }
    /**
     * 删除节点
     * @param vnode 
     */
    export function removeVnode (vnode: vNode){
        const parent = vnode.parent;
        if (parent){
            parent.children.splice(vnode._idx, 1);
            vnode.el && Dom.removeNode(vnode.el);
        }
    }
    /**
     * 判断是否为同一个位置的相同tag的虚拟节点
     * @param a 
     * @param b 
     */
    export function sameVnode (a: vNode, b: vNode): boolean{
        return a.name === b.name && a._idx === b._idx;
    }
    /**
     * 移除vnode
     * @param parentElm 
     * @param vnodes 
     * @param startIdx 
     * @param endIdx 
     */
    export function removeVnodes (parentElm: Node, vnodes: vNode[], startIdx: number, endIdx: number) {
        while (endIdx >= startIdx) {
            const node = vnodes[endIdx]
            if (node.el) {
                Dom.removeNode(node.el)
                vnodes.splice(endIdx, 1);
            }
            endIdx--;
        }
    }
    export function addVn (vn: vNode, parentElm: Node, refElem: Node, chs: vNode[], idx: number) {
        toDom(vn);
        Dom.insert(parentElm, vn.el, refElem);
        // chs.splice(idx, 0, vn)
    }
    /**
     * 添加节点
     * @param vnode 
     * @param elem 
     */
    export function addVnodes (parentElm: Node, refElm: Node, vnodes: vNode[], startIdx: number, endIdx: number) {
        for (; startIdx <= endIdx; startIdx++) {
            // toDom(vn);
            // Dom.insert(parentElm, vn.el, refElm);
            // chs.splice(startIdx, 0, vn)
            addVn(vnodes[startIdx], parentElm, refElm, vnodes, startIdx);
        }
    }
}

export const getMvvmId = (function (){
    let __MID__ = 0;
    return () => {
        return __MID__++;
    }
})();