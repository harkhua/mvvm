define(["require", "exports", "../assist/helper", "../assist/store", "../assist/util", "./vNode"], function (require, exports, helper_1, store_1, util_1, vNode_1) {
    "use strict";
    exports.__esModule = true;
    var leftSpace = "{{";
    var rightSpace = "}}";
    var textReg = /{{([\s\S]+?)}}/;
    var RFILTERS = /[^|]\|\s*(\w+)\s*(\([^)]*\))?/g;
    var textMark = /([^a-zA-z_$\d\.\[\]]+)/g;
    var dirRe = /^v-|^@|^:/;
    var onRe = /^@|^v-on:?/;
    var bindRe = /^:|^v-bind:?/;
    var ifRe = /^v-(if|else-if|else)$/;
    var modifierRe = /\.[^.\]]+(?=[^\]]*$)/g;
    function parseExpr(str) {
        var result = [];
        if (textReg.test(str)) {
            var val = void 0, start = 0, stop_1;
            var _loop_1 = function () {
                stop_1 = str.indexOf(leftSpace, start);
                if (stop_1 === -1)
                    return "break";
                val = str.slice(start, stop_1);
                if (val) {
                    result.push({
                        expr: val
                    });
                }
                start = stop_1 + leftSpace.length;
                stop_1 = str.indexOf(rightSpace, start);
                if (stop_1 === -1)
                    return "break";
                val = str.slice(start, stop_1);
                if (val) {
                    var leach_1 = [];
                    if (val.indexOf("|") > 0) {
                        val = val.replace(RFILTERS, function (c, d, e) {
                            leach_1.push(d + (e || ""));
                            return c.charAt(0);
                        });
                    }
                    result.push({
                        value: val,
                        expr: true,
                        filters: leach_1.length ? leach_1 : void 0
                    });
                }
                start = stop_1 + rightSpace.length;
            };
            do {
                var state_1 = _loop_1();
                if (state_1 === "break")
                    break;
            } while (true);
            val = str.slice(start);
            if (val) {
                result.push({
                    expr: val
                });
            }
        }
        return result;
    }
    function saveVnToDataPath(paths, vn) {
        var oDataPathToVn = store_1.Store.read(vn.channel, "dataPathToVn");
        paths.forEach(function (path) {
            if (!oDataPathToVn[path]) {
                oDataPathToVn[path] = [];
            }
            path && oDataPathToVn[path].push(vn);
        });
    }
    function getLocalData(vn) {
        if (vn.localData) {
            return vn.localData;
        }
        if (!vn.parent) {
            return null;
        }
        return getLocalData(vn.parent);
    }
    function getRealDataPath(vn, path, dirKey) {
        var paths = path.replace(textMark, ',').split(',');
        if (vn.isForDir) {
            var localData_1 = getLocalData(vn);
            return paths.map(function (p) {
                return localData_1 ? p.replace(localData_1.$__vn__.dep[dirKey || 'VFor'][0].item, localData_1.path) : p;
            });
        }
        return paths;
    }
    function getVariables(code) {
        var rrexpstr = /\/\*(?:.|\n)*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|'[^']*'|"[^"]*"|[\s\t\n]*\.[\s\t\n]*[$\w\.]+/g;
        var rsplit = /[^\w$]+/g;
        var rkeywords = /\bbreak\b|\bcase\b|\bcatch\b|\bcontinue\b|\bdebugger\b|\bdefault\b|\bdelete\b|\bdo\b|\belse\b|\bfalse\b|\bfinally\b|\bfor\b|\bfunction\b|\bif\b|\bin\b|\binstanceof\b|\bnew\b|\bnull\b|\breturn\b|\bswitch\b|\bthis\b|\bthrow\b|\btrue\b|\btry\b|\btypeof\b|\bvar\b|\bvoid\b|\bwhile\b|\bwith\b|\babstract\b|\bboolean\b|\bbyte\b|\bchar\b|\bclass\b|\bconst\b|\bdouble\b|\benum\b|\bexport\b|\bextends\b|\bfinal\b|\bfloat\b|\bgoto\b|\bimplements\b|\bimport\b|\bint\b|\binterface\b|\blong\b|\bnative\b|\bpackage\b|\bprivate\b|\bprotected\b|\bpublic\b|\bshort\b|\bstatic\b|\bsuper\b|\bsynchronized\b|\bthrows\b|\btransient\b|\bvolatile\b|\barguments\b|\blet\b|\byield\b|\bundefined\b/g;
        var rnumber = /\b\d[^,]*/g;
        var rcomma = /^,+|,+$/g;
        code = code
            .replace(rrexpstr, '')
            .replace(rsplit, ',')
            .replace(rkeywords, '')
            .replace(rnumber, '')
            .replace(rcomma, '');
        return code ? code.split(/,+/) : [];
    }
    function getDataName(name) {
        return "Z_" + name + new Date().getTime();
    }
    function getExprVal(vn, val) {
        var aVars = util_1.unique(getVariables(val));
        if (!aVars.length) {
            return val;
        }
        var assigns = [];
        var dataName = [];
        var store = [];
        aVars.forEach(function (item, idx) {
            dataName.push(getDataName(item));
            assigns.push(item + "=" + dataName[idx] + "." + item);
            store.push(getData(vn, item));
        });
        dataName.push("\nvar " + assigns.join(",") + "; \nreturn " + val);
        var fn = Function.apply(Function, dataName);
        try {
            return fn.apply(fn, store);
        }
        catch (e) {
            return null;
        }
    }
    function getData(vn, path) {
        var firstPath = util_1.parsePath(path)[0];
        var baseData = getLocalData(vn);
        if (baseData && firstPath in baseData) {
            return baseData;
        }
        var globalData = store_1.Store.read(vn.channel, 'data');
        if (globalData && firstPath in globalData) {
            return globalData;
        }
        var computeds = store_1.Store.read(vn.channel, 'computed');
        if (computeds && firstPath in computeds) {
            return {}[path] = computeds[firstPath].call(globalData);
        }
        return null;
    }
    function copyVn(vn, parent) {
        var newVn = {
            id: helper_1.Vnode.getId(),
            attr: vn.attr ? util_1.extend(true, {}, vn.attr) : {},
            dir: vn.attr ? util_1.extend(true, {}, vn.dir) : {},
            name: vn.name,
            isForDir: true,
            children: [],
            channel: vn.channel,
            localData: null,
            text: vn.text || null,
            dep: vn.attr ? util_1.extend(true, {}, vn.dep) : {},
            parent: parent || vn.parent,
            forEndVn: vn.forEndVn || null
        };
        if (vn.children && vn.children.length) {
            vn.children.forEach(function (child) {
                newVn.children.push(copyVn(child, newVn));
            });
        }
        return newVn;
    }
    function patchVnode(oldVn, newVn, beforeInsert) {
        if (oldVn === newVn || newVn.noParse)
            return;
        var elem = newVn.el = oldVn.el;
        var oldCh = oldVn.children;
        var ch = newVn.children;
        if (!util_1.isDefined(newVn.text)) {
            if (util_1.isDefined(oldCh) && util_1.isDefined(ch) && oldCh.length && ch.length) {
                updateChildren(elem, oldCh, ch, beforeInsert);
            }
            else if (util_1.isDefined(oldCh) && oldCh.length) {
                oldCh.length = 0;
                helper_1.Dom.removeNode(elem);
            }
            else if (util_1.isDefined(ch)) {
                helper_1.Vnode.addVnodes(elem, null, ch, 0, ch.length - 1);
            }
            else if (util_1.isDefined(oldVn.text)) {
                helper_1.Dom.setTextContent(elem, '');
                oldVn.text = '';
            }
        }
        else if (newVn.text !== oldVn.text) {
            helper_1.Dom.setTextContent(elem, newVn.text);
            oldVn.text = newVn.text;
        }
    }
    function createOldIdxMap(children, beginIdx, endIdx) {
        var i, key;
        var map = {};
        for (i = beginIdx; i <= endIdx; ++i) {
            key = children[i]._idx;
            if (util_1.isDefined(key)) {
                map[key] = i;
            }
        }
        return map;
    }
    function findIdxInOld(node, oldCh, start, end) {
        for (var i = start; i < end; i++) {
            var c = oldCh[i];
            if (util_1.isDefined(c) && helper_1.Vnode.sameVnode(node, c)) {
                return i;
            }
        }
    }
    function updateChildren(elem, oldCh, ch, beforeInsert) {
        var newStartIdx = 0, oldStartIdx = 0, newEndIdx = ch.length - 1, oldEndIdx = oldCh.length - 1, newStartVnode = ch[newStartIdx], oldStartVnode = oldCh[oldStartIdx], newEndVnode = ch[newEndIdx], oldEndVnode = oldCh[oldEndIdx];
        var oldIdxMap, idxInOld, vnodeToMove, refElm;
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (!util_1.isDefined(oldStartVnode)) {
                oldStartVnode = oldCh[++oldStartIdx];
            }
            else if (!util_1.isDefined(oldEndVnode)) {
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (helper_1.Vnode.sameVnode(oldStartVnode, newStartVnode)) {
                patchVnode(oldStartVnode, newStartVnode, beforeInsert);
                newStartVnode = ch[++newStartIdx];
                oldStartVnode = oldCh[++oldStartIdx];
            }
            else if (helper_1.Vnode.sameVnode(oldEndVnode, newEndVnode)) {
                patchVnode(oldEndVnode, newEndVnode, beforeInsert);
                newEndVnode = ch[--newEndIdx];
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (helper_1.Vnode.sameVnode(oldStartVnode, newEndVnode)) {
                patchVnode(oldStartVnode, newEndVnode, beforeInsert);
                helper_1.Dom.insertBefore(elem, oldStartVnode.el, helper_1.Dom.nextSibling(oldEndVnode.el));
                oldStartVnode = oldCh[++oldStartIdx];
                newEndVnode = ch[--newEndIdx];
            }
            else if (helper_1.Vnode.sameVnode(oldEndVnode, newStartVnode)) {
                patchVnode(oldEndVnode, newStartVnode, beforeInsert);
                helper_1.Dom.insertBefore(elem, oldEndVnode.el, oldStartVnode.el);
                oldEndVnode = oldCh[--oldEndIdx];
                newStartVnode = ch[++newStartIdx];
            }
            else {
                if (!util_1.isDefined(oldIdxMap)) {
                    oldIdxMap = createOldIdxMap(oldCh, oldStartIdx, oldEndIdx);
                }
                oldIdxMap = util_1.isDefined(newStartVnode._idx)
                    ? oldIdxMap[newStartVnode._idx]
                    : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
                if (!util_1.isDefined(idxInOld)) {
                    helper_1.Vnode.addVn(newStartVnode, elem, oldStartVnode.el, ch, newStartIdx);
                }
                else {
                    vnodeToMove = oldCh[idxInOld];
                    if (helper_1.Vnode.sameVnode(vnodeToMove, newStartVnode)) {
                        patchVnode(vnodeToMove, newStartVnode, beforeInsert);
                        oldCh[idxInOld] = undefined;
                    }
                    else {
                        helper_1.Vnode.addVn(newStartVnode, elem, oldStartVnode.el, ch, newStartIdx);
                    }
                }
                newStartVnode = ch[++newStartIdx];
            }
        }
        if (oldStartIdx > oldEndIdx) {
            var oldEndVn = oldCh[oldEndIdx];
            refElm = util_1.isDefined(oldEndVn) ?
                helper_1.Dom.nextSibling(oldEndVn.el) :
                beforeInsert;
            helper_1.Vnode.addVnodes(elem, refElm, ch, newStartIdx, newEndIdx);
        }
        else if (newStartIdx > newEndIdx) {
            helper_1.Vnode.removeVnodes(elem, oldCh, oldStartIdx, oldEndIdx);
        }
    }
    function parseBind(name, obj, result) {
        if (!result) {
            result = {};
        }
        if (name) {
            !result[name] && (result[name] = []);
            if (util_1.isArray(obj)) {
                obj.forEach(function (item) {
                    parseBind(name, item, result);
                });
            }
            else if (util_1.isString(obj)) {
                result[name].push(obj);
            }
            else {
                for (var key in obj) {
                    if (util_1.isBoolean(obj[key])) {
                        obj[key] && result[name].push(key);
                    }
                    else {
                        if (name === 'style') {
                            parseBind(name, util_1.kebabCase(key) + ": " + obj[key], result);
                        }
                        else {
                            parseBind(name, obj[key], result);
                        }
                    }
                }
            }
        }
        else {
            for (var key in obj) {
                parseBind(key, obj[key], result);
            }
        }
        return result;
    }
    function parseModifiers(name) {
        var match = name.match(modifierRe);
        if (match) {
            var ret_1 = {};
            match.forEach(function (m) {
                ret_1[m.slice(1)] = true;
            });
            return ret_1;
        }
    }
    var VText;
    (function (VText) {
        VText.dirKey = "VText";
        function init(vn, value) {
            if (vn.name !== '#text') {
                delete vn.dir["v-text"];
                vn.children.length = 0;
                var childVn = {
                    id: helper_1.Vnode.getId(),
                    name: "#text",
                    text: "{{" + value.replace(textMark, '}}$1{{') + "}}",
                    channel: vn.channel,
                    dep: {},
                    isForDir: vn.isForDir,
                    parent: vn
                };
                vn.children.push(childVn);
                return;
            }
            parse(vn, value);
        }
        VText.init = init;
        function parseTextVal(vn, oDirective) {
            vn.text = oDirective.value.map(function (exprVal) {
                if (!exprVal.expr) {
                    return getExprVal(vn, exprVal.val);
                }
                return exprVal.val;
            }).join("");
        }
        function parse(vn, value) {
            if (!value) {
                return;
            }
            var exprs = parseExpr(value);
            if (exprs.length) {
                var oDirective = {
                    value: [],
                    expr: ''
                };
                while (exprs.length) {
                    var expr = exprs.shift();
                    if (expr.value) {
                        oDirective.value.push({
                            val: expr.value,
                            expr: false
                        });
                        saveVnToDataPath(getRealDataPath(vn, expr.value), vn);
                    }
                    else if (expr.expr) {
                        oDirective.value.push({
                            val: expr.expr,
                            expr: true
                        });
                    }
                }
                if (!vn.dep[VText.dirKey]) {
                    vn.dep[VText.dirKey] = [];
                }
                vn.dep[VText.dirKey].push(oDirective);
                parseTextVal(vn, oDirective);
            }
        }
        VText.parse = parse;
        function update(vn) {
            parseTextVal(vn, vn.dep[VText.dirKey][0]);
            helper_1.Dom.setTextContent(vn.el, vn.text);
        }
        VText.update = update;
    })(VText = exports.VText || (exports.VText = {}));
    var VHtml;
    (function (VHtml) {
        VHtml.dirKey = "VHtml";
        function init(vn, value) {
            parse(vn, value);
        }
        VHtml.init = init;
        function parse(vn, value) {
            var tpl = getExprVal(vn, value);
            if (tpl) {
                vn.children = vNode_1.parseVNode(tpl, vn.channel).children;
                saveVnToDataPath(getRealDataPath(vn, value), vn);
                if (!vn.dep[VHtml.dirKey]) {
                    vn.dep[VHtml.dirKey] = [];
                }
                vn.dep[VHtml.dirKey].push({
                    value: value
                });
            }
        }
        VHtml.parse = parse;
        function update(vn, tpl) {
            if (tpl) {
                var newVn = vNode_1.parseVNode(tpl, vn.channel);
                parseItemVn(newVn);
                updateChildren(vn.el, vn.children, newVn.children);
                vn.children = newVn.children;
            }
        }
        VHtml.update = update;
    })(VHtml = exports.VHtml || (exports.VHtml = {}));
    var VBind;
    (function (VBind) {
        VBind.dirKey = "VBind";
        function init(vn, value, name) {
            name = name.replace(bindRe, '');
            saveVnToDataPath(getVariables(value), vn);
            if (!vn.dep[VBind.dirKey]) {
                vn.dep[VBind.dirKey] = [];
            }
            vn.dep[VBind.dirKey].push({
                value: name,
                expr: value
            });
            parse(vn, value, name);
        }
        VBind.init = init;
        function parse(vn, value, name) {
            var oBind = parseBind(name, getExprVal(vn, value));
            var attrVals;
            for (var name_1 in oBind) {
                attrVals = oBind[name_1];
                if (attrVals && attrVals.length) {
                    vn.attr[name_1] = attrVals;
                }
            }
        }
        VBind.parse = parse;
        function update(vn, newVal) {
            var deps = vn.dep[VBind.dirKey];
            var oBind, name;
            deps.length && deps.forEach(function (depVal) {
                name = depVal.value;
                oBind = parseBind(name, getExprVal(vn, depVal.expr));
                helper_1.Vnode.setAttr(vn.el, name, oBind[name]);
            });
        }
        VBind.update = update;
    })(VBind = exports.VBind || (exports.VBind = {}));
    var VFor;
    (function (VFor) {
        VFor.dirKey = 'VFor';
        function init(vn, value) {
            value = value.replace(/[\(\)]/g, "");
            var match = /^\s*([\$0-9a-z_]+)(\s*,\s*([\$0-9a-z_]+))?\s+in\s+([\$0-9a-z_][\$0-9a-z_\.]+)/ig.exec(value);
            if (match) {
                var oDirective = {
                    item: match[1],
                    index: match[3] || "$index",
                    value: match[4]
                };
                if (!vn.dep[VFor.dirKey]) {
                    vn.dep[VFor.dirKey] = [];
                }
                vn.dep[VFor.dirKey].push(oDirective);
                var baseData = getLocalData(vn);
                saveVnToDataPath([
                    "" + (baseData && baseData.$__vn__ ? "" + match[4].replace(baseData.$__vn__.dep[VFor.dirKey][0].item, baseData.path) : match[4])
                ], vn);
                parse(vn, oDirective.value);
            }
        }
        VFor.init = init;
        function forDataToVn(vn, data, callback) {
            var baseData = getLocalData(vn);
            var expr = vn.dep[VFor.dirKey][0];
            var path = expr.value;
            data && data.length && data.forEach(function (item, idx) {
                var newVn = copyVn(vn);
                var oLocalData = {
                    path: (baseData && baseData.$__vn__ ? "" + path.replace(baseData.$__vn__.dep[VFor.dirKey][0].item, baseData.path) : path) + "[" + idx + "]",
                    $__vn__: vn
                };
                oLocalData[expr.item] = item;
                oLocalData[expr.index] = idx;
                newVn.localData = oLocalData;
                callback(newVn, item, idx);
            });
        }
        function parse(vn, path) {
            var oData = getExprVal(vn, path);
            delete vn.dir['v-for'];
            var parentChildren = vn.parent.children;
            var vNodes = [];
            vn.noParse = true;
            var forEndVn = vn.forEndVn = {
                id: helper_1.Vnode.getId(),
                name: '#comment',
                text: "for" + new Date().getTime()
            };
            parentChildren.splice(vn._idx + 1, 0, forEndVn);
            if (util_1.isArray(oData)) {
                forDataToVn(vn, oData, function (newVn, item, idx) {
                    vNodes.push(newVn);
                    parentChildren.splice(vn._idx + idx + 1, 0, newVn);
                });
                vn.__forItemVns__ = vNodes;
            }
        }
        VFor.parse = parse;
        function update(vn, newData) {
            var oldVns = vn.__forItemVns__ || [];
            var newVns = [];
            if (util_1.isArray(newData)) {
                forDataToVn(vn, newData, function (newVn, item, idx) {
                    parseItemVn(newVn);
                    newVn._idx = idx + 1;
                    newVns.push(newVn);
                });
            }
            updateChildren(vn.parent.el, oldVns, newVns, (vn.forEndVn || {}).el);
            vn.__forItemVns__ = newVns;
        }
        VFor.update = update;
    })(VFor = exports.VFor || (exports.VFor = {}));
    var VModel;
    (function (VModel) {
        function setInputChecked(el, checkedData) {
            var iptVal = el.value;
            if (util_1.isArray(checkedData)) {
                el.checked = checkedData.findIndex(function (val) {
                    return val === iptVal;
                }) > -1;
                return;
            }
            el.checked = iptVal === checkedData;
        }
        function setSelecteChecked(el, checkedData) {
            var children = el.children;
            var len = children.length;
            var child;
            while (len--) {
                child = children[len];
                child.selected = child.value === checkedData;
            }
        }
        var MODELPARSE = {
            "text": function (vn, path) {
                VBind.init(vn, path, 'value');
                function iptValChanged(newVal) {
                    var Mvvvm = store_1.Store.read(vn.channel, 'mvvm');
                    Mvvvm.set(getRealDataPath(vn, path).join("."), newVal);
                }
                util_1.nextTick(function () {
                    var el = vn.el;
                    helper_1.Dom.bindEvent(el, 'input', function (e) {
                        iptValChanged(el.value);
                    });
                    helper_1.Dom.bindEvent(el, 'propertychange', function (e) {
                        if (e.propertyName == "value") {
                            iptValChanged(el.value);
                        }
                    });
                });
            },
            "checkbox": function (vn, value) {
                util_1.nextTick(function () {
                    var el = vn.el;
                    setInputChecked(el, getExprVal(vn, value));
                    helper_1.Dom.bindEvent(el, 'change', function (e) {
                        var checked = el.checked;
                        var iptVal = el.value;
                        var checkedData = getExprVal(vn, value);
                        var isSetVal = false;
                        if (util_1.isArray(checkedData)) {
                            var idx = checkedData.findIndex(function (val) {
                                return val === iptVal;
                            });
                            var isAdd = idx === -1 && checked;
                            var isDel = idx > -1 && !checked;
                            if (isAdd) {
                                checkedData.splice(checkedData.length - 1, 0, iptVal);
                            }
                            else if (isDel) {
                                checkedData.splice(idx, 1);
                            }
                            isSetVal = isAdd || isDel;
                        }
                        else {
                            isSetVal = checkedData !== iptVal;
                            checkedData = [checkedData, iptVal];
                        }
                        var Mvvvm = store_1.Store.read(vn.channel, 'mvvm');
                        isSetVal && Mvvvm.set(getRealDataPath(vn, value).join("."), checkedData);
                    });
                });
            },
            "radio": function (vn, value) {
                util_1.nextTick(function () {
                    var el = vn.el;
                    setInputChecked(el, getExprVal(vn, value));
                    helper_1.Dom.bindEvent(el, 'change', function (e) {
                        var iptVal = el.value;
                        if (getExprVal(vn, value) !== iptVal) {
                            var Mvvvm = store_1.Store.read(vn.channel, 'mvvm');
                            Mvvvm.set(getRealDataPath(vn, value).join("."), iptVal);
                        }
                    });
                });
            },
            "select": function (vn, value) {
                util_1.nextTick(function () {
                    var el = vn.el;
                    setSelecteChecked(el, getExprVal(vn, value));
                    helper_1.Dom.bindEvent(el, 'change', function (e) {
                        var selectVal = el.value;
                        if (getExprVal(vn, value) !== selectVal) {
                            var Mvvvm = store_1.Store.read(vn.channel, 'mvvm');
                            Mvvvm.set(getRealDataPath(vn, value).join("."), selectVal);
                        }
                    });
                });
            }
        };
        VModel.dirKey = 'VModel';
        function init(vn, value) {
            saveVnToDataPath(getRealDataPath(vn, value), vn);
            if (!vn.dep[VModel.dirKey]) {
                vn.dep[VModel.dirKey] = [];
            }
            vn.dep[VModel.dirKey].push({
                expr: value
            });
            parse(vn, value);
        }
        VModel.init = init;
        function parse(vn, value) {
            var tag = vn.name;
            var type = vn.attr.type;
            var parseFn;
            if (tag === 'input') {
                parseFn = MODELPARSE[type] || MODELPARSE["text"];
            }
            else if (tag === "select") {
                parseFn = MODELPARSE[tag];
            }
            parseFn(vn, value);
        }
        VModel.parse = parse;
        function update(vn, newVal) {
            var tag = vn.name;
            if (tag === 'text') {
                return;
            }
            if (tag === 'input') {
                setInputChecked(vn.el, newVal);
            }
            else if (tag === "select") {
                setSelecteChecked(vn.el, newVal);
            }
        }
        VModel.update = update;
    })(VModel = exports.VModel || (exports.VModel = {}));
    var VOn;
    (function (VOn) {
        var keyCodes = {
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
        var keyNames = {
            esc: ['Esc', 'Escape'],
            tab: 'Tab',
            enter: 'Enter',
            space: [' ', 'Spacebar'],
            up: ['Up', 'ArrowUp'],
            left: ['Left', 'ArrowLeft'],
            right: ['Right', 'ArrowRight'],
            down: ['Down', 'ArrowDown'],
            'delete': ['Backspace', 'Delete', 'Del']
        };
        function genGuard(condition) {
            return ("if(" + condition + ")return null;");
        }
        ;
        var modifierCode = {
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
        var eventCode = '$event';
        function hyphenate(str) {
            return str.replace(/\B([A-Z])/g, '-$1').toLowerCase();
        }
        function isKeyNotMatch(expect, actual) {
            if (Array.isArray(expect)) {
                return expect.indexOf(actual) === -1;
            }
            else {
                return expect !== actual;
            }
        }
        function checkKeyCodes(eventKeyCode, key, builtInKeyCode, eventKeyName, builtInKeyName) {
            var mappedKeyCode = keyCodes[key] || builtInKeyCode;
            if (builtInKeyName && eventKeyName && !keyCodes[key]) {
                return isKeyNotMatch(builtInKeyName, eventKeyName);
            }
            else if (mappedKeyCode) {
                return isKeyNotMatch(mappedKeyCode, eventKeyCode);
            }
            else if (eventKeyName) {
                return hyphenate(eventKeyName) !== key;
            }
        }
        function genFilterCode(key) {
            var keyVal = parseInt(key, 10);
            if (keyVal) {
                return ("$event.keyCode!==" + keyVal);
            }
            var keyCode = keyCodes[key];
            var keyName = keyNames[key];
            return ("checkKeyCodes($event.keyCode," +
                (JSON.stringify(key)) + "," +
                (JSON.stringify(keyCode)) + "," +
                "$event.key," +
                "" + (JSON.stringify(keyName)) +
                ")");
        }
        function genKeyFilter(keys) {
            return ("if(!('button' in $event)&&" + (keys.map(genFilterCode).join('&&')) + ")return null;");
        }
        function getEventFnCode(modifiers, methodArgs) {
            var method = methodArgs.method, args = methodArgs.args;
            var argCodes = args.map(function (arg, idx) {
                return arg !== eventCode ? "method__" + idx + "__" : eventCode;
            });
            var code = '';
            var genModifierCode = '';
            var keys = [];
            for (var key in modifiers) {
                if (modifierCode[key]) {
                    genModifierCode += modifierCode[key];
                    if (keyCodes[key]) {
                        keys.push(key);
                    }
                }
                else if (key === 'exact') {
                    genModifierCode += genGuard(['ctrl', 'shift', 'alt', 'meta']
                        .filter(function (keyModifier) {
                        return !modifiers[keyModifier];
                    })
                        .map(function (keyModifier) {
                        return ("$event." + keyModifier + "Key");
                    })
                        .join('||'));
                }
                else {
                    keys.push(key);
                }
            }
            if (keys.length) {
                code += genKeyFilter(keys);
            }
            if (genModifierCode) {
                code += genModifierCode;
            }
            return ['checkKeyCodes', method].concat(argCodes, [code + ("\nreturn " + method + "(" + argCodes.join(',') + ")")]);
        }
        function parseMethodArgs(expr) {
            var exec = /(.*?)\(([\s\S]+?)\)/.exec(expr);
            if (exec && exec.length) {
                var _args = exec[2].split(',');
                var args_1 = [];
                var isFindEventCode_1 = false;
                _args.forEach(function (arg) {
                    args_1.push(util_1.strTrim(arg));
                    if (arg === eventCode) {
                        isFindEventCode_1 = true;
                    }
                });
                if (!isFindEventCode_1) {
                    args_1.push(eventCode);
                }
                return {
                    method: exec[1],
                    args: args_1
                };
            }
            return {
                method: expr,
                args: [eventCode]
            };
        }
        VOn.dirKey = 'VOn';
        function init(vn, value, name) {
            name = name.replace(onRe, "");
            var modifiers = parseModifiers(name);
            if (modifiers) {
                name = name.replace(modifierRe, '');
            }
            console.log(value, name, modifiers);
            parse(vn, value, name, modifiers);
        }
        VOn.init = init;
        function parse(vn, expr, type, modifiers) {
            util_1.nextTick(function () {
                var el = vn.el;
                var _a = parseMethodArgs(expr), method = _a.method, args = _a.args;
                helper_1.Dom.bindEvent(el, type, function (e) {
                    var methods = store_1.Store.read(vn.channel, 'methods');
                    var callback = Function.apply(Function, getEventFnCode(modifiers, { method: method, args: args }));
                    var _args = [checkKeyCodes, methods[method]];
                    args.forEach(function (arg) {
                        if (arg !== '$event') {
                            _args.push(getExprVal(vn, arg));
                        }
                    });
                    _args.push(e);
                    try {
                        callback.apply(callback, _args);
                    }
                    catch (_e) {
                        console.log(_e);
                    }
                });
            });
        }
        VOn.parse = parse;
        function update() { }
        VOn.update = update;
    })(VOn = exports.VOn || (exports.VOn = {}));
    var VClass;
    (function (VClass) {
        VClass.dirKey = 'VClass';
        function init(vn, value) {
            VBind.init(vn, value, 'class');
        }
        VClass.init = init;
        function parse() { }
        VClass.parse = parse;
        function update() { }
        VClass.update = update;
    })(VClass = exports.VClass || (exports.VClass = {}));
    var VShow;
    (function (VShow) {
        VShow.dirKey = 'VShow';
        function init(vn, value) {
            console.log(vn, value);
            saveVnToDataPath(getRealDataPath(vn, value), vn);
            if (!vn.dep[VShow.dirKey]) {
                vn.dep[VShow.dirKey] = [];
            }
            vn.dep[VShow.dirKey].push({
                expr: value
            });
            parse(vn, value);
        }
        VShow.init = init;
        var noneDisplayVal = 'none';
        function updateDisplayVal(el, isShow, oldDisplayVal) {
            var currentShow = el.style.display !== noneDisplayVal;
            if (isShow !== currentShow) {
                if (isShow) {
                    el.style.display = oldDisplayVal !== noneDisplayVal ? oldDisplayVal : 'block';
                }
                else {
                    el.style.display = noneDisplayVal;
                }
            }
        }
        function parse(vn, value) {
            util_1.nextTick(function () {
                var el = vn.el;
                var oldDisplayVal = vn.oldDisplayVal = el.style.display;
                var isShow = !!getExprVal(vn, value);
                updateDisplayVal(el, isShow, oldDisplayVal);
            });
        }
        VShow.parse = parse;
        function update(vn) {
            var dep = vn.dep[VShow.dirKey][0];
            updateDisplayVal(vn.el, !!getExprVal(vn, dep.expr), vn.oldDisplayVal);
        }
        VShow.update = update;
    })(VShow = exports.VShow || (exports.VShow = {}));
    var VIf;
    (function (VIf) {
        VIf.dirKey = 'VIf';
        function init(vn, value) {
        }
        VIf.init = init;
        function parse() { }
        VIf.parse = parse;
        function update() { }
        VIf.update = update;
    })(VIf = exports.VIf || (exports.VIf = {}));
    var DirMap = {
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
    };
    function _parse(vn) {
        var channel = vn.channel;
        var oDir = vn.dir;
        var oData = window["$__data"] = store_1.Store.read(channel, 'data');
        for (var key in oDir) {
            var dirName = void 0;
            if (dirRe.test(key)) {
                if (onRe.test(key)) {
                    dirName = 'v-on';
                }
                else if (bindRe.test(key)) {
                    dirName = 'v-bind';
                }
                else if (ifRe.test(key)) {
                }
                var oDirective = DirMap[dirName || key];
                if (oDirective && oDirective.init) {
                    oDirective.init(vn, oDir[key], key);
                }
            }
        }
        if (vn.name === '#text') {
            VText.init(vn, vn.text);
        }
    }
    function parseItemVn(vn) {
        _parse(vn);
        if (!vn.noParse) {
            if (vn.children && vn.children.length) {
                parse(vn.children);
            }
        }
    }
    function parse(vns) {
        var idx = -1;
        var vn;
        while (++idx < vns.length) {
            vn = vns[idx];
            vn._idx = idx;
            parseItemVn(vn);
        }
    }
    exports.parse = parse;
});
