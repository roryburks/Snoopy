import {BinaryReader} from "../binaryReader";
import {ParseStructure, Parser, Segment, Binding, NilBinding, DataBinding_, 
    CellBinding, SegmentNode, UIComponent, UIComponents, DataLink}
     from "./parseStructure";
import {ParseColors} from "./colors";
import {randcolor,Uint8ToString} from "../util";
import {BinaryReaderLinker, BinLinks, SpecialLinks} from "./binReaderLinker";

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
        var sign = this.lread.readBytes(8).get(this.data);
        
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
        var start : number = this.lread.getSeek();
        var len : number = this.lread.readUInt().get(this.data);
        var type :string = this.lread.readUTF8StrLen(4).get(this.data);
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

function appendChunkHeaders( 
    start: number, 
    len: number, 
    links : DataLink[], 
    uiComponents : UIComponent[]) 
{
    var cLen = new BinLinks.UIntLink(start);
    var cHead = new BinLinks.UTF8StrLink(start+4,4);
    var cSum = new BinLinks.BytesLink(start+len-4, 4);
    uiComponents.unshift( new UIComponents.SimpleUIC(
        '<span class="chunkDesc">Segment Header: %d Length: %d</span><br />',
        links.push(cLen)-1, links.push(cHead)-1));
    uiComponents.push( new UIComponents.SimpleUIC(
        '<span class="chunkDesc"><br />Data Checksum: %d</span>',
        links.push( cSum)-1));
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
        var seg : Segment = {
            start : this.start,
            length : this.length,
            color : "#FFFFFF",
            uiComponents : [],
            links : [],
            title : this.type + " Chunk"
        };
        appendChunkHeaders( this.start, this.length, seg.links, seg.uiComponents);
        return seg;
    }
}

class ImageData extends SegmentData {
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);
    }
    constructSegment() : Segment {
        var seg : Segment =  {
            start : this.start,
            length : this.length,
            color : ParseColors.cyclingColor(ParseColors._data),
            uiComponents : [],
            links : [],
            title : "Image Data Stream"
        };
        appendChunkHeaders( this.start, this.length, seg.links, seg.uiComponents);
        return seg;
    }
}

class IHDRData extends SegmentData {
    width : BinLinks.UIntLink;
    height : BinLinks.UIntLink;
    bitDepth : BinLinks.ByteLink;
    colorType : DataLink;
    compressionMethod: DataLink;
    filterMethod : DataLink;
    interlaceMethod : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.width = reader.readUInt();
        this.height = reader.readUInt();
        this.bitDepth = reader.readByte();
        this.colorType = new SpecialLinks.EnumLink(
            reader.readByte(), 
            {
                "0":"Greyscale",
                "2":"Truecolour",
                "3":"Indexed-colour",
                "4":"Greyscale with alpha",
                "6":"Truecolour with alpha"
            }, "Unknown Color Type");
        this.compressionMethod = new SpecialLinks.EnumLink(
            reader.readByte(), 
            {"0":"Deflate/Inflate Compression"}, 
            "Nonstandard Compression Method");
        this.filterMethod = new SpecialLinks.EnumLink(
            reader.readByte(), 
            {"0":"Adaptive Filtering"}, 
            "Nonstandard Filtering Method");
        this.interlaceMethod = new SpecialLinks.EnumLink(
            reader.readByte(), 
            {"0":"No Interlacing", "1":"Adam7 Interlacing"}, 
            "Nonstandard Interlacing Method");
    }
    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Image Dimensions: %d x %d <br />", 
            links.push( this.width)-1, links.push( this.height)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Bit Depth: %d bit<br />", 
            links.push( this.bitDepth)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Color Type: %d<br />", 
            links.push( this.colorType)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Compression Method: %d <br />", 
            links.push( this.compressionMethod)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Filter Method: %d <br />", 
            links.push( this.filterMethod)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Interlace Method: %d <br />", 
            links.push( this.interlaceMethod)-1));

        appendChunkHeaders( this.start, this.length, links, uiComponents);

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
    intent : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.intent = new SpecialLinks.EnumLink(
            this.reader.readByte(),
            {
                "0":"Perceptual",
                "1":"Reltive Colorimetric",
                "2":"Saturation",
                "3":"Absolute colorimetric"
            },  "Unknown, nonstandard");
        
        this.reader.readByte().get(reader.buffer);
    }
    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Rendering Intend: %d", links.push(this.intent)-1));

        appendChunkHeaders( this.start, this.length, links, uiComponents);

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : uiComponents,
            links : links,
            title : "sRGB Chunk"
        };
    }
}


class gAMAData extends SegmentData {
    gamma : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.gamma = new SpecialLinks.FactorLink( reader.readUInt(), 1000000);
    }
    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Gamma: %d (1/1000000 of stored value)", links.push(this.gamma)-1));

        appendChunkHeaders( this.start, this.length, links, uiComponents);

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : uiComponents,
            links : links,
            title : "gAMA Chunk"
        };
    }
}

class pHYsData extends SegmentData {
    pwidth : BinLinks.UIntLink;
    pheight : BinLinks.UIntLink;
    type : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.pwidth = reader.readUInt();
        this.pheight = reader.readUInt();
        this.type = new SpecialLinks.EnumLink( reader.readByte(),
            {"1": "square meter"}, "unspecified unit");
    }
    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Physical Pixel Dimensions: %d x %d piexels per %d",
            links.push( this.pwidth)-1, links.push( this.pheight)-1, links.push(this.type)-1));

        appendChunkHeaders( this.start, this.length, links, uiComponents);

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : uiComponents,
            links : links,
            title : "pHYs Chunk"
        };
    }
}

class cHRMData extends SegmentData {
    whitex : BinLinks.UIntLink;
    whitey : BinLinks.UIntLink;
    redx : BinLinks.UIntLink;
    redy : BinLinks.UIntLink;
    greenx : BinLinks.UIntLink;
    greeny : BinLinks.UIntLink;
    bluex : BinLinks.UIntLink;
    bluey : BinLinks.UIntLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.whitex = reader.readUInt()// / 100000; //8
        this.whitey = reader.readUInt()// / 100000; //12
        this.redx = reader.readUInt()// / 100000;   //16
        this.redy = reader.readUInt()// / 100000;   //20
        this.greenx = reader.readUInt()// / 100000; //24 
        this.greeny = reader.readUInt()// / 100000; //28
        this.bluex = reader.readUInt()// / 100000;  //32
        this.bluey = reader.readUInt()// / 100000;  //36
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