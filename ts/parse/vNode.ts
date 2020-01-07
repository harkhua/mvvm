import { Vnode } from "../assist/helper";
import { splitStr2Obj } from "../assist/util";



namespace vNode {
    const autoCloseTags = splitStr2Obj('area,base,br,col,embed,hr,img,input,keygen,param,source,track,wbr');
    const doctype = /^<!DOCTYPE [^>]+>/i;
    const comment = /^<!\--/;
    const conditionalComment =  /^<!\[/;
    const startTagOpen = /^<((?:[a-zA-Z_][\w\-\.]*\:)?[a-zA-Z_][\w\-\.]*)/;
    const startTagClose = /^\s*(\/?)>/;
    const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
    const endTag = /^<\/((?:[a-zA-Z_][\w\-\.]*\:)?[a-zA-Z_][\w\-\.]*)[^>]*>/;

    const dirRe = /^v-|^@|^:/;
    
    let index = 0; // 记录解析字符串的位置
    let textEnd = 0;
    const aOpenTag = [];
    /**
     * 记录解析位置 并返回剩余HTML 字符串
     * @param tpl 
     * @param n 
     */
    function setParsePos (tpl: string, n: number): string{
        index += n;

        return tpl.substring(n);
    }
    /**
     * 解析html 字符串
     * @param tpl 
     */
    export function parse (tpl: string, channel: string): vNode{
        // const out = [] as vNode[];
        const parent = {
            name: "#Fragment",
            children: []
        } as vNode;
        while (tpl){
            textEnd = tpl.indexOf('<'); // 查找待解析标签位置
            // 文本为 <XXX
            if (textEnd === 0){
                // 判断是否为注释标签
                if (comment.test(tpl)) {
                    // 获取注释标签结束位置
                    let commentEnd = tpl.indexOf('-->');
                    if (commentEnd >= 0) {
                        parent.children.push({
                            id: Vnode.getId(),
                            name: "#comment",
                            text: tpl.substring(4, commentEnd),
                            channel,
                            dep: {},
                            parent
                        }) 
                        tpl = setParsePos(tpl, commentEnd + 3);
                        continue;
                    }
                }

                // 判断是否是 <![]>
                if (conditionalComment.test(tpl)){
                    let conditionalEnd = tpl.indexOf(']>');

                    if (conditionalEnd >= 0){
                        tpl = setParsePos(tpl, conditionalEnd + 2);
                        continue;
                    }
                }

                // 判断是否是 Doctype
                let docTypeMatch = tpl.match(doctype);
                if (docTypeMatch) {
                    tpl = setParsePos(tpl, docTypeMatch[0].length);
                    continue;
                }

                // 判断<XXX>标签 open
                const startMatch = tpl.match (startTagOpen);
                if(startMatch) {
                    const _startMatch = {
                        id: Vnode.getId(),
                        name: startMatch[1],
                        attr: {},
                        dir: {},
                        children: [],
                        channel,
                        dep: {},
                        parent
                    } as vNode;
                    // 记录<XXX>标签 open 的id
                    if (!autoCloseTags[_startMatch.name]) {
                        aOpenTag.push(_startMatch.id);
                    }
                    tpl = setParsePos(tpl, startMatch[0].length);

                    let endMatch; // 记录closeMatch
                    let attr; // 记录标签属性
                    let attrVal;

                    // 如果循环至 闭合标签位置或者 无法查找到标签属性 则结束
                    while (
                        !(endMatch = tpl.match(startTagClose)) && 
                        (attr = tpl.match(attribute))
                    ) {
                        tpl = setParsePos(tpl, attr[0].length);
                        attrVal = attr[3] || attr[4] || attr[5] || "";
                        _startMatch[
                            dirRe.test(attr[1]) ? "dir" : "attr"
                        ][attr[1]] = attrVal
                    }

                    if (endMatch) {
                        tpl = setParsePos(tpl, endMatch[0].length);

                        parent.children.push(_startMatch);
                    }
                    continue;
                }

                // 判断是 <xxx/> | /> close
                let endTagMatch = tpl.match(endTag);

                if (endTagMatch) {
                    tpl = setParsePos(tpl, endTagMatch[0].length);

                    let l = parent.children.length;
                    const children = [];

                    while(--l >= 0){
                        // 找到对应的 open标签
                        if (
                            parent.children[l].name === endTagMatch[1] &&
                            aOpenTag.length &&
                            aOpenTag[aOpenTag.length - 1] === parent.children[l].id
                        ) {
                            aOpenTag.pop();
                            // 添加 子父节点关联
                            if (children.length) {
                                children.forEach (child => {
                                    child.parent = parent.children[l];
                                })
                            }
                            parent.children[l].children = children;
                            break;
                        } else {
                            children.unshift(parent.children.pop());
                        }
                    }
                    continue;
                }
                
            }

            let text, rest, next;
            // 文本为 xxx<
            if (textEnd > 0) {
                rest = tpl.slice(textEnd);
                // 防止还存在 其他标签
                while(
                    !endTag.test(rest) &&
                    !startTagOpen.test(rest) &&
                    !comment.test(rest) &&
                    !conditionalComment.test(rest)
                ){
                    next = rest.indexOf('<', 1);
                    if (next < 0) break;
                    textEnd += next;
                    rest = tpl.slice(textEnd);
                }
                text = tpl.substring(0, textEnd);
                tpl = setParsePos(tpl, textEnd);
            }

            // 文本中无<
            if (textEnd < 0) {
                text = tpl;
                tpl = '';
            }

            // 需要对文本做指令解析
            if (text && /[\S]/.test(text)) {
                //console.log('text---', text);
                parent.children.push(
                    {
                        id: Vnode.getId(),
                        name: "#text",
                        text: text,
                        channel,
                        dep: {},
                        parent
                    }
                )
            }
        }

        return parent;
    }
}

export const parseVNode = vNode.parse;