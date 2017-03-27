import {BinaryReader} from "../binaryReader";
import {hexStr} from "../main";
import {hexByteStr, Uint8ToString} from "../util";
import {ParseStructure, Parser, Segment, SegmentNode} from "../parsers/parseStructure";
import {UIComponents, UIComponent, DataLink} from "../parsers/parseStructure";
import {ParseColors} from "./colors";
import {BinaryReaderLinker, BinLinks, SpecialLinks} from "./binReaderLinker";

class JPGParser extends Parser{
    lread : BinaryReaderLinker;
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
        this.lread = new BinaryReaderLinker(this.data);

        if( !this.parseHeader()) return null;

        while( this.parseSegment()) {}

        this.parsed.visualHTML = '<img src="data:image/*;base64,' + btoa(Uint8ToString(this.data)) + '" />';
        return this.parsed;
    }
    private parseHeader() : boolean {
        var reader = this.lread;

        // SOI
        var a = reader.readByte();
        var b = reader.readByte();
        if( a.get(this.data) != 0xFF || b.get(this.data) != 0xD8) {
            this.error = "Not a JPEG file (bad SOI marker)."
            return false;
        }
        this.parsed.segmentTree.getRoot().addSegment( {
            start : 0,
            length : 2,
            color : "#a0a2de",
            title : "Start of Image",
            uiComponents : [new UIComponents.SimpleUIC("%Dh %Dh", 0, 1)],
            links : [a, b]
        });

        return true;
    }
    private parseSegment() : boolean {
        var reader = this.lread;
        if( reader.readByte().get(this.data) != 0xFF) {
            this.error = "Unexpected byte where Marker should be (expected 0xFF)."
            return false;
        }

        var marker = reader.readByte().get(this.data);

        var start = reader.getSeek() - 2;
        var len = reader.readUShort().get(this.data);
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
            while( (start + len + 2)-this.lread.getSeek() > 0) {
                var huffdata = new HuffmanData(reader,this.lread.getSeek(),-1);
                this.huffRoot.addSegment(huffdata.constructSegment());
            }
            break;
        case 0xDA:
            this.sos = new SOSData( reader, start, len);
            this.parsed.segmentTree.getRoot().addSegment(this.sos.constructSegment());
            this.parsed.segmentTree.getRoot().addSegment({
                start: this.lread.getSeek(),
                length: this.lread.getLength() - this.lread.getSeek(),
                color: ParseColors.data,
                uiComponents : [],
                links : [],
                title: "Image Data"
            });
            return false;
        case 0xDB:
            // Define Quantization Table
            this.quantRoot = this.quantRoot || this.parsed.segmentTree.getRoot().addNullSegment("Quantization Tables");
            this.quantRoot.addSegment( markerSegment(0xDB, start, len, "Quantization Table Marker"));
            while( (start + len + 2)-this.lread.getSeek() > 0) {
                var qtdata = new QuantTableData(reader,this.lread.getSeek(),-1);
                this.quantRoot.addSegment(qtdata.constructSegment());
            }
            break;
        case 0xD9:
            this.parsed.segmentTree.getRoot().addSegment({
                start : reader.getSeek() - 2,
                length : 2,
                color: "#777777",
                title: "End of Scan (end of file)",
                uiComponents : [],
                links : [],
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
            uiComponents : [],
            links : [],
            start: start,
            length: length,
            title : str,
            color: "#999999"
        });
    }

    private parseAPP0( start : number, length : number) : boolean {
        var reader = this.lread;

        var identifier = reader.readUTF8Str().get(this.data);

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
        var reader = this.lread;
        var identifier = reader.readUTF8Str().get(this.data);

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
    // TODO
/*    var bindings : Binding[] = [];

    bindings.push( new NilBinding("Marker:"));
    bindings.push( new DataBinding_(""+hexByteStr(marker), start+1, 1));
    bindings.push( new NilBinding(" length:"));
    bindings.push( new DataBinding_(""+len, start+2, 2));*/

    return {
        start: start, 
        length: 4,
        uiComponents : [],
        links : [],
        color: ParseColors.marker, 
        title: descriptor
    }
}

abstract class SegmentBuilder {
    start : number;
    length : number;
    reader : BinaryReaderLinker;
    constructor(reader : BinaryReaderLinker, start:number, len:number) {
        this.reader = reader;
        this.start = start;
        this.length = len;
    }
    abstract constructSegment() : Segment;
}

class UnknownAPPNData extends SegmentBuilder {
    n : number;
    
    constructor(reader : BinaryReaderLinker, start:number, len:number) {
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
    versionMajor : DataLink;
    versionMinor : DataLink;
    pixelDensityUnits : DataLink;
    xDensity : DataLink;
    yDensity : DataLink;
    xThumbnail : BinLinks.ByteLink;
    yThumbnail : BinLinks.ByteLink;
    thumbnailData : DataLink;

    
    constructor(reader : BinaryReaderLinker, start:number, len:number) {
        super(reader, start, len);
        
        this.versionMajor = reader.readByte();
        this.versionMinor = reader.readByte();
        this.pixelDensityUnits = new SpecialLinks.EnumLink(
            reader.readByte(),
            {
                "0":"Pixel Aspect Ration",
                "1":"Pixels per Inch",
                "2":"Pixels per Centimeter"
            },"Unknown Density Units");
        this.xDensity = reader.readUShort();
        this.yDensity = reader.readUShort();
        this.xThumbnail = reader.readByte();
        this.yThumbnail = reader.readByte();

        var tx = this.xThumbnail.get( this.reader.buffer);
        var ty = this.yThumbnail.get( this.reader.buffer);
        if( tx * ty > 0) {
            this.thumbnailData = reader.readBytes(tx*ty*3);
        }
    }

    constructSegment() : Segment {

        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];


        uiComponents.push( new UIComponents.SimpleUIC(
            "Version: %D.%D<br />", 
            links.push(this.versionMajor)-1, links.push(this.versionMinor)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Pixel Density: %D x %D  %D<br />", 
            links.push(this.xDensity)-1, links.push(this.yDensity)-1,links.push(this.pixelDensityUnits)-1));

        uiComponents.push( new UIComponents.SimpleUIC(
            "Thumbnail Size: %D x %D<br />", 
            links.push(this.xThumbnail)-1, links.push(this.yThumbnail)-1));        

        var tx = this.xThumbnail.get( this.reader.buffer);
        var ty = this.yThumbnail.get( this.reader.buffer);
        if( tx * ty > 0) {
            uiComponents.push( new UIComponents.SimpleUIC(
                "Thumbnail: "));
        }

        console.log( this.start + ":" + this.length);


        return {
            uiComponents : uiComponents,
            links : links,
            start: this.start,
            length: this.length,
            title: "JFIF Application Data",
            color: "#bfc67f",
        };
    }
}

class EXIFData  extends SegmentBuilder{
    
    constructor(reader : BinaryReaderLinker, start:number, len:number) {
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
    highPrec : SpecialLinks.PartialByteLink;
    dest : SpecialLinks.PartialByteLink;
    table : BinLinks.PackedNumberLink;

    constructor(reader : BinaryReaderLinker, start:number, len:number) {
        super(reader, start, len);
        
        var info = reader.readByte();
        this.highPrec = new SpecialLinks.PartialByteLink( info, 4, 4);
        this.dest = new SpecialLinks.PartialByteLink( info, 0, 4);

        var seek = this.reader.getSeek()
        var hp = this.highPrec.get(reader.buffer);
        if( hp) {
            this.table = new BinLinks.PackedNumberLink(seek, 64, 2, false);
            this.length = 2*64+1;
        }
        else {
            this.table = new BinLinks.PackedNumberLink(seek, 64, 1, false);
            this.length = 64+1;
        }
        reader.setSeek( seek + this.length-1);
    }

    constructSegment() : Segment {
        var hp = this.highPrec.get(this.reader.buffer);


        var tLinks : DataLink[] = new Array(64);

        var i=0;
        var x=0, y=0;
        this.ele( x, y, tLinks, i);
        while( i < 64) {
            // Top/Right edge
            if( x < 7) {++x; ++i;}
            else {++y; ++i;}
            this.ele( x, y, tLinks, i);

            // Zig downleft
            while( x > 0 && y < 7) {
                --x; ++y; ++i;
            this.ele( x, y, tLinks, i);
            }
            // Bottom/Left edge
            if( y == 7) {++x; ++i;}
            else{++y; ++i;}
            this.ele( x, y, tLinks, i);

            if( x == 7 && y == 7) break;

            // Zag upright
            while( x < 7 && y > 0) {
                ++x; --y; ++i;
            this.ele( x, y, tLinks, i);
            }
        }

        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];
        var comp = new UIComponents.ComplexUIC();

        uiComponents.push( new UIComponents.SimpleUIC(
            "Table Bit Depth: %D   Destination: %D <br />Table:<br />",
            links.push(this.highPrec)-1, links.push(this.dest)-1));
            
        comp.addPiece('<div class="matrix"><span class="matrixLeft"></span><table class="matrixContent">');
        for( var x=0; x<8; ++x) {
            comp.addPiece('<tr class="matrixRow">');
            for( var y=0; y<8; ++y) {
                var index = x + y*8;
                comp.addPiece('<td class="matrixElement"><span class="%c">%d</span></td>',
                    links.push( tLinks[index])-1);
            }
            comp.addPiece('</tr>');
        }
        comp.addPiece('</table><span class="matrixRight"></span></div>');
        
        uiComponents.push( comp);

        return {
            start: this.start,
            length: this.length,
            color: ParseColors.cyclingColor(0xb2748a),
            title: "Quantization Table Data",
            uiComponents: uiComponents,
            links: links
        };
    }
    private ele( x:number, y:number, links: DataLink[], index : number) {
        links[x*8+y] = this.table.subLink(index);
    }
}

class SOFData extends SegmentBuilder {
    precision : BinLinks.ByteLink;
    width: BinLinks.ByteLink;
    height : BinLinks.ByteLink;
    numComponents: BinLinks.ByteLink;
    cField : DataLink[] = [];
    cFactorHor : SpecialLinks.PartialByteLink[] = [];
    cFactorVert : SpecialLinks.PartialByteLink[] = [];
    cQTable : BinLinks.ByteLink[] = [];

    constructor(reader : BinaryReaderLinker, start:number, len:number) {
        super(reader, start, len);

        this.precision = reader.readByte();
        this.width = reader.readUShort();
        this.height = reader.readUShort();
        this.numComponents = reader.readByte();

        var n = this.numComponents.get(reader.buffer);
        for( var i=0; i< n; ++i) {
            this.cField[i] = new SpecialLinks.EnumLink(reader.readByte(),
                {
                    "1":"Y", 
                    "2":"Cb",
                    "3":"Cr",
                    "4":"I",
                    "5":"Q"
                },"?");
            var cFact = reader.readByte();
            this.cFactorHor[i] = new SpecialLinks.PartialByteLink(cFact, 4, 4);
            this.cFactorVert[i] = new SpecialLinks.PartialByteLink(cFact, 0, 4);
            this.cQTable[i] = reader.readByte();
        }
    }
    
    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        uiComponents.push(new  UIComponents.SimpleUIC(
            "%D-bit Precision <br />", links.push(this.precision)-1));
        uiComponents.push(new  UIComponents.SimpleUIC(
            "Image Size: %D x %D <br />", 
            links.push(this.width)-1,links.push(this.height)-1));
        uiComponents.push(new  UIComponents.SimpleUIC(
            "Number of Components: %D<br />", links.push(this.numComponents)-1));

        var n = this.numComponents.get(this.reader.buffer);
        for( var i=0; i<n; ++i) {
            uiComponents.push( new UIComponents.SimpleUIC(
                "Component "+i+": %D sampling factors: %D x %D Quantization Table: %D<br />",
                links.push(this.cField[i])-1, links.push(this.cFactorHor[i])-1,
                links.push(this.cFactorVert[i])-1, links.push(this.cQTable[i])-1));
        }

        return {
            start: this.start,
            length: this.length,
            color: "#814a8c",
            title: "Start of Frame 0",
            links : links,
            uiComponents : uiComponents
        };
    }
}

class HuffmanData extends SegmentBuilder {
    y : boolean;
    dc : boolean;
    id : BinLinks.NumberLink;

    count : number;

    numPerRowT :  BinLinks.PackedNumberLink;
    rawT :  BinLinks.PackedNumberLink;

    codes : Uint16Array;
    minCode = new Uint16Array(16);
    maxCode = new Uint16Array(16);
    valPtr = new Uint16Array(16);
    
    constructor(reader : BinaryReaderLinker, start:number, len:number) {
        super(reader, start, len);


        this.id = reader.readByte();
        var byte = this.id.get(reader.buffer);

        this.y = (byte & 0x1) == 0;
        this.dc = (((byte >> 4)&0x1) == 0);

        this.count = 0;
        this.numPerRowT = reader.readPacked(16, 1, false);
        for( var i=0; i<16; ++i) {
            this.count += this.numPerRowT.get(reader.buffer, i);
        }

        this.rawT = reader.readPacked( this.count, 1, false);

        this.length = 17+this.count;

        this.constructHuffmanCodes();
    }

    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];
        var comp = new UIComponents.ComplexUIC();

        uiComponents.push( new UIComponents.SimpleUIC(
            "Huffman Table Destination: %D <br />",
            links.push(this.id)-1));

        comp.addPiece('<table class="simpleTable"><tr><th style="font-size:10px">Bit<br />Length</th><th>Byte the code is mapped to (mouse over for the code)</th></tr>');
        var index = 0;
        for( var i=0; i<16; ++i) {
            var n = this.numPerRowT.get(this.reader.buffer, i);
            comp.addPiece('\<tr><td class="%c"><div class="htt">'+(i+1)+' <div class="ttt">File stores how many entries of length '+(i+1)+' that need to be mapped (%d).</span></div></td><td>',
                links.push( this.numPerRowT.subLink(i))-1);

            for( var j=0; j<n; ++j) {
                var binstr = (this.codes[index]>>>0).toString(2);
                while( binstr.length < (i+1)) binstr = "0"+binstr;

                comp.addPiece( '<span class="%c"><div class="htt">%dh_2<span class="ttt">'+binstr+'</span></div></span> ',
                    links.push( this.rawT.subLink(index))-1);
                index++;
            }
            comp.addPiece('</td></tr>');
        }
        comp.addPiece('</table');

/*        bindings.push( new NilBinding('Huffman Table Destination:'))
        var str = "" + this.id + "(";
        str += (this.y) ? '<span class="htt">Y<span class="ttt">Luminosity</span></span>':'Color';
        str += " ";
        str +=(this.dc) 
            ? '<span class="htt">DC<span class="ttt">Direct Current Terms of Discrete Cosine Transform</span></span>'
            :'<span class="htt">AC<span class="ttt">Alternating Current Terms of Discrete Cosine Transform</span></span>';
        str += ")";
        bindings.push( new DataBinding_(str, this.start, 1));*/

        uiComponents.push( comp);
        return {
            start : this.start,
            length: this.length,
            color: ParseColors.cyclingColor(0x9b4444),
            title: "Huffman Table",
            links: links,
            uiComponents: uiComponents
        };
    }

    private constructHuffmanCodes() {
        //First count how many you need
        var codes = new Uint16Array(this.count);
        
        // Now apply the algorithm to construct the codes
        var c=0;
        var incr = 0;
        var index = 0;

        for( var i=0; i<16; ++i) {
            if( this.numPerRowT.get(this.reader.buffer, i) == 0) {
                incr <<= 1;
                continue;
            }
            codes[index++] = c = incr * (c+1);
            for( var j=1; j < this.numPerRowT.get(this.reader.buffer, i); ++j) {
                codes[index++] = ++c;
            }

            incr = 2;
        }

        this.codes = codes;

        // Now construct the short-hand access
        var c=0;
        for( var k=0; k<16; ++k) {
            if( this.numPerRowT.get(this.reader.buffer, k)== 0) {
                this.maxCode[0] = -1;
                continue;
            }

            c+=1;
            this.valPtr[k] = c - 1;
            this.minCode[k] = this.codes[c-1];
            c = c + this.numPerRowT.get(this.reader.buffer, k) - 1;
            this.maxCode[k] = this.codes[c - 1];
        }
    }
}

class SOSData extends SegmentBuilder {

    numComponents: BinLinks.ByteLink;

    componentID: DataLink[];
    htableID: BinLinks.ByteLink[];
    nulldl : DataLink;
    constructor(reader : BinaryReaderLinker, start:number, len:number) {
        super(reader, start, len+2);

        this.numComponents = reader.readByte();

        var nc = this.numComponents.get( reader.buffer);
        if( len < nc*2 + 6) throw "Bad SOS Marker";
        if( len > nc*2 + 6) console.log("Bad SOS Marker (Nonstandard data added?).  Attempting to ignore.");

        this.componentID = new Array(nc);
        this.htableID = new Array(nc);

        for( var i=0; i<nc; ++i) {
            this.componentID[i] = new SpecialLinks.EnumLink( 
                reader.readByte(),
                {
                    "1":"Y",
                    "2":"Cb",
                    "3":"Cr",
                    "4":"I",
                    "5":"Q"
                }, "Unknown Component type.");
            this.htableID[i] = reader.readByte();
        }

        // 3 Bytes which are ignored
        this.nulldl = new SpecialLinks.NullDataLink( reader.getSeek(), 3);
        reader.setSeek(reader.getSeek()+3);
    }

    
    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Number of Components: %D<br />", links.push( this.numComponents)-1));
        
        var nc = this.numComponents.get( this.reader.buffer);
        for( var i=0; i<nc; ++i) {
            uiComponents.push( new UIComponents.SimpleUIC(
                "Component #"+i+": %D, using Huffman Table: %D <br />",
                links.push( this.componentID[i])-1, links.push(this.htableID[i])-1));
        }

        var comp = new UIComponents.ComplexUIC();
        comp.addPiece( '<span class="%c">Unused Data</span>',
            links.push( this.nulldl)-1);
        uiComponents.push( comp);

        return {
            start: this.start,
            length: this.length,
            color: "#AAAA55",
            uiComponents : uiComponents,
            links : links,
            title: "Start of Scan Block"
        }
    }
}