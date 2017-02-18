import {BinaryReader} from "./binaryReader";
import {hexStr} from "./main";
import {ParseStructure} from "./parseStructure";
import {Segment} from "./parseStructure";
import {Binding, DataBinding, NilBinding} from "./parseStructure";

class JPGParser {
    reader : BinaryReader;
    error : string = "";
    parsed : ParseStructure;

    constructor( buffer : Uint8Array) {
        this.reader = new BinaryReader(buffer);
    }
    getError() : string{
        return this.error;
    }
    parse() : ParseStructure {
        this.parsed = new ParseStructure();
        if( !this.parseHeader()) return null;
        if( !this.parseSegment()) return null;
        if( !this.parseSegment()) return null;
        if( !this.parseSegment()) return null;

        return this.parsed;
    }
    private parseHeader() : boolean {
        var reader = this.reader;

        // SOI
        if( reader.readByte() != 0xFF || reader.readByte() != 0xD8) {
            this.error = "Not a JPEG file (bad SOI marker)."
            return false;
        }
        this.parsed.segments.push( {
            start : 0,
            length : 2,
            color : "#a0a2de",
            descriptor : "Start of Image",
            binding : [new DataBinding("0xFF", 0, 1), new NilBinding(" "), new DataBinding("0xD8",1,1)]
        });

        return true;
    }
    private parseSegment() : boolean {
        var reader = this.reader;
        if( reader.readByte() != 0xFF) {
            this.error = "Unexpected byte where Marker should be (expected 0xFF)."
            return false;
        }

        var marker = reader.readByte();

        switch( marker) {
        case 0xE0:
            return this.parseAPP0();
        case 0xE1:
            return this.parseAPP1();
        case 0xE2:case 0xE3:case 0xE4:case 0xE5:case 0xE6:case 0xE7:case 0xE8:
        case 0xE9:case 0xEA:case 0xEB:case 0xEC:case 0xED:case 0xEE:case 0xEF:
            return this.parseAPPN(marker - 0xE0);
        case 0xDB:
            return this.parseQuantizationTable();
        default:
            console.log("Unrecognized Marker in JPEG file: 0xFF " + hexStr(marker));
        }

        return true;
    }

    private parseAPP0() : boolean {
        var reader = this.reader;
        var start = reader.getSeek() - 2;
        var len = reader.readUShort();

        var identifier = reader.readUTF8Str();

        if( identifier == "JFIF") {
            var data = new JFIFData();

            data.start = start;
            data.length = len + 2;
            data.versionMajor = reader.readByte();
            data.versionMinor = reader.readByte();
            data.pixelDensityUnits = reader.readByte();
            data.xDensity = reader.readUShort();
            data.yDensity = reader.readUShort();
            data.xThumbnail = reader.readByte();
            data.yThumbnail = reader.readByte();
            if( data.xThumbnail * data.yThumbnail > 0) {
                data.thumbnailData = reader.readBytes(data.xThumbnail*data.yThumbnail*3);
            }
            this.parsed.segments.push( data.constructSegment());
        }
        else if( identifier == "JFXX") {
            console.log( "JFXX: Unimplemented");
        }
        else {
            console.log( "Unknown APP0 identifier (" + identifier + "), skipping.");
        }

        reader.setSeek( start + len + 2);
        return true;
    }
    
    private parseAPP1() : boolean {
        var reader = this.reader;
        var start = reader.getSeek() - 2;
        var len = reader.readUShort();
        
        
        var identifier = reader.readUTF8Str();

        if( identifier == "Exif") {
            var data = new EXIFData();
            data.start = start;
            data.length = len + 2;
            this.parsed.segments.push( data.constructSegment());
        }

        reader.setSeek( start + len + 2);
        return true;
    }

    private parseAPPN(n : number) : boolean {
        var reader = this.reader;
        var start = reader.getSeek() - 2;
        var len = reader.readUShort();
        
        var data = new UnknownAPPNData();
        data.start = start;
        data.length = len + 2;
        data.n = n;
        this.parsed.segments.push(data.constructSegment());
        
        reader.setSeek( start + len + 2);
        return true;
    }

    private parseSOF0() : boolean {
        return true;
    }

    private parseQuantizationTable() : boolean {
        var reader = this.reader;
        var start = reader.getSeek() - 2;
        var len = reader.readUShort();

        var info = reader.readByte();

        var data = new QuantTableData();
        data.start = start;
        data.length = len + 2;
        data.highPrec = (info >> 4) ? true : false;
        data.dest = info & 0xF;

        if( data.highPrec) {
            data.table16 = new Uint16Array(64);
            for( var i=0; i<64; ++i) {
                data.table16[i] = reader.readUShort();
            }
        }
        else {
            data.table8 = new Uint8Array(64);
            for( var i=0; i<64; ++i) {
                data.table8[i] = reader.readByte();
            }
        }
        this.parsed.segments.push(data.constructSegment());
        reader.setSeek( start + len + 2);
        return true;
    }
}
export {JPGParser}

interface SegmentBuilder {
    start : number;
    length : number;
    constructSegment() : Segment;
}

class UnknownAPPNData implements SegmentBuilder {
    start : number;
    length : number;
    n : number;
    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = "#AAAAAA";
        seg.descriptor = "Unknown Application-Specific Data"

        return seg;
        
    }

}

class JFIFData implements SegmentBuilder {
    start : number;
    length : number;
    versionMajor : number;
    versionMinor : number;
    pixelDensityUnits : number;
    xDensity : number;
    yDensity : number;
    xThumbnail : number;
    yThumbnail : number;
    thumbnailData : Uint8Array;

    constructSegment() : Segment {
        var seg = new Segment();
        var str; 

        seg.start = this.start;
        seg.length = this.length;
        seg.descriptor = "JFIF Application Data";
        seg.color = "#bfc67f";

        var bindings : Binding[] = [];

        bindings.push( new NilBinding("Version: "));
        bindings.push( new DataBinding( ""+this.versionMajor, seg.start + 9, 1));
        bindings.push( new NilBinding("."));
        bindings.push( new DataBinding( ""+this.versionMinor, seg.start + 10, 1));
        bindings.push( new NilBinding("<br />Pixel Density Units: "));
        switch( this.pixelDensityUnits) {
        case 0: str = "Pixel Aspect Ratio (0x00)"; break;
        case 1: str = "Pixels Per Inch (0x01)"; break;
        case 2: str = "Pixels per centimeter (0x02)"; break;
        default: str = "Unknown Density Units (0x"+hexStr(this.pixelDensityUnits)+")"; break;
        }
        bindings.push( new DataBinding(  str, seg.start + 11, 1));
        bindings.push( new NilBinding(": "));
        bindings.push( new DataBinding(  ""+this.xDensity, seg.start + 12, 2));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding(  ""+this.yDensity, seg.start + 14, 2));
        bindings.push( new NilBinding("<br />Thumbnail Size:"));
        bindings.push( new DataBinding(  ""+this.xThumbnail, seg.start + 16, 1));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding(  ""+this.yThumbnail, seg.start + 17, 1));
        bindings.push( new NilBinding("<br />"));
        if( this.xThumbnail * this.yThumbnail > 0) {
            bindings.push( new NilBinding("Thumbnail:"));
        }


        seg.binding = bindings
        return seg;
    }
}

class EXIFData  implements SegmentBuilder{
    start : number;
    length : number;


    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = "#26a89d";
        seg.descriptor = "Exif Data";

        return seg;
    }
}

class QuantTableData implements SegmentBuilder {
    start : number;
    length : number;
    highPrec : boolean;
    dest : number;
    table8 : Uint8Array;
    table16 : Uint16Array;

    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = "#b2748a";
        seg.descriptor = "Quantization Table Data";
        
        
        var table, size;
        if( this.table8) {
            table = this.table8;
            size = 1;
        }
        else {
            table = this.table16;
            size = 2;
        }
        var elements : Binding[] = new Array(64);

        var i=0;
        var x=0, y=0;
        this.ele( x, y, elements, table[i], i, size);
        while( i < 64) {
            // Top/Right edge
            if( x < 7) {++x; ++i;}
            else {++y; ++i;}
            this.ele( x, y, elements, table[i], i, size);

            // Zig downleft
            while( x > 0 && y < 7) {
                --x; ++y; ++i;
                this.ele( x, y, elements, this.table8[i], i, 1);
            }
            // Bottom/Left edge
            if( y == 7) {++x; ++i;}
            else{++y; ++i;}
            this.ele( x, y, elements, table[i], i, size);

            if( x == 7 && y == 7) break;

            // Zag upright
            while( x < 7 && y > 0) {
                ++x; --y; ++i;
                this.ele( x, y, elements, this.table8[i], i, 1);
            }
        }

        var bindings : Binding[] = [];

        bindings.push( new DataBinding((this.highPrec)?"16-bit Table":"8-bit Table"+" (High Nibble)", this.start+4,1));
        bindings.push( new NilBinding('<br />Destination: '));
        bindings.push( new DataBinding(""+(this.dest) + " (Low Nibble)", this.start+4,1));
        bindings.push(new NilBinding('<br />Table:<br />'));
        bindings.push( new NilBinding('<div class="matrix"><span class="matrixLeft"></span><table class="matrixContent">'));
        for( var x=0; x<8; ++x) {
            bindings.push(new NilBinding('<tr class="matrixRow">'));
            for( var y=0; y<8; ++y) {
                var index = x + y*8;
                if( !elements[index]) {
                    console.log( x +","+ y);
                }
                bindings.push( elements[index]);
            }
            bindings.push(new NilBinding('</tr>'));
        }
        bindings.push( new NilBinding('</table><span class="matrixRight"></span></div>'));

        seg.binding = bindings;

        return seg;
    }

    private ele( x: number, y : number, elements : Binding[], entry : number, i : number, sizeof : number) {
        console.log(i + "("+x+","+y+")");
        elements[x*8+y] = 
        new DataBinding('<td class="matrixElement">'+entry+'</td>', 5 + sizeof * i, sizeof);
    }
}