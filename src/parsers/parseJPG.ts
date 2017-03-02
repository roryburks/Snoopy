import {BinaryReader} from "../binaryReader";
import {hexStr} from "../main";
import {hexByteStr, Uint8ToString} from "../util";
import {ParseStructure, Parser, Segment, SegmentNode} from "../parsers/parseStructure";
import {Binding, DataBinding_, NilBinding, CellBinding} from "../parsers/parseStructure";
import {ParseColors} from "./colors";

class JPGParser extends Parser{
    error : string = "";
    parsed : ParseStructure;

    sos : SOSData;

    header : SegmentNode;
    huffRoot : SegmentNode;
    quantRoot : SegmentNode;


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

        this.parsed.visualHTML = '<img src="data:image/*;base64,' + btoa(Uint8ToString(this.reader.buffer)) + '" />';
        return this.parsed;
    }
    private parseHeader() : boolean {
        var reader = this.reader;

        // SOI
        if( reader.readByte() != 0xFF || reader.readByte() != 0xD8) {
            this.error = "Not a JPEG file (bad SOI marker)."
            return false;
        }
        this.parsed.segmentTree.getRoot().addSegment( {
            start : 0,
            length : 2,
            color : "#a0a2de",
            title : "Start of Image",
            binding : [new DataBinding_("0xFF", 0, 1), new NilBinding(" "), new DataBinding_("0xD8",1,1)]
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
            var appndata = new UnknownAPPNData(reader,start,len+2);
            appndata.n =  (marker - 0xE0);
            this.parsed.segmentTree.getRoot().addSegment(appndata.constructSegment());
            break;
        case 0xC0:
            var sofdata = new SOFData(reader,start,len+2);
            this.parsed.segmentTree.getRoot().addSegment(sofdata.constructSegment());
            break;
        case 0xC4:
            // Define Huffman Table
            this.huffRoot = this.huffRoot || this.parsed.segmentTree.getRoot().addNullSegment("Huffman Tables");
            this.huffRoot.addSegment( markerSegment(0xC4, start, len, "Huffman Table Marker"));
            while( (start + len + 2)-this.reader.getSeek() > 0) {
                var huffdata = new HuffmanData(reader,this.reader.getSeek(),-1);
                this.huffRoot.addSegment(huffdata.constructSegment());
            }
            break;
        case 0xDA:
            this.sos = new SOSData( reader, start, len);
            this.parsed.segmentTree.getRoot().addSegment(this.sos.constructSegment());
            this.parsed.segmentTree.getRoot().addSegment({
                start: this.reader.getSeek(),
                length: this.reader.getLength() - this.reader.getSeek(),
                color: ParseColors.data,
                binding: [],
                title: "Image Data"
            });
            return false;
        case 0xDB:
            // Define Quantization Table
            this.quantRoot = this.quantRoot || this.parsed.segmentTree.getRoot().addNullSegment("Quantization Tables");
            this.quantRoot.addSegment( markerSegment(0xDB, start, len, "Quantization Table Marker"));
            while( (start + len + 2)-this.reader.getSeek() > 0) {
                var qtdata = new QuantTableData(reader,this.reader.getSeek(),-1);
                this.quantRoot.addSegment(qtdata.constructSegment());
            }
            break;
        case 0xD9:
            this.parsed.segmentTree.getRoot().addSegment({
                start : reader.getSeek() - 2,
                length : 2,
                color: "#777777",
                title: "End of Scan (end of file)",
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

        this.parsed.segmentTree.getRoot().addSegment( {
            binding : [],
            start: start,
            length: length,
            title : str,
            color: "#999999"
        });
    }

    private parseAPP0( start : number, length : number) : boolean {
        var reader = this.reader;

        var identifier = reader.readUTF8Str();

        if( identifier == "JFIF") {
            var data = new JFIFData(reader,start,length);
            this.parsed.segmentTree.getRoot().addSegment( data.constructSegment());
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
            var data = new EXIFData(reader,start,length);
            this.parsed.segmentTree.getRoot().addSegment( data.constructSegment());
        }
        return true;
    }

    private parseSOF0() : boolean {
        return true;
    }
}
export {JPGParser}

function markerSegment(marker : number, start: number, len: number, descriptor:string) : Segment {
    var bindings : Binding[] = [];

    bindings.push( new NilBinding("Marker:"));
    bindings.push( new DataBinding_(""+hexByteStr(marker), start+1, 1));
    bindings.push( new NilBinding(" length:"));
    bindings.push( new DataBinding_(""+len, start+2, 2));

    return {
        start: start, 
        length: 4,
        binding:bindings, 
        color: ParseColors.marker, 
        title: descriptor
    }
}

abstract class SegmentBuilder {
    start : number;
    length : number;
    reader : BinaryReader;
    constructor(reader : BinaryReader, start:number, len:number) {
        this.reader = reader;
        this.start = start;
        this.length = len;
    }
    abstract constructSegment() : Segment;
}

class UnknownAPPNData extends SegmentBuilder {
    n : number;
    
    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len);
    }

    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = "#AAAAAA";
        seg.title = "Unknown Application-Specific Data"

        return seg;
    }
}

class JFIFData extends SegmentBuilder {
    versionMajor : number;
    versionMinor : number;
    pixelDensityUnits : number;
    xDensity : number;
    yDensity : number;
    xThumbnail : number;
    yThumbnail : number;
    thumbnailData : Uint8Array;

    
    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len);
        
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
    }

    constructSegment() : Segment {

        var seg = new Segment();
        var str; 

        seg.start = this.start;
        seg.length = this.length;
        seg.title = "JFIF Application Data";
        seg.color = "#bfc67f";

        var bindings : Binding[] = [];

        bindings.push( new NilBinding("Version: "));
        bindings.push( new DataBinding_( ""+this.versionMajor, seg.start + 9, 1));
        bindings.push( new NilBinding("."));
        bindings.push( new DataBinding_( ""+this.versionMinor, seg.start + 10, 1));
        bindings.push( new NilBinding("<br />Pixel Density Units: "));
        switch( this.pixelDensityUnits) {
        case 0: str = "Pixel Aspect Ratio (0x00)"; break;
        case 1: str = "Pixels Per Inch (0x01)"; break;
        case 2: str = "Pixels per centimeter (0x02)"; break;
        default: str = "Unknown Density Units (0x"+hexStr(this.pixelDensityUnits)+")"; break;
        }
        bindings.push( new DataBinding_(  str, seg.start + 11, 1));
        bindings.push( new NilBinding(": "));
        bindings.push( new DataBinding_(  ""+this.xDensity, seg.start + 12, 2));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding_(  ""+this.yDensity, seg.start + 14, 2));
        bindings.push( new NilBinding("<br />Thumbnail Size:"));
        bindings.push( new DataBinding_(  ""+this.xThumbnail, seg.start + 16, 1));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding_(  ""+this.yThumbnail, seg.start + 17, 1));
        bindings.push( new NilBinding("<br />"));
        if( this.xThumbnail * this.yThumbnail > 0) {
            bindings.push( new NilBinding("Thumbnail:"));
        }


        seg.binding = bindings
        return seg;
    }
}

class EXIFData  extends SegmentBuilder{
    
    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len);
    }


    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = "#26a89d";
        seg.title = "Exif Data";

        return seg;
    }
}

class QuantTableData extends SegmentBuilder {
    highPrec : boolean;
    dest : number;
    table8 : Uint8Array;
    table16 : Uint16Array;

    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len);

        
        var info = reader.readByte();
        this.highPrec = (info >> 4) ? true : false;
        this.dest = info & 0xF;

        if( this.highPrec) {
            this.table16 = new Uint16Array(64);
            for( var i=0; i<64; ++i) {
                this.table16[i] = reader.readUShort();
            }
            this.length = 2*64+1;
        }
        else {
            this.table8 = new Uint8Array(64);
            for( var i=0; i<64; ++i) {
                this.table8[i] = reader.readByte();
            }
            this.length = 64+1;
        }
    }

    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = ParseColors.cyclingColor(0xb2748a);
        seg.title = "Quantization Table Data";
        
        
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

        bindings.push( new DataBinding_((this.highPrec)?"16-bit Table":"8-bit Table"+" (High Nibble)", this.start,1));
        bindings.push( new NilBinding('<br />Destination: '));
        bindings.push( new DataBinding_(""+(this.dest) + " (Low Nibble)", this.start,1));
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
        new DataBinding_(""+entry, this.start + 1 + sizeof * i, sizeof);
    }
}

class SOFData extends SegmentBuilder {
    precision : number;
    width: number;
    height : number;
    numComponents: number;
    cField : number[] = [];
    cFactor : number[] = [];
    cQTable : number[] = [];

    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len);

        this.precision = reader.readByte();
        this.width = reader.readUShort();
        this.height = reader.readUShort();
        this.numComponents = reader.readByte();

        for( var i=0; i< this.numComponents; ++i) {
            this.cField[i] = reader.readByte();
            this.cFactor[i] = reader.readByte();
            this.cQTable[i] = reader.readByte();
        }
    }
    
    constructSegment() : Segment {
        var start = this.start;
        var seg = new Segment();
        seg.color = "#814a8c";
        seg.title = "Start of Frame 0";
        seg.start = this.start;
        seg.length = this.length;

        var bindings : Binding[] = [];

        bindings.push( new DataBinding_(""+this.precision+"-bit Precision",start+4,1));
        bindings.push( new NilBinding("<br />Image Size: "));
        bindings.push( new DataBinding_(""+this.width, start+5, 2));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding_(""+this.height, start+7, 2));
        bindings.push( new NilBinding("<br />Number of Components: "));
        bindings.push( new DataBinding_(""+this.numComponents, start+9, 1));

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
            bindings.push( new DataBinding_(str, start+10 + i*3, 1));
            bindings.push( new NilBinding(" sampling factors: "));
            bindings.push( new DataBinding_(""+(this.cFactor[i]>>4), start+10 + i*3+1, 1));
            bindings.push( new NilBinding("x"));
            bindings.push( new DataBinding_(""+(this.cFactor[i]&0xF), start+10 + i*3+1, 1));
            bindings.push( new NilBinding(" Quantization Table: "));
            bindings.push( new DataBinding_(""+this.cQTable[i], start+10+i*3+2, 1));
        }

        seg.binding = bindings;

        return seg;
    }
}

class HuffmanData extends SegmentBuilder {
    y : boolean;
    dc : boolean;
    id : number;
    numPerRow : number[] = new Array(16);
    table : number[][] = new Array(16);
    codes : Uint16Array;
    raw : Uint8Array;

    minCode = new Uint16Array(16);
    maxCode = new Uint16Array(16);
    valPtr = new Uint16Array(16);
    
    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len);

        var byte = reader.readByte();

        this.id = byte;
        this.y = (byte & 0x1) == 0;
        this.dc = (((byte >> 4)&0x1) == 0);

        var count = 0;
        for( var i=0; i<16; ++i) {
            this.numPerRow[i] = reader.readByte();
            count += this.numPerRow[i];
        }

        this.raw = reader.readBytes(count);

        this.length = 17+count;

        this.constructHuffmanCodes();
    }

    constructSegment() : Segment {

        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = ParseColors.cyclingColor(0x9b4444);
        seg.title = "Huffman Table";

        var bindings : Binding[] = [];

        bindings.push( new NilBinding('Huffman Table Destination:'))
        var str = "" + this.id + "(";
        str += (this.y) ? '<span class="htt">Y<span class="ttt">Luminosity</span></span>':'Color';
        str += " ";
        str +=(this.dc) 
            ? '<span class="htt">DC<span class="ttt">Direct Current Terms of Discrete Cosine Transform</span></span>'
            :'<span class="htt">AC<span class="ttt">Alternating Current Terms of Discrete Cosine Transform</span></span>';
        str += ")";
        bindings.push( new DataBinding_(str, this.start, 1));

        var index = 0;
        bindings.push( new NilBinding( '<table class="simpleTable"><tr><th style="font-size:10px">Bit<br />Length</th><th>Byte the code is mapped to (mouse over for the code)</th></tr>'));
        for( var i=0; i<16; ++i) {
            var n = this.numPerRow[i];
            bindings.push( new NilBinding( '<tr>'));
            bindings.push( new CellBinding('<div class="htt">'+(i+1)+': <span class="ttt">File stores how many entries of length '+(i+1)+' that need to be mapped.</span></div>', this.start + 1 + i, 1));
            bindings.push( new NilBinding( '<td>'));
            for( var j=0; j<n; ++j) {
                var binstr = (this.codes[index]>>>0).toString(2);
                var hexstr = this.raw[index].toString(16);

                while( binstr.length < (i+1)) binstr = "0"+binstr;
                while( hexstr.length < 2) hexstr = "0" + hexstr;


                bindings.push( new DataBinding_( '<div class="htt">'+ hexstr + '<span class="ttt">'+binstr+'</span></div>', this.start + 16+1 + index, 1));
                bindings.push( new NilBinding( "  "));
                index++;
            }
            bindings.push( new NilBinding( '</td></tr>'));
        }
        bindings.push( new NilBinding( '</table>'));


        seg.binding = bindings;

        return seg;
    }

    private constructHuffmanCodes() {
        //First count how many you need
        var count = 0;
        for( var i=0; i<16; ++i) {
            count += this.numPerRow[i];
        }
        var codes = new Uint16Array(count);
        
        // Now apply the algorithm to construct the codes
        var c=0;
        var incr = 0;
        var index = 0;

        for( var i=0; i<16; ++i) {
            if( this.numPerRow[i] == 0) {
                incr <<= 1;
                continue;
            }
            codes[index++] = c = incr * (c+1);
            for( var j=1; j < this.numPerRow[i]; ++j) {
                codes[index++] = ++c;
            }

            incr = 2;
        }

        this.codes = codes;

        // Now construct the short-hand access
        var c=0;
        for( var k=0; k<16; ++k) {
            if( this.numPerRow[k] == 0) {
                this.maxCode[0] = -1;
                continue;
            }

            c+=1;
            this.valPtr[k] = c - 1;
            this.minCode[k] = this.codes[c-1];
            c = c + this.numPerRow[k] - 1;
            this.maxCode[k] = this.codes[c - 1];
        }
    }
}

class SOSData extends SegmentBuilder {

    numComponents: number;
    componentID: Uint8Array;
    htableID: Uint8Array;
    constructor(reader : BinaryReader, start:number, len:number) {
        super(reader, start, len+2);

        this.numComponents = reader.readByte();

        if( len < this.numComponents*2 + 6) throw "Bad SOS Marker";
        if( len > this.numComponents*2 + 6) console.log("Bad SOS Marker (Nonstandard data added?).  Attempting to ignore.");

        this.componentID = new Uint8Array(this.numComponents);
        this.htableID = new Uint8Array(this.numComponents);

        for( var i=0; i<this.numComponents; ++i) {
            this.componentID[i] = reader.readByte();
            this.htableID[i] = reader.readByte();
        }

        // 3 Bytes which are ignored
        reader.setSeek(reader.getSeek()+3);
    }

    
    constructSegment() : Segment {
        var bindings: Binding[] = [];

        bindings.push( new NilBinding("Number of Components: "));
        bindings.push( new DataBinding_(""+this.numComponents,this.start + 4, 1));
        for( var i=0; i<this.numComponents; ++i) {
            bindings.push( new NilBinding("<br />Component #"+i+": "));

            var str;
            switch( this.componentID[i]) {
                case 1: str = "Y"; break;
                case 2: str = "Cb"; break;
                case 3: str = "Cr"; break;
                case 4: str = "I"; break;
                case 5: str = "Q"; break;
                default: str = "Unknown Component type.";
            }
            bindings.push( new DataBinding_(str, this.start + 5 + 2*i, 1));
            bindings.push( new NilBinding(", using Huffman Table: "));
            bindings.push( new DataBinding_(""+this.htableID[i], this.start + 5 + 2*i + 1, 1));
        }
        bindings.push( new NilBinding("<br />"));
        bindings.push( new DataBinding_("Unused Data", this.start + 5 + 2*this.numComponents, 3));
        return {
            start: this.start,
            length: this.length,
            color: "#AAAA55",
            binding: bindings,
            title: "Start of Scan Block"
        }
    }
}