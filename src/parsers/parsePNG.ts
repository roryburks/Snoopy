import {BinaryReader} from "../binaryReader";
import {ParseStructure, Parser, Segment, Binding, NilBinding, DataBinding_, 
    CellBinding, SegmentNode, UIComponent, UIComponents, DataLink}
     from "./parseStructure";
import {ParseColors} from "./colors";
import {randcolor,Uint8ToString} from "../util";
import {BinaryReaderLinker, BinLinks} from "./binReaderLinker";

export class PNGParser extends Parser {
    parsed : ParseStructure;
    error : string = "";
    imgNode : SegmentNode;
    lread : BinaryReaderLinker;

    parse() : ParseStructure {
        this.parsed = new ParseStructure();
        this.lread = new BinaryReaderLinker( this.data);

        if( !this.parseHeader()) return null;
        while( !this.lread.eof()) this.parseChunk();

        this.parsed.visualHTML = '<img src="data:image/*;base64,' + btoa(Uint8ToString(this.data)) + '" />';
        return this.parsed;
    }
    getError() : string{
        return this.error;
    }
    parseHeader() : boolean {
        var sign = this.lread.readBytes(8);
        
        if( !sign ||  sign[0] != 137 || sign[1] != 80 || sign[2] != 78 || sign[3] != 71 ||
            sign[4] != 13 || sign[5]!=10 || sign[6]!=26 || sign[7] != 10) 
        {
            this.error = "Not a valid PNG File."
            return false;
        }
        this.parsed.segmentTree.getRoot().addSegment( {
            start : 0,
            length : 8,
            color : ParseColors.header,
            uiComponents : [],
            links : [],
            title : "PNG Signature"
        });
        return true;
    }
    parseChunk() : boolean {
        var start = this.lread.getSeek();
        var len = this.lread.readUInt();
        var type = this.lread.readUTF8StrLen(4);
        var data : SegmentData;
        switch( type) {
        case "IHDR": data = new IHDRData(this.lread, start, len + 12);break;
        case "sRGB":data = new sRGBData( this.lread, start, len + 12);break;
        case "gAMA":data = new gAMAData( this.lread, start, len+12);break;
        case "pHYs":data = new pHYsData( this.lread, start, len + 12);break;
        case "PLTE": data = new PLTEData( this.lread, start, len+12);break;
        case "IDAT": data = new ImageData( this.lread, start, len+12);break;
        case "cHRM": data = new cHRMData( this.lread, start, len+12); break;
        default:
            data = new UnknownSegment(this.lread, start, len + 12, type);
        }

        if( type == "IDAT"){
            this.imgNode = this.imgNode || this.parsed.segmentTree.getRoot().addNullSegment("Image Data");
            this.imgNode.addSegment( data.constructSegment());
        }
        else
            this.parsed.segmentTree.getRoot().addSegment( data.constructSegment());

        this.lread.setSeek( start + 8 + len);

        var crc = this.lread.readUInt();

        return true;
    }
}

function bindingsForChunk( chunk : string, start: number, len : number, bindings : Binding[]) : Binding[]{
    var ret : Binding[] = [];
    ret.push( new NilBinding('<span class="chunkDesc">Segment Header: '));
    ret.push( new DataBinding_(chunk, start + 4, 4));
    ret.push( new NilBinding(" Length: "));
    ret.push( new DataBinding_(""+(len-12),start, 4));
    ret.push( new NilBinding("<br /></span>"));

    ret = ret.concat( bindings);

    ret.push( new DataBinding_('<span class="chunkDesc"><br />Data Checksum.</span>', start+8 + (len-12), 4));

    return ret;
}

abstract class SegmentData {
    start : number;
    length : number;
    reader : BinaryReaderLinker;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        this.start = start;
        this.reader = reader;
        this.length = len;
    }
    abstract constructSegment() : Segment;
}

class UnknownSegment extends SegmentData {
    type : string;
    constructor( reader : BinaryReaderLinker, start:number, len:number, type : string) {
        super( reader, start, len);
        this.type = type;
    }
    constructSegment() : Segment {
        return {
            start : this.start,
            length : this.length,
            color : "#FFFFFF",
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk(this.type, this.start, this.length, []),
            title : this.type + " Chunk"
        };
    }
}

class ImageData extends SegmentData {
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);
    }
    constructSegment() : Segment {
        return {
            start : this.start,
            length : this.length,
            color : ParseColors.cyclingColor(ParseColors._data),
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("IDAT", this.start, this.length, []),
            title : "Image Data Stream"
        };
    }
}

class IHDRData extends SegmentData {
    width : number;
    height : number;
    bitDepth : BinLinks.ByteLink;
    colorType : BinLinks.ByteLink;
    compressionMethod: BinLinks.ByteLink;
    filterMethod : BinLinks.ByteLink;
    interlaceMethod : BinLinks.ByteLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.width = reader.readUInt();
        this.height = reader.readUInt();
        this.bitDepth = reader.readByte();
        this.colorType = reader.readByte();
        this.compressionMethod = reader.readByte();
        this.filterMethod = reader.readByte();
        this.interlaceMethod = reader.readByte();

    }
    getColorTypeName() : string {
        switch( this.colorType.get(this.reader.buffer)) {
            case 0: return "Greyscale";
            case 2: return "Truecolour";
            case 3: return "Indexed-colour";
            case 4: return "Greyscale with alpha";
            case 6: return "Truecolour with alpha";
        }
    }
    constructSegment() : Segment {
        var seg = new Segment();
        seg.start = this.start;
        seg.length = this.length;
        seg.color = randcolor();
        seg.title = "IHDR Chunk (Image Header)";

        var bindings : Binding[] = [];
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Image Dimensions: %d<br />", 
            links.push( this.bitDepth)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Image Dimensions: %d", 
            links.push( this.bitDepth)-1));
//        var links : DataL

/*        var str : string;
        bindings.push( new NilBinding("Image Dimensions: "));
        bindings.push( new DataBinding_(""+this.width, this.start + 8, 4));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding_(""+this.height, this.start + 12, 4));
        bindings.push( new NilBinding("<br />Bit Depth: "));
        bindings.push( new DataBinding_(""+this.bitDepth, this.start + 16, 1));
        bindings.push( new NilBinding("<br />Color Type: "));
        bindings.push( new DataBinding_(this.getColorTypeName(), this.start + 17, 1));
        bindings.push( new NilBinding("<br />Compression Method: "));
        str = (this.compressionMethod == 0) ? "Default Compression (Deflate/Inflate Compression)" : "Nonstandard Compression Method";
        bindings.push( new DataBinding_(str, this.start + 18, 1));
        bindings.push( new NilBinding("<br />Filter Method: "));
        str = (this.filterMethod == 0) ? "Default Filter (Adaptive Filtering)" : "Nonstandard Filtering Method";
        bindings.push( new DataBinding_(str, this.start + 19, 1));
        bindings.push( new NilBinding("<br />Interlace Method: "));
        if( this.interlaceMethod == 0) str = "No Interlacing";
        else if( this.interlaceMethod == 1) str = "Adam7 Interlacing";
        else str = "Nonstandard Interlacing Method";
        bindings.push( new DataBinding_(str, this.start + 20, 1));*/

//        seg.binding = bindingsForChunk("IHDR", this.start, this.length,  bindings);

        return {
            start: this.start,
            length: this.length,
            color: randcolor(),
            title: "IHDR Chunk (Image Header)",
            links : links,
            uiComponents: uiComponents
        };
    }
}

class sRGBData extends SegmentData {
    intent : number;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.intent = this.reader.readByte().get(reader.buffer);
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];

        bindings.push(new NilBinding("Rendering Intent: "));

        var str : string;
        switch( this.intent) {
            case 0: str = "Perceptual"; break;
            case 1: str = "Reltive Colorimetric"; break;
            case 2: str = "Saturation"; break;
            case 3: str = "Absolute colorimetric"; break;
            default: str = "Unknown, nonstandard"; break;
        }
        bindings.push( new DataBinding_(str, 12, 1));

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("sRGB", this.start, this.length, bindings),
            title : "sRGB Chunk"
        };
    }
}


class gAMAData extends SegmentData {
    gamma : number;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.gamma = reader.readUInt() / 1000000;
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];
        bindings.push( new NilBinding("Gamma (uInt / 1000000): "));
        bindings.push( new DataBinding_("" + this.gamma, this.start + 8, 4));

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("gAMA", this.start, this.length, bindings),
            title : "gAMA Chunk"
        };
    }
}

class pHYsData extends SegmentData {
    pwidth : number;
    pheight : number;
    type : number;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.pwidth = reader.readUInt();
        this.pheight = reader.readUInt();
        this.type = reader.readByte().get(reader.buffer);
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];
        bindings.push( new NilBinding("Physical Pixel Dimensions (1 pixel = ):<br />"));
        bindings.push( new DataBinding_("" + this.pwidth, this.start + 8, 4));
        bindings.push( new NilBinding(" x "));
        bindings.push( new DataBinding_("" + this.pheight, this.start + 12, 4));
        bindings.push( new NilBinding(" "));

        var str = (this.type == 1) ? "pixels per metre" : "pixels per (unknown, nonstandard)";
        bindings.push( new DataBinding_("" + str, this.start + 16, 1));

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("pHYs", this.start, this.length, bindings),
            title : "pHYs Chunk"
        };
    }
}

class cHRMData extends SegmentData {
    whitex : number;
    whitey : number;
    redx : number;
    redy : number;
    greenx : number;
    greeny : number;
    bluex : number;
    bluey : number;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.whitex = reader.readUInt() / 100000; //8
        this.whitey = reader.readUInt() / 100000; //12
        this.redx = reader.readUInt() / 100000;   //16
        this.redy = reader.readUInt() / 100000;   //20
        this.greenx = reader.readUInt() / 100000; //24 
        this.greeny = reader.readUInt() / 100000; //28
        this.bluex = reader.readUInt() / 100000;  //32
        this.bluey = reader.readUInt() / 100000;  //36
    }

    constructSegment() : Segment {
        var bindings : Binding[] = [];

        bindings.push( new NilBinding( 'Color Space (each number is stored as a UInt which is equal to 100000*its intended value):<br /><table class="simpleTable"><tr><th></th><th>R</th><th>G</th><th>B</th><th>White</th></tr><tr><td>x</td>'))
        bindings.push( new CellBinding(""+this.redx, this.start + 16, 4));
        bindings.push( new CellBinding(""+this.greenx, this.start + 24, 4));
        bindings.push( new CellBinding(""+this.bluex, this.start + 32, 4));
        bindings.push( new CellBinding(""+this.whitex, this.start + 8, 4));
        bindings.push( new NilBinding('</tr><tr><td>y</td>'));
        bindings.push( new CellBinding(""+this.redy, this.start + 20, 4));
        bindings.push( new CellBinding(""+this.greeny, this.start + 28, 4));
        bindings.push( new CellBinding(""+this.bluey, this.start + 36, 4));
        bindings.push( new CellBinding(""+this.whitey, this.start + 12, 4));
        bindings.push( new NilBinding('</tr></table>'));

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("cHRM", this.start, this.length, bindings),
            title : "cHRM Chunk"
        };
    }
}
class COPYTHIS extends SegmentData {
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);
    }

    constructSegment() : Segment {
        var bindings : Binding[] = [];

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("cHRM", this.start, this.length, bindings),
            title : "cHRM Chunk"
        };
    }
}

class PLTEData extends SegmentData {
    colors: Uint32Array;
    size : number;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        if( (len - 12) % 3) {
            throw "Bad Palette Segment";
        }
        this.size = (len - 12) / 3;
        this.colors = new Uint32Array( this.size);

        for( var i=0; i < this.size; ++i) {
            this.colors[i] = reader.readRGB().get(reader.buffer);
        }
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];
        
        bindings.push( new NilBinding("Color Table: "));
        var n = Math.ceil( Math.sqrt(this.size));

        bindings.push( new NilBinding('<table class="colorTable">'));
        for( var row=0; row < n; ++row) {
            bindings.push( new NilBinding('<tr>'));
            bindings.push( new NilBinding('<td>'+row*n+'-'+(row*n+n-1)+'</td>'));
            for( var col=0; col < n; ++col) {
                var index = row*n + col;
                if( index >= this.size)break;
                var color = ParseColors.rgbToString(this.colors[index]);
                bindings.push( new CellBinding('<div class="colorBox" style="background-color:'+color+'"></div>', this.start + index*3, 3));
            }
            bindings.push( new NilBinding('</tr>'));
        }
        bindings.push( new NilBinding('</table>'));

        return {
            start : this.start,
            length : this.length,
            color : ParseColors.palette,
            uiComponents : [],
            links : [],
//            binding : bindingsForChunk("PLTE", this.start, this.length, bindings),
            title : "Palette Chunk"
        };
    }
}