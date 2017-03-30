import {BinaryReader} from "../binaryReader";
import {Queue} from "../util";

/** A Bound is an integer Range representing a Data Chunk */
export class Bound {
    start : number;
    len : number;
}

export abstract class Parser {
    data : Uint8Array;

    constructor( buffer : Uint8Array) {
        this.data = buffer;
    }
    abstract parse() : ParseStructure;
}
export class ParseStructure {
    segmentTree : SegmentTree = new SegmentTree();
    visualComp : VisualUIComp;
}
export abstract class VisualUIComp {
    abstract buildUI(data : Uint8Array) : string;
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
    abstract getValue(data : Uint8Array)  : any;
    abstract getStartByte() : number;
    abstract getStartBitmask() : number;
    abstract getLength() : number;
    abstract getEndBitmask() : number;
    isEditable() : boolean {return false;}
    changeValue( data : Uint8Array, val : any) : void{}
    getUIComp() : ValueUIComponent {return null;}
    getBound() : Bound {
        return {
            start: this.getStartByte(),
            len: this.getLength()
        }
    }
}
export interface ValueUIComponent {
    buildUI() : HTMLElement;
    updateUI(value:any) : void;
    getUIValue() : any;
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

                this.comment = parseFormat( 
                    this.comment, context.links[this.links[i]], this.links[i], data);
            }
            return this.comment;
        }
    }

    export class ComplexUIC implements UIComponent {
        pieces : string[] = [];
        links : number[][] = [];
        
        addPiece( piece : string, ...links: number[]) {
            this.pieces.push(piece);
            this.links.push(links);
        }
        buildUI(context : Segment, data: Uint8Array) : string{
            var str = "";

            for( var i=0; i < this.pieces.length; ++i) {
                var substr = this.pieces[i];

                if( this.links[i]) {
                    for( var j=0; j < this.links[i].length; ++j) {
                        substr = parseFormat(
                            substr, context.links[this.links[i][j]], this.links[i][j], data);
                    }
                }
                str += substr;
            }

            return str;
        }
    }

    /**
     * Will parse the given string by replacing the following tokens
     * with the following values determined by the data:
     * 
     * %c : data bind class for the corresponding index, i.e. db_i
     * %d : string version of the data
     * %dh : the linked data converted to hex strong
     * %dh_# : the linked data converted to hex string of length #
     * %D... : as above, but automatically wraps it in a span that has the class link
     */
    function parseFormat(
         str : string, link : DataLink, index : number, data: Uint8Array) : string 
    {
        var ret = str;
        ret = ret.replace('%c','db_'+index);

        var o = link.getValue(data);

        var dloc = ret.indexOf('%d');
        var wrap = false;
        if( dloc == -1) {
            dloc = ret.indexOf('%D');
            wrap = true;
        }
        if( dloc != -1) {
            var char = ret.charAt(dloc+2);

            var replace_str = "";
            var len_to_replace = 2;
            switch( char) {
            case 'h':
                var n : number = o;
                var hex_str = n.toString(16);
                len_to_replace = 3;
                if( ret.charAt(dloc+3) == '_'){
                    len_to_replace = 5;
                    let hlen = parseInt( ret.charAt(dloc+4), 10);
                    while( hex_str.length < hlen)
                        hex_str = "0" + hex_str;
                }
                replace_str = hex_str;
                break;
            default:
                replace_str = ""+o;
            }
            if( wrap) {
                replace_str = '<span class="db_'+index+'">' + replace_str + '</span>';
            }
            ret = ret.substr(0,  dloc) + replace_str + ret.substr(dloc+len_to_replace);
        }

        return ret;
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