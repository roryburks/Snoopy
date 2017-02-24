import {BinaryReader} from "../binaryReader";
import {hexStr} from "../main";
import {ParseStructure, Parser, Segment} from "../parsers/parseStructure";
import {Binding, DataBinding, NilBinding} from "../parsers/parseStructure";

class JPGParser extends Parser{
    error : string = "";
    parsed : ParseStructure;

    constructor( buffer : Uint8Array) {
        super(buffer);
    }
    getError() : string{
        return this.error;
    }
    parse() : ParseStructure {
        this.parsed = new ParseStructure();
        if( !this.parseHeader()) return null;

        while( this.parseSegment()) {}

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

        var reader = this.reader;
        var start = reader.getSeek() - 2;
        var len = reader.readUShort();
        switch( marker) {
        case 0xE0:
            this.parseAPP0(start, len+2);
            break;
        case 0xE1:
            this.parseAPP1(start, len+2);
            break;
        case 0xE2:case 0xE3:case 0xE4:case 0xE5:case 0xE6:case 0xE7:case 0xE8:
        case 0xE9:case 0xEA:case 0xEB:case 0xEC:case 0xED:case 0xEE:case 0xEF:
            var appndata = new UnknownAPPNData();
            appndata.n =  (marker - 0xE0);
            this.parsed.segments.push(appndata.constructSegment(reader,start,len+2));
            break;
        case 0xC0:
            var sofdata = new SOFData();
            this.parsed.segments.push(sofdata.constructSegment(reader,start,len+2));
            break;
        case 0xC4:
            var huffdata = new HuffmanData();
            this.parsed.segments.push(huffdata.constructSegment(reader,start,len+2));
            break;
//        case 0xDA:
//            return this.parseSOS();
        case 0xDB:
            var qtdata = new QuantTableData();
            this.parsed.segments.push(qtdata.constructSegment(reader,start,len+2));
            break;
        case 0xD9:
            this.parsed.segments.push({
                start : reader.getSeek() - 2,
                length : 2,
                color: "#777777",
                descriptor: "End of Scan (end of file)",
                binding: []
            });
            return false;
        default:
            this.parseUnsupported( marker, start, len+2);
        }
        reader.setSeek( start + len + 2);

        return true;
    }
    private parseUnsupported( marker: number, start: number, length : number) {
        var str;

        if( marker == 0xC8)
            str = "Reserved Internal Data";
        else if( marker == 0xF0 || marker == 0xFD || marker == 0xDE || marker == 0xDF)
            str = "Ignore (Skip).  Whatever that means.";
        else if( marker > 0xC1 && marker <= 0xCF) 
            str = "Unsupported Start of Frame Segment #" + (marker - 0xC0);
        else if( marker >= 0xD0 && marker <= 0xD7)
            str = "RTSn for Resync (ignore).";
        else if( marker == 0xCC)
            str = "Arithmetic Table";
        else str = "Unknown Tag: " + hexStr(marker);

        this.parsed.segments.push( {
            binding : [],
            start: start,
            length: length,
            descriptor : str,
            color: "#999999"
        });
    }

    private parseAPP0( start : number, length : number) : boolean {
        var reader = this.reader;

        var identifier = reader.readUTF8Str();

        if( identifier == "JFIF") {
            var data = new JFIFData();
            this.parsed.segments.push( data.constructSegment(reader,start,length));
        }
        else if( identifier == "JFXX") {
            console.log( "JFXX: Unimplemented");
        }
        else {
            console.log( "Unknown APP0 identifier (" + identifier + "), skipping.");
        }

        return true;
    }
    
    private parseAPP1(start: number, length: number) : boolean {
        var reader = this.reader;
        var identifier = reader.readUTF8Str();

        if( identifier == "Exif") {
            var data = new EXIFData();
            this.parsed.segments.push( data.constructSegment(reader,start,length));
        }
        return true;
    }

    private parseSOF0() : boolean {
        return true;
    }
}
export {JPGParser}

interface SegmentBuilder {
    start : number;
    length : number;
    constructSegment(reader : BinaryReader, start:number, len:number) : Segment;
}

class UnknownAPPNData implements SegmentBuilder {
    start : number;
    length : number;
    n : number;
    constructSegment(reader : BinaryReader, start:number, len:number) : Segment {
        var seg = new Segment();
        seg.start = start;
        seg.length = len;
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

    constructSegment(reader : BinaryReader, start:number, len:number) : Segment {
        this.start = start;
        this.length = len
        this.versionMajor = reader.readByte();
        this.versionMinor = reader.readByte();
        this.pixelDensityUnits = reader.readByte();
        this.xDensity = reader.readUShort();
        this.yDensity = reader.readUShort();
        this.xThumbnail = reader.readByte();
        this.yThumbnail = reader.readByte();
        if( this.xThumbnail * this.yThumbnail > 0) {
            this.thumbnailData = reader.readBytes(this.xThumbnail*this.yThumbnail*3);
        }

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


    constructSegment(reader : BinaryReader, start:number, len:number) : Segment {
        var seg = new Segment();
        seg.start = start;
        seg.length = len;
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

    constructSegment(reader : BinaryReader, start:number, len:number) : Segment {
        var info = reader.readByte();
        this.start = start;
        this.length = len;
        this.highPrec = (info >> 4) ? true : false;
        this.dest = info & 0xF;

        if( this.highPrec) {
            this.table16 = new Uint16Array(64);
            for( var i=0; i<64; ++i) {
                this.table16[i] = reader.readUShort();
            }
        }
        else {
            this.table8 = new Uint8Array(64);
            for( var i=0; i<64; ++i) {
                this.table8[i] = reader.readByte();
            }
        }

        var seg = new Segment();
        seg.start = start;
        seg.length = len;
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
                bindings.push( new NilBinding('<td class="matrixElement">'))
                bindings.push( elements[index]);
                bindings.push( new NilBinding('</td>'));
            }
            bindings.push(new NilBinding('</tr>'));
        }
        bindings.push( new NilBinding('</table><span class="matrixRight"></span></div>'));

        seg.binding = bindings;

        return seg;
    }

    private ele( x: number, y : number, elements : Binding[], entry : number, i : number, sizeof : number) {
        elements[x*8+y] = 
        new DataBinding(""+entry, this.start + 5 + sizeof * i, sizeof);
    }
}

class SOFData implements SegmentBuilder {
    start : number;
    length : number;
    precision : number;
    width: number;
    height : number;
    numComponents: number;
    cField : number[] = [];
    cFactor : number[] = [];
    cQTable : number[] = [];
    
    constructSegment(reader : BinaryReader, start:number, len:number) : Segment {
        this.start = start;
        this.length = len;
        this.precision = reader.readByte();
        this.width = reader.readUShort();
        this.height = reader.readUShort();
        this.numComponents = reader.readByte();

        for( var i=0; i< this.numComponents; ++i) {
            this.cField[i] = reader.readByte();
            this.cFactor[i] = reader.readByte();
            this.cQTable[i] = reader.readByte();
        }

        var seg = new Segment();
        seg.color = "#814a8c";
        seg.descriptor = "Start of Frame 0";
        seg.start = this.start;
        seg.length = this.length;

        var bindings : Binding[] = [];

        bindings.push( new DataBinding(""+this.precision+"-bit Precision",start+4,1));
        bindings.push( new NilBinding("<br />Image Size: "));
        bindings.push( new DataBinding(""+this.width, start+5, 2));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding(""+this.height, start+7, 2));
        bindings.push( new NilBinding("<br />Number of Components: "));
        bindings.push( new DataBinding(""+this.numComponents, start+9, 1));

        for( var i=0; i<this.numComponents; ++i) {
            bindings.push( new NilBinding("<br />Component " +i +": "));
            var str = "?";
            switch(this.cField[i]) {
                case 1: str="Y";break;
                case 2: str="Cb";break;
                case 3: str="Cr";break;
                case 4: str="I";break;
                case 5: str="Q";break;
            }
            bindings.push( new DataBinding(str, start+10 + i*3, 1));
            bindings.push( new NilBinding(" sampling factors: "));
            bindings.push( new DataBinding(""+(this.cFactor[i]>>4), start+10 + i*3+1, 1));
            bindings.push( new NilBinding("x"));
            bindings.push( new DataBinding(""+(this.cFactor[i]&0xF), start+10 + i*3+1, 1));
            bindings.push( new NilBinding(" Quantization Table: "));
            bindings.push( new DataBinding(""+this.cQTable[i], start+10+i*3+2, 1));
        }

        seg.binding = bindings;
        

        return seg;
    }
}

class HuffmanData implements SegmentBuilder {
    start : number;
    length : number;
    id : number;
    dc : boolean;
    numPerRow : number[] = new Array(16);
    table : number[][] = new Array(16);
    codes : Uint16Array;

    constructSegment(reader : BinaryReader, start:number, len:number) : Segment {
        this.start = start;
        this.length = len;

        var byte = reader.readByte();

        this.id = byte & 0x7;
        this.dc = (((byte >> 3)&0x1) == 0);

        for( var i=0; i<16; ++i) {
            this.numPerRow[i] = reader.readByte();
        }

//        var bs  = new BitSeeker(reader);

        for( var i=0; i<16; ++i) {
            var n = this.numPerRow[i];
            this.table[i] = new Array(n);
            for( var j=0; j<n; ++j) {
//                this.table[i][j] = bs.readBits(i+1);
            }
        }

        var seg = new Segment();
        seg.start = start;
        seg.length = len;
        seg.color = "#9b4444";
        seg.descriptor = "Huffman Table";

        var bindings : Binding[] = [];

        for( var i=0; i<16; ++i) {
            var n = this.numPerRow[i];
                bindings.push( new NilBinding((i+1)+":"));
            for( var j=0; j<n; ++j) {
                var str = (this.table[i][j]>>>0).toString(2);

                while( str.length < (i+1)) str = "0"+str;
                bindings.push( new NilBinding( str+ " "));
            }
                bindings.push( new NilBinding(" <br />"));
        }


        seg.binding = bindings;

        return seg;
    }

    private constructHuffmanCodes() {
        var count = 0;
        for( var i=0; i<16; ++i) {
            count += this.numPerRow[i];
        }

    }
}
