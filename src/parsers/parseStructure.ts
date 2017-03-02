import {BinaryReader} from "../binaryReader";
import {Queue} from "../util";

/**
 * 
 */
export class Bound {
    start : number;
    len : number;
}

export abstract class Parser {
    reader : BinaryReader;

    constructor( buffer : Uint8Array) {
        this.reader = new BinaryReader(buffer);
    }
    abstract parse() : ParseStructure;
}
export class ParseStructure {
    segmentTree : SegmentTree = new SegmentTree();
    visualHTML : string;
}

export class SegmentTree {
    private root : SegmentNode = new SegmentNode(null, "Root");

    getRoot() : SegmentNode { return this.root;}
}
export class SegmentNode {
    private children : SegmentNode[] = [];
    private segment : Segment;
    private name : string;
    private expanded: boolean = true;

    constructor( segment : Segment, name : string) {
        this.segment = segment;
        this.name = name;
    }
    isExpanded() : boolean { return this.expanded;}
    setExpanded( exp : boolean) { this.expanded = exp;}
    getName() : string { return this.name;}
    getSegment() : Segment { return this.segment;}
    getChildren() : SegmentNode[] { return this.children.slice(0);}
    addSegment( seg : Segment) : SegmentNode {
        var sNode = new SegmentNode(seg, seg.title);
        this.children.push(sNode);
        return sNode;
    }
    addNullSegment( str : string) : SegmentNode {
        var sNode = new SegmentNode(null, str);
        this.children.push(sNode);
        return sNode;
    }
    getAll() : Segment[] {
        var ret : Segment[] = [];
        var dfqueue = new Queue<SegmentNode>();

        // Note: specifically omits the node itself
        dfqueue.enqueue( this);
        while( !dfqueue.isEmpty()) {
            var node = dfqueue.dequeue();

            for( var i=0; i < node.children.length; ++i) {
                var seg = node.children[i].getSegment();
                if( seg)ret.push(seg);
                dfqueue.enqueue( node.children[i]);
            }
        }

        return ret;
    }
}

module DataLinks {
    export class Data {
        private dat:  {[key: string]: any};
        getData( id : string) : any {

        }
    }
    class Datum {
        dat : any;
        type: string;
        s() {
        }
    }
    export interface DataLink {
        getValue(d: Data) : any;
        changeValue( d:Data, val : any) : void;
        getStartByte() : number;
        getStartBitmask() : number;
        getEndByte() : number;
        getEndBitmask() : number;
        isDynamic() : boolean;
    }
    export interface DataUIComponent {
        buildUIComponent() : JQuery;
    }


    /* ReaderBinder is a class that constructs DataLinks as it reads it from the reader */
    export class ReaderBinder {
        private reader : BinaryReader;
        links : DataLink[] = [];
        constructor( reader : BinaryReader) {
            this.reader = reader;
        }
        readByte(id : string) : number {
            this.links.push(new BasicLink<number>(id, this.reader.getSeek(), 1));
            var val = this.reader.readByte();
            return val;
        }

    }

    export class BasicLink<T> implements DataLink {
        id : string;
        start : number;
        length: number;
        constructor( id : string, start: number, length: number) {
            this.id = id;
            this.start = start;
            this.length = length;
        }
        getValue(d:Data) : T {
            return d.getData(this.id) as T;
        }
        changeValue( d:Data, val : T) { throw "Unsupported";}
        getStartByte() : number { return this.start;}
        getStartBitmask() : number { return 0xFF;}
        getEndByte() : number {return this.start+this.length;}
        getEndBitmask() : number {return 0xFF;}
        isDynamic() : boolean {return false;}
    }

    interface _Bind { getHTML() : string;}
    class BasicBind implements _Bind {
        html : string;
        constructor( html : string) { this.html = html;}
        getHTML() : string {
            return this.html;
        }
    }
    class LinkedBind implements _Bind {
        html : string;
        link : DataLink;
        constructor( html : string, link : DataLink) { this.html = html; this.link = link;}
        getHTML() : string {
            return this.html;
        }
    }
    class CellBind extends LinkedBind{}
    export class ManualUIComponent implements DataUIComponent {
        binds : _Bind[];

        addBasicBinding( html : string) {
            this.binds.push( new BasicBind(html));
        }
        addBinding( html : string, link : DataLink) {
            this.binds.push( new LinkedBind(html, link));
        }
        addCellBinding( html : string, link : DataLink) {
            this.binds.push( new CellBind(html, link));
        }

        buildUIComponent() : JQuery {
            var html = "";
            for( var i=0; i< this.binds.length; ++i) {

            }

            var ele = document.createElement("div");
            ele.innerHTML = "";
            return $(ele);
        }
    }
}
export class Segment {
    start : number;
    length : number;
    color : string;
    title : string;
    binding : Binding[];
}
export interface Binding {
    binding : Bound;
    getHTML() : string;
}
export class NilBinding implements Binding {
    binding : Bound = null;
    html : string;
    constructor( html : string ) {
        this.html = html;
    }
    getHTML() { return this.html;}
}
export class DataBinding_ implements Binding {
    binding : Bound;
    html : string;
    constructor( html : string, start : number, length : number) {
        this.html = html;
        this.binding = {start:start, len:length};
    }
    getHTML() { 
        return this.html;
    }
}

/** A Cell Binding is a specific Binding for <td> cells to tell the Segment UI constructor
 * it has to wrap them.  Because HTML renderers are terrible at rendering something as simple 
 * as a grid.
 */
export class CellBinding extends DataBinding_{}