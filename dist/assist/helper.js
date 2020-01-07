define(["require", "exports", "./store", "./util"], function (require, exports, store_1, util_1) {
    "use strict";
    exports.__esModule = true;
    var Dom;
    (function (Dom) {
        var doc = document;
        function createElem(tagName) {
            return doc.createElement(tagName);
        }
        Dom.createElem = createElem;
        function createText(text) {
            return doc.createTextNode(text);
        }
        Dom.createText = createText;
        function createComment(text) {
            return doc.createComment(text);
        }
        Dom.createComment = createComment;
        function appendChild(node, child) {
            node.appendChild(child);
        }
        Dom.appendChild = appendChild;
        function parentNode(node) {
            return node.parentNode;
        }
        Dom.parentNode = parentNode;
        function removeChild(parent, child) {
            parent.removeChild(child);
        }
        Dom.removeChild = removeChild;
        function nextSibling(elm) {
            return elm.nextSibling;
        }
        Dom.nextSibling = nextSibling;
        function insertBefore(parent, elm, nextElm) {
            parent.insertBefore(elm, nextElm);
        }
        Dom.insertBefore = insertBefore;
        function setTextContent(elm, content) {
            if ("textContent" in elm) {
                elm.textContent = content;
            }
            else if ("innerText" in elm) {
                elm["innerText"] = content;
            }
            else {
                elm["nodeValue"] = content;
            }
        }
        Dom.setTextContent = setTextContent;
        function insert(parent, elm, ref) {
            if (parent) {
                if (!ref) {
                    appendChild(parent, elm);
                }
                else {
                    insertBefore(parent, elm, ref);
                }
            }
        }
        Dom.insert = insert;
        function removeNode(elm) {
            var parent = parentNode(elm);
            if (parent) {
                removeChild(parent, elm);
            }
        }
        Dom.removeNode = removeNode;
        function createFragment() {
            return doc.createDocumentFragment();
        }
        Dom.createFragment = createFragment;
        function empty(elem) {
            var firstChild;
            while (firstChild = elem.firstChild) {
                if (firstChild.nodeType === 1) {
                    empty(firstChild);
                }
                removeChild(elem, firstChild);
            }
        }
        Dom.empty = empty;
        function getElment(selector, context) {
            if (!selector) {
                return this;
            }
            var elem;
            var rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/;
            var result = [];
            var match = rquickExpr.exec(selector);
            context = (!context || !context.nodeType) ? doc : context;
            if (match && match[1]) {
                elem = doc.getElementById(match[1]);
                result[0] = elem;
            }
            else if (match && match[2]) {
                elem = context.getElementsByTagName(match[2]);
                for (var i = 0; i < elem.length; i++) {
                    result.push(elem[i]);
                }
            }
            else if (match && match[3]) {
                if (context.getElementsByClassName) {
                    elem = context.getElementsByClassName(match[3]);
                }
                else {
                    elem = context.getElementsByTagName("*");
                }
                for (var i = 0, len = elem.length; i < len; i++) {
                    if (elem[i].className && elem[i].className.indexOf(match[3]) > -1) {
                        result.push(elem[i]);
                    }
                }
            }
            else {
                return [];
            }
            return result;
        }
        Dom.getElment = getElment;
        function bindEvent(target, type, callback) {
            if (window.dispatchEvent) {
                target.addEventListener(type, callback, false);
            }
            else {
                target.attachEvent("on" + type, callback);
            }
        }
        Dom.bindEvent = bindEvent;
        function setAttribute(elem, name, val) {
            elem.setAttribute(name, val);
        }
        Dom.setAttribute = setAttribute;
    })(Dom = exports.Dom || (exports.Dom = {}));
    var Vnode;
    (function (Vnode) {
        var __ID__ = 0;
        function getId() {
            return __ID__++;
        }
        Vnode.getId = getId;
        function toId(vNodeId) {
            var vNodes = store_1.Store.read('vNode');
            return vNodes && vNodes.length ? vNodes[vNodeId] : null;
        }
        Vnode.toId = toId;
        function childVnToDom(children, parent) {
            if (children && children.length) {
                children.forEach(function (item) {
                    var dom = toDom(item);
                    dom && parent.appendChild(dom);
                });
            }
        }
        var baseAttrMap = {
            value: 1,
            checked: 1
        };
        function setAttr(node, name, value) {
            if (util_1.isString(value)) {
                if (baseAttrMap[name]) {
                    node[name] = value;
                }
                else {
                    node.setAttribute(name, value);
                }
            }
            else if (util_1.isArray(value)) {
                if (name === 'class') {
                    node.setAttribute(name, value.join(" "));
                }
                else if (name === 'style') {
                    node.setAttribute(name, value.join(";"));
                }
                else {
                    value.forEach(function (val) {
                        if (baseAttrMap[name]) {
                            node[name] = val;
                        }
                        else {
                            node.setAttribute(name, val);
                        }
                    });
                }
            }
        }
        Vnode.setAttr = setAttr;
        function toDom(vnode) {
            var nodeName = vnode.name;
            if (vnode.noParse)
                return;
            var node;
            switch (nodeName) {
                case '#Fragment':
                    node = Dom.createFragment();
                    childVnToDom(vnode.children || [], node);
                    return node;
                case '#text':
                    return vnode.el = Dom.createText(vnode.text);
                case '#comment':
                    return vnode.el = Dom.createComment(vnode.text);
                case 'template':
                    node = Dom.createFragment();
                    childVnToDom(vnode.children || [], node);
                    return node;
                default:
                    node = Dom.createElem(nodeName);
                    var attrs = vnode.attr || {};
                    if (attrs) {
                        for (var key in attrs) {
                            setAttr(node, key, attrs[key]);
                        }
                    }
                    childVnToDom(vnode.children || [], node);
                    vnode.el = node;
                    return node;
            }
        }
        Vnode.toDom = toDom;
        function removeVnode(vnode) {
            var parent = vnode.parent;
            if (parent) {
                parent.children.splice(vnode._idx, 1);
                vnode.el && Dom.removeNode(vnode.el);
            }
        }
        Vnode.removeVnode = removeVnode;
        function sameVnode(a, b) {
            return a.name === b.name && a._idx === b._idx;
        }
        Vnode.sameVnode = sameVnode;
        function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
            while (endIdx >= startIdx) {
                var node = vnodes[endIdx];
                if (node.el) {
                    Dom.removeNode(node.el);
                    vnodes.splice(endIdx, 1);
                }
                endIdx--;
            }
        }
        Vnode.removeVnodes = removeVnodes;
        function addVn(vn, parentElm, refElem, chs, idx) {
            toDom(vn);
            Dom.insert(parentElm, vn.el, refElem);
        }
        Vnode.addVn = addVn;
        function addVnodes(parentElm, refElm, vnodes, startIdx, endIdx) {
            for (; startIdx <= endIdx; startIdx++) {
                addVn(vnodes[startIdx], parentElm, refElm, vnodes, startIdx);
            }
        }
        Vnode.addVnodes = addVnodes;
    })(Vnode = exports.Vnode || (exports.Vnode = {}));
    exports.getMvvmId = (function () {
        var __MID__ = 0;
        return function () {
            return __MID__++;
        };
    })();
});
