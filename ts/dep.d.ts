/**
 * 初始化
 * 获取节点下整个dom树 --> 解析dom树 并生成对应的vNode --> 解析对应vNode
 * 解析待解析指令 执行update 更新到对应节点
 *  注：不渲染整个dom树 而是做局部渲染 降低性能消耗
 *  注：for指令会增加 dom节点
 *  注：如果for指令中 localData中数据名和static data中数据名一致时 优先使用 localData中对应数据
 */

interface vNode {
    id: number; // 虚拟节点编号   for指令执行update 可改变节点编号 
    attr?: {[key: string]: string}; // 解析完之后标签属性
    dir?: {[key: string]: string}; // 待解析指令 key 数据路径 value 指令String eg：data.a.b: text|show|bind
    /**
     * 根据数据路径 拿到对应虚拟节点
     * 根据虚拟节点 拿到对应 数据路径对应的dir
     * 通过dir下update函数 进行视图更新
     */
    name: string; // 节点名
    text?: string; // 文本节点 | 注释节点 才存在
    dep?: {[key: string]: dirExpr[]}; // 解析后的数据路径 对应依赖的指令
    localData?: any; // component | for指令 解析后缓存数据
    isForDir?: boolean; // 节点上是否 存在for指令
    el?: Node; // 非For指令 原始Dom | for指令下的复制Dom
    __el?: Node; // for指令下 才存在 缓存原始节点
    children?: vNode[]; // 子节点
    parent?: vNode;
    _idx?: number;
    noParse?: boolean; // 带有该标志不解析成 HTMLElement
    channel?: string; // 模块渠道
    __forItemVns__?: vNode[];
    endVn?: vNode;
    oldDisplayVal?: string;
    __ifExprVNodes__?: ifExprVnodeItem[];
    dirIf?: boolean;
}
type defFn = (...args) => any;
interface ifExprVnodeItem {
    vn: vNode;
    expr: string;
    dir: 'if' | 'else if' | 'else';
}
interface textExprVal {
    val: string;
    expr: boolean;
}
interface dirExpr {
    item?: string;
    index?: string; 
    value?: string|textExprVal[];
    expr?: string | defFn;
}
interface dataDepNodeMap {
    [key: string]: vNode[];
}
interface baseCfg {
    el?: string;
    template?: string;
    mount?: string;
}
type anyMap = {[key: string]: any};
interface mvvmCfg extends baseCfg {
    data: anyMap | (() => anyMap);
    computed: anyMap;
    methods: {
        [key: string]: (...args) => void;
    };
    watch: {
        [key: string]: (newVal, oldVal) => void;
    }
    // 生命周期钩子
    beforeCreate?: () => void;
    created?: () => void;
    beforeMount?: () => void;
    mounted?: () => void;
    beforeUpdate?: () => void;
    updated?: () => void;
}

interface EventTarget {
    attachEvent(type: string, listener: EventListenerOrEventListenerObject | null): void;
}
interface watchFn {
    (newVal: any, oldVal: any): void
}
interface methodArgs {
    method: string;
    args: Array<string>;
}