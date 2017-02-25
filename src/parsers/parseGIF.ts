import {BinaryReader} from "../binaryReader";
import {ParseStructure, Parser, Segment, Binding, NilBinding, DataBinding, CellBinding}
     from "./parseStructure";
import {ParseColors} from "./colors";
import {randcolor} from "../util";


export class GIFParser extends Parser {
    parsed : ParseStructure;

    header : HeaderSegment;
    globalTable : GlobalTableSegment = null;
    
    parse() : ParseStructure {
        this.parsed = new ParseStructure();

        this.header = new HeaderSegment( this.reader, 0, this);
        if( this.header.bad) return null;

        if( this.header.globalTable) {
            this.globalTable = new GlobalTableSegment(this.reader, this.reader.getSeek(), this);
        }

        this.parsed.segments.push(this.header.constructSegment());
        if( this.header.globalTable)
            this.parsed.segments.push(this.globalTable.constructSegment());

        return this.parsed;
    }

    private parseHeader() : boolean {
        return (this.header.bad);
    }
}


abstract class SegmentData {
    start : number;
    reader : BinaryReader;
    context : GIFParser;
    constructor( reader : BinaryReader, start:number, context : GIFParser) {
        this.start = start;
        this.reader = reader;
        this.context = context;
    }
    abstract constructSegment() : Segment;
}

class GlobalTableSegment extends SegmentData {
    size : number;
    table : Uint32Array;
    constructor( reader : BinaryReader, start:number, context : GIFParser) {
        super( reader, start, context);
        this.size = context.header.ctableSize;
        this.table = new Uint32Array( this.size);

        for( var i=0; i < this.size; ++i) {
            this.table[i] = this.reader.readRGB();
        }
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];

        var n = Math.max( Math.sqrt(this.size));

        bindings.push( new NilBinding('<table class="colorTable">'));
        for( var row=0; row < n; ++row) {
            bindings.push( new NilBinding('<tr>'));
            bindings.push( new NilBinding('<td>'+row*n+'-'+(row*n+n-1)+'</td>'));
            for( var col=0; col < n; ++col) {
                var index = row*n + col;
                var color = ParseColors.rbgToString(this.table[index]);
                bindings.push( new CellBinding('<div class="colorBox" style="background-color:'+color+'"></div>', this.start + index*3, 3));
            }
            bindings.push( new NilBinding('</tr>'));
        }
        bindings.push( new NilBinding('</table>'));

        return {
            start: this.start,
            length : this.size * 3,
            color : "#bb9999",
            binding : bindings,
            descriptor : "Global Color Table"
        };
    }
}

class HeaderSegment extends SegmentData {
    bad = false;
    ver89a : boolean;
    width : number;
    height : number;

    ctableSize : number;
    sorted : boolean;
    globalTable : boolean;
    colorRes : number;

    bgColorIndex : number;
    pixelAspectRatio : number;
    constructor( reader : BinaryReader, start:number, context : GIFParser) {
        super( reader, start, context);

        var header = this.reader.readUTF8StrLen(6);

        if( header == "GIF87a") this.ver89a = false;
        else if( header == "GIF89a") this.ver89a = true;
        else {this.bad = true; return;}

        this.width = this.reader.readUShortLE();
        this.height = this.reader.readUShortLE();

        var packed = this.reader.readByte();
        this.ctableSize = 1 << ((packed & 0x7)+1);
        this.sorted = (packed & 0x8) != 0;
        this.colorRes = (packed >> 4) & 0x7;
        this.globalTable = (packed & 0x80) != 0;

        this.bgColorIndex = this.reader.readByte();
        this.pixelAspectRatio = this.reader.readByte();
    }

    constructSegment() : Segment {
        var bindings : Binding[] = [];

        bindings.push( new NilBinding( "Signature/Version: "));
        bindings.push( new DataBinding((this.ver89a?"GIF89a":"GIF87a"), 0, 6));

        bindings.push( new NilBinding('<br />Display Size: '));
        bindings.push( new DataBinding(""+this.width, 6, 2));
        bindings.push( new NilBinding(' x '));
        bindings.push( new DataBinding(""+this.height, 8, 2));
        bindings.push( new NilBinding(' (Little Endian)<br />Color Table Size: '));
        bindings.push( new DataBinding(""+this.ctableSize, 10, 1));
        bindings.push( new NilBinding(' 2<sup>(Smallest 3 bits + 1)</sup><br />Sorted: '));
        bindings.push( new DataBinding(""+this.sorted, 10, 1));
        bindings.push( new NilBinding(' (4th smallest bit)<br />Color Resolution of Source: '));
        bindings.push( new DataBinding(""+this.colorRes, 10, 1));
        bindings.push( new NilBinding(' (5th-7th smallest bit)<br />Has Global Table: '));
        bindings.push( new DataBinding(""+this.globalTable, 10, 1));
        bindings.push( new NilBinding(' (largest bit)<br />BG Color Index: '));
        var color = (this.context.globalTable) ? this.context.globalTable.table[this.bgColorIndex] : 0;
        console.log( this.bgColorIndex + ":" + this.context.globalTable);
        bindings.push( new DataBinding(""+this.bgColorIndex + '<span class="colorBox" style="background-color:'+ParseColors.rbgToString(color)+'"></span>', 11, 1));
        bindings.push( new NilBinding('<br />Pixel Aspect Ratio: ' ));
        bindings.push( new DataBinding((this.pixelAspectRatio == 0)?"1:1":"nonzero value: I don't actually know what this means.", 12, 1));

        return {
            start: this.start,
            length: 13,
            binding : bindings,
            color : ParseColors.header,
            descriptor: "Header"
        };
    }
}