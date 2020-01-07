define(["require", "exports", "../assist/helper", "../assist/util"], function (require, exports, helper_1, util_1) {
    "use strict";
    exports.__esModule = true;
    var vNode;
    (function (vNode) {
        var autoCloseTags = util_1.splitStr2Obj('area,base,br,col,embed,hr,img,input,keygen,param,source,track,wbr');
        var doctype = /^<!DOCTYPE [^>]+>/i;
        var comment = /^<!\--/;
        var conditionalComment = /^<!\[/;
        var startTagOpen = /^<((?:[a-zA-Z_][\w\-\.]*\:)?[a-zA-Z_][\w\-\.]*)/;
        var startTagClose = /^\s*(\/?)>/;
        var attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
        var endTag = /^<\/((?:[a-zA-Z_][\w\-\.]*\:)?[a-zA-Z_][\w\-\.]*)[^>]*>/;
        var dirRe = /^v-|^@|^:/;
        var index = 0;
        var textEnd = 0;
        var aOpenTag = [];
        function setParsePos(tpl, n) {
            index += n;
            return tpl.substring(n);
        }
        function parse(tpl, channel) {
            var parent = {
                name: "#Fragment",
                children: []
            };
            var _loop_1 = function () {
                textEnd = tpl.indexOf('<');
                if (textEnd === 0) {
                    if (comment.test(tpl)) {
                        var commentEnd = tpl.indexOf('-->');
                        if (commentEnd >= 0) {
                            parent.children.push({
                                id: helper_1.Vnode.getId(),
                                name: "#comment",
                                text: tpl.substring(4, commentEnd),
                                channel: channel,
                                dep: {},
                                parent: parent
                            });
                            tpl = setParsePos(tpl, commentEnd + 3);
                            return "continue";
                        }
                    }
                    if (conditionalComment.test(tpl)) {
                        var conditionalEnd = tpl.indexOf(']>');
                        if (conditionalEnd >= 0) {
                            tpl = setParsePos(tpl, conditionalEnd + 2);
                            return "continue";
                        }
                    }
                    var docTypeMatch = tpl.match(doctype);
                    if (docTypeMatch) {
                        tpl = setParsePos(tpl, docTypeMatch[0].length);
                        return "continue";
                    }
                    var startMatch = tpl.match(startTagOpen);
                    if (startMatch) {
                        var _startMatch = {
                            id: helper_1.Vnode.getId(),
                            name: startMatch[1],
                            attr: {},
                            dir: {},
                            children: [],
                            channel: channel,
                            dep: {},
                            parent: parent
                        };
                        if (!autoCloseTags[_startMatch.name]) {
                            aOpenTag.push(_startMatch.id);
                        }
                        tpl = setParsePos(tpl, startMatch[0].length);
                        var endMatch = void 0;
                        var attr = void 0;
                        var attrVal = void 0;
                        while (!(endMatch = tpl.match(startTagClose)) &&
                            (attr = tpl.match(attribute))) {
                            tpl = setParsePos(tpl, attr[0].length);
                            attrVal = attr[3] || attr[4] || attr[5] || "";
                            _startMatch[dirRe.test(attr[1]) ? "dir" : "attr"][attr[1]] = attrVal;
                        }
                        if (endMatch) {
                            tpl = setParsePos(tpl, endMatch[0].length);
                            parent.children.push(_startMatch);
                        }
                        return "continue";
                    }
                    var endTagMatch = tpl.match(endTag);
                    if (endTagMatch) {
                        tpl = setParsePos(tpl, endTagMatch[0].length);
                        var l_1 = parent.children.length;
                        var children = [];
                        while (--l_1 >= 0) {
                            if (parent.children[l_1].name === endTagMatch[1] &&
                                aOpenTag.length &&
                                aOpenTag[aOpenTag.length - 1] === parent.children[l_1].id) {
                                aOpenTag.pop();
                                if (children.length) {
                                    children.forEach(function (child) {
                                        child.parent = parent.children[l_1];
                                    });
                                }
                                parent.children[l_1].children = children;
                                break;
                            }
                            else {
                                children.unshift(parent.children.pop());
                            }
                        }
                        return "continue";
                    }
                }
                var text = void 0, rest = void 0, next = void 0;
                if (textEnd > 0) {
                    rest = tpl.slice(textEnd);
                    while (!endTag.test(rest) &&
                        !startTagOpen.test(rest) &&
                        !comment.test(rest) &&
                        !conditionalComment.test(rest)) {
                        next = rest.indexOf('<', 1);
                        if (next < 0)
                            break;
                        textEnd += next;
                        rest = tpl.slice(textEnd);
                    }
                    text = tpl.substring(0, textEnd);
                    tpl = setParsePos(tpl, textEnd);
                }
                if (textEnd < 0) {
                    text = tpl;
                    tpl = '';
                }
                if (text && /[\S]/.test(text)) {
                    parent.children.push({
                        id: helper_1.Vnode.getId(),
                        name: "#text",
                        text: text,
                        channel: channel,
                        dep: {},
                        parent: parent
                    });
                }
            };
            while (tpl) {
                _loop_1();
            }
            return parent;
        }
        vNode.parse = parse;
    })(vNode || (vNode = {}));
    exports.parseVNode = vNode.parse;
});
