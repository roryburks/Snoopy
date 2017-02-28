import {BinaryReader} from "../binaryReader";
import {ParseStructure, Parser, Segment, Binding, NilBinding, DataBinding, CellBinding}
     from "./parseStructure";
import {ParseColors} from "./colors";
import {randcolor} from "../util";


export class GIFParser extends Parser {
    parsed : ParseStructure;

    header : HeaderSegment;
    globalTable : ColorTable = null;
    
    parse() : ParseStructure {
        this.parsed = new ParseStructure();

        this.header = new HeaderSegment( this.reader, 0, this);
        if( this.header.bad) return null;

        if( this.header.globalTable) {
            this.globalTable = new ColorTable(this.reader, this.reader.getSeek(), this, this.header.ctableSize);
        }

        this.parsed.segments.push(this.header.constructSegment());
        if( this.header.globalTable) {
            var seg = this.globalTable.constructSegment();
            seg.descriptor = "Global Color Table";
            this.parsed.segments.push(seg);
        }

        while( true) {
            var start = this.reader.getSeek();
            var marker = this.reader.readByte();

            if( marker == 0x3B) {
            console.log( "3B");
                this.parsed.segments.push( {
                    start : this.reader.getSeek()-1,
                    length : 1,
                    color : "#AACCCC",
                    binding : [],
                    descriptor : "Trailer (End of File Marker)"
                });
                break;
            }
            else if( marker == 0x2C) {
                //   Image Super-Segment
                var imgDesc = new ImageDescriptor( this.reader, start, this);
                this.parsed.segments.push( imgDesc.constructSegment());
                if( imgDesc.hasColorTable) {
                    var cTable = new ColorTable( this.reader, this.reader.getSeek(), this, imgDesc.ctableSize);
                    this.parsed.segments.push( cTable.constructSegment());
                }
                var imgData = new ImageData( this.reader, this.reader.getSeek(), this);
                this.parsed.segments.push( imgData.constructSegment());
            }
            else {
                if( marker == undefined) break;
                marker = (marker << 8) + this.reader.readByte();
                var len = this.reader.readByte();
                console.log( marker.toString(16) +"," + len + ":" + start);

                var data : SegmentData;
                switch( marker) {
                    case 0x21F9:
                    data = new GraphicsControlSegment( this.reader, start, this, len);
                    break;
                    case 0x21FE:
                    data = new CommentExtension( this.reader, start, this, len);
                    break;
                    case 0x21FF:
                    data = new ApplicationExtension(this.reader, start, this, len);
                    len += (data as ApplicationExtension).sublen + 1;
                    break;
                    default:
                    data = new UnknownBlock( this.reader, start, this, marker, len);
                    break;
                }
                this.parsed.segments.push( data.constructSegment());
                this.reader.setSeek( start + 4 + len);
            }
        }

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

class UnknownBlock extends SegmentData {
    id : number;
    length : number;
    constructor( reader : BinaryReader, start:number, context : GIFParser, id : number, length : number) {
        super( reader, start, context);
        this.id = id;
        this.length = length;
    }
    constructSegment() : Segment {
        return {
            start: this.start,
            length : this.length + 4,
            color : randcolor(),
            binding : [],
            descriptor : "Unknown Block Type: " + this.id.toString(16)
        };
    }
}

class CommentExtension extends SegmentData {
    length : number;
    comment : string;
    constructor( reader : BinaryReader, start:number, context : GIFParser, length : number) {
        super( reader, start, context);
        this.length = length;

        this.comment = reader.readUTF8StrLen(length);
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];

        bindings.push( new DataBinding('<span class="comment">'+this.comment+'</span>', this.start+3, this.length));

        return {
            start: this.start,
            length : this.length + 4,
            color : randcolor(),
            binding : bindings,
            descriptor : "Comment Extension"
        };
    }
}

class ApplicationExtension extends SegmentData {
    len : number;
    identifier : string;
    authentifier : string;

    sublen : number;
    constructor( reader : BinaryReader, start:number, context : GIFParser, length : number) {
        super( reader, start, context);

        this.len = length;
        this.identifier = reader.readUTF8StrLen(8);
        this.authentifier = reader.readUTF8StrLen(3);

        this.sublen = reader.readByte();
    }
    
    constructSegment() : Segment {
        var bindings : Binding[] = [];

        bindings.push( new NilBinding( "Application: "));
        bindings.push( new DataBinding( this.identifier, this.start + 3, 8));
        bindings.push( new NilBinding( "<br />Authentifier: "));
        bindings.push( new DataBinding( this.authentifier, this.start + 11, 3));
        return {
            start: this.start,
            length : this.len + this.sublen + 5,
            color : randcolor(),
            binding : bindings,
            descriptor : "Application Block"
        };
    }
}



class GraphicsControlSegment extends SegmentData {
    length : number;
    constructor( reader : BinaryReader, start:number, context : GIFParser, length : number) {
        super( reader, start, context);
        this.length = length;

        var packed = reader.readByte();
        // TODO
    }
    constructSegment() : Segment {
        return {
            start : this.start,
            length : this.length + 4,
            binding : [],
            color : randcolor(),
            descriptor : "Graphics Control Extension" 
        };
    }

}

class ImageDescriptor extends SegmentData {
    left : number;
    top : number;
    width: number;
    height : number;

    
    ctableSize : number;
    sorted : boolean;
    hasColorTable : boolean;
    interlaced : boolean;

    constructor( reader : BinaryReader, start:number, context : GIFParser) {
        super( reader, start, context);

        this.left = reader.readUShortLE();
        this.top = reader.readUShortLE();
        this.width = reader.readUShortLE();
        this.height = reader.readUShortLE();

        var packed = reader.readByte();

        this.hasColorTable = (packed >> 7) == 1;
        this.interlaced = (packed >> 6) == 1;
        this.sorted = (packed >> 5) == 1;
        this.ctableSize = (this.hasColorTable) ? 1 << ((packed & 0x7)+1) : 0;
    }
    constructSegment() : Segment {
        var bindings :Binding[] = [];

        bindings.push( new NilBinding( "Offset: "));
        bindings.push( new DataBinding("" + this.left, this.start + 1, 2));
        bindings.push( new NilBinding( " x "));
        bindings.push( new DataBinding("" + this.top, this.start + 3, 2));
        bindings.push( new NilBinding( "<br />Size: "));
        bindings.push( new DataBinding("" + this.width, this.start + 5, 2));
        bindings.push( new NilBinding( " x "));
        bindings.push( new DataBinding("" + this.height, this.start + 7, 2));
        bindings.push( new NilBinding( "<br />Has Local Color Table: "));
        bindings.push( new DataBinding( ""+this.hasColorTable, this.start + 9, 1));
        bindings.push( new NilBinding( "<br />Color Table Size: "));
        bindings.push( new DataBinding( ""+this.ctableSize, this.start + 9, 1));
        bindings.push( new NilBinding( "<br />Is Sorted: "));
        bindings.push( new DataBinding( ""+this.sorted, this.start + 9, 1));
        bindings.push( new NilBinding( "<br />Interlaced: "));
        bindings.push( new DataBinding( ""+this.interlaced, this.start + 9, 1));

        return {
            start : this.start,
            length : 10,
            binding : bindings,
            color : randcolor(),
            descriptor : "Image Descriptor"
        };
    }
}


class ImageData extends SegmentData {
    LZWMin : number;
    len : number;
    
    constructor( reader : BinaryReader, start:number, context : GIFParser) {
        super( reader, start, context);

        this.LZWMin = reader.readByte();

        var size = reader.readByte();

        while( size != 0) {
            reader.readBytes(size);
            size = reader.readByte();
        }

        this.len = this.reader.getSeek() - this.start;
    }
    constructSegment() : Segment {
        return {
            start : this.start,
            length : this.len,
            binding : [],
            color : randcolor(),
            descriptor : "Image Data"
        };
    }
}

class ColorTable extends SegmentData {
    size : number;
    table : Uint32Array;
    constructor( reader : BinaryReader, start:number, context : GIFParser, size : number) {
        super( reader, start, context);
        this.size = size;
        this.table = new Uint32Array( this.size);

        for( var i=0; i < this.size; ++i) {
            this.table[i] = this.reader.readRGB();
        }

    }
    
    constructSegment() : Segment {
        var bindings : Binding[] = [];

        var n = Math.ceil( Math.sqrt(this.size));

        bindings.push( new NilBinding('<table class="colorTable">'));
        for( var row=0; row < n; ++row) {
            bindings.push( new NilBinding('<tr>'));
            bindings.push( new NilBinding('<td>'+row*n+'-'+(row*n+n-1)+'</td>'));
            for( var col=0; col < n; ++col) {
                var index = row*n + col;
                if( index >= this.size)break;
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
            descriptor : "Color Table"
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
        this.globalTable = (packed & 0x80) != 0;
        this.colorRes = (packed >> 4) & 0x7;
        this.sorted = (packed & 0x8) != 0;
        this.ctableSize = (this.globalTable) ? 1 << ((packed & 0x7)+1) : 0;

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