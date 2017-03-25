import {BinaryReader} from "../binaryReader";
import {Queue} from "../util";

/** A Bound is an integer Range representing a Data Chunk */
export class Bound {
    start : number;
    len : number;
}


export abstract class Parser {
    reader : BinaryReader;
    data : Uint8Array;

    constructor( buffer : Uint8Array) {
        this.reader = new BinaryReader(buffer);
        this.data = buffer;
    }
    abstract parse() : ParseStructure;
}
export class ParseStructure {
    segmentTree : SegmentTree = new SegmentTree();
    visualHTML : string;
}

/** The SegmentTree is a Simple Tree Structure storing all the Segments. */
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


export interface UIComponent {
    buildUI(context : Segment, data: Uint8Array) : string;
}
export abstract class DataLink {
    abstract getValue(data : Uint8Array)  : string;
    abstract getStartByte() : number;
    abstract getStartBitmask() : number;
    abstract getLength() : number;
    abstract getEndBitmask() : number;
    getBound() : Bound {
        return {
            start: this.getStartByte(),
            len: this.getLength()
        }
    }
}
export interface DynamicDataLink extends DataLink {
    changeValue( data : Uint8Array, val : string) : void;
}
export module LinkTypes {
    export class BoolBitLink extends DataLink {
        offset: number;
        seek : number;
        constructor( reader : BinaryReader, offset : number) {
            super();
            this.seek = reader.getSeek();
            this.offset = offset;
        }
        getValue(data : Uint8Array) : string { 
            return "" + (((data[this.seek] >>> this.offset)&1) != 0);
        }
        getStartByte() : number {return this.seek;}
        getStartBitmask() : number {return (1 << this.offset);}
        getLength() : number {return 1;}
        getEndBitmask() : number  {return (1 << this.offset);}
    }
    export class PartialByteLink extends DataLink {
        offset: number;
        size : number;
        seek : number;
        
        getValue(data : Uint8Array)  : string {
            return "" + ((data[this.seek] >>> this.offset)&((1 << this.size)-1));
        }
        getStartByte() : number {return this.seek;}
        getStartBitmask() : number {return ((1 << this.size) - 1) << this.offset;}
        getLength() : number {return 1;}
        getEndBitmask() : number {return ((1 << this.size) - 1) << this.offset;}
    }
}
export module UIComponents {
    export class SimpleUIC implements UIComponent {
        comment : string;
        links : number[];
        constructor( comment : string, ...links: number[]) {
            this.comment = comment;
            this.links = links;
        }
        buildUI(context : Segment, data: Uint8Array) : string{
            var str : string = this.comment;

            if( !this.links) return this.comment;

            for( var i=0; i < this.links.length; ++i) {
                this.comment = this.comment.replace( '%d',
                    '<span class="db_' + this.links[i] + '">'+context.links[this.links[i]].getValue(data)+'</span>');
            }
            return this.comment;
        }
    }

    export class ComplexUIC implements UIComponent {
        // TODO: It would probably be more intuitive and faster to bind links
        //  to a certain piece and replace it mid-piece instead of once the entire
        //  string is constructed
        pieces : string[] = [];
        links : number[] = [];
        
        addPiece( piece : string, ...links: number[]) {
            this.pieces.push(piece);

            if( links) {
                for( var i=0; i < links.length; ++i)
                    this.links.push( links[i]);
            }
        }
        buildUI(context : Segment, data: Uint8Array) : string{
            var str = "";

            for( var i=0; i < this.pieces.length; ++i) {
                str += this.pieces[i];
                console.log(str);
            }
            for( var i=0; i < this.links.length; ++i) {
                str = str.replace('%c','db_'+this.links[i]);
                str = str.replace('%d',context.links[this.links[i]].getValue(data));
            }

            return str;
        }
    }
}

export class Segment {
    start : number;
    length : number;
    color : string;
    title : string;
    uiComponents : UIComponent[];
    links : DataLink[];
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