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
    segments : Segment[] = [];
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

    constructor( segment : Segment, name : string) {
        this.segment = segment;
        this.name = name;
    }
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
export class DataBinding implements Binding {
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
export class CellBinding extends DataBinding{}