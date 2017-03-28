import {BinaryReader} from "../binaryReader";
import {ParseStructure, Parser, Segment, 
    SegmentNode, UIComponent, UIComponents, DataLink}
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
        this.lread = new BinaryReaderLinker(this.data);

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
    var cHead = new BinLinks.UTF8StrLink(start+4,4, false);
    var cSum = new BinLinks.UIntLink(start+len-4);
    uiComponents.unshift( new UIComponents.SimpleUIC(
        '<span class="chunkDesc">Segment Header: %D Length: %D</span><br />',
        links.push(cHead)-1, links.push(cLen)-1));
    uiComponents.push( new UIComponents.SimpleUIC(
        '<span class="chunkDesc"><br />Data Checksum: %Dh_8</span>',
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
            "Image Dimensions: %D x %D <br />", 
            links.push( this.width)-1, links.push( this.height)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Bit Depth: %D bit<br />", 
            links.push( this.bitDepth)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Color Type: %D<br />", 
            links.push( this.colorType)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Compression Method: %D <br />", 
            links.push( this.compressionMethod)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Filter Method: %D <br />", 
            links.push( this.filterMethod)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Interlace Method: %D <br />", 
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
            "Rendering Intend: %D", links.push(this.intent)-1));

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
            "Gamma: %D (1/1000000 of stored value)", links.push(this.gamma)-1));

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
            "Physical Pixel Dimensions: %D x %D piexels per %D",
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
    whitex : SpecialLinks.FactorLink;
    whitey : SpecialLinks.FactorLink;
    redx : SpecialLinks.FactorLink;
    redy : SpecialLinks.FactorLink;
    greenx : SpecialLinks.FactorLink;
    greeny :SpecialLinks.FactorLink;
    bluex : SpecialLinks.FactorLink;
    bluey : SpecialLinks.FactorLink;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        this.whitex = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.whitey = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.redx = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.redy = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.greenx = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.greeny = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.bluex = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
        this.bluey = new SpecialLinks.FactorLink( reader.readUInt(), 100000);
    }

    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        var comp = new UIComponents.ComplexUIC();
        comp.addPiece('\
Color Space (each number is stored as a UInt which is equal to 100000*its intended value):<br />\
<table class="simpleTable">\
    <tr>\
        <th></th>\
        <th>R</th>\
        <th>G</th>\
        <th>B</th>\
        <th>White</th>\
    </tr>\
    <tr>\
        <td>x</td>');
        comp.addPiece('<td class="%c">%d</td>', links.push( this.redx)-1);
        comp.addPiece('<td class="%c">%d</td>', links.push( this.greenx)-1);
        comp.addPiece('<td class="%c">%d</td>', links.push( this.bluex)-1);
        comp.addPiece('<td class="%c">%d</td>', links.push( this.whitex)-1);
        comp.addPiece('\
    </tr>\
    <tr>\
        <td>y</td>');
        comp.addPiece('<td class="%c">%d</td>', links.push( this.redy)-1);
        comp.addPiece('<td class="%c">%d</td>', links.push( this.greeny)-1);
        comp.addPiece('<td class="%c">%d</td>', links.push( this.bluey)-1);
        comp.addPiece('<td class="%c">%d</td>', links.push( this.whitey)-1);
        comp.addPiece('\
    </tr>\
</table>');
        uiComponents.push( comp);

        appendChunkHeaders( this.start, this.length, links, uiComponents);

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : uiComponents,
            links : links,
            title : "cHRM Chunk"
        };
    }
}
class COPYTHIS extends SegmentData {
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);
    }

    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        // Code goes here
        
        appendChunkHeaders( this.start, this.length, links, uiComponents);

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            uiComponents : uiComponents,
            links : links,
            title : "Title"
        };
    }
}

class PLTEData extends SegmentData {
    colors: BinLinks.RGBLink[] = [];
    size : number;
    constructor( reader : BinaryReaderLinker, start:number, len:number) {
        super( reader, start, len);

        if( (len - 12) % 3) {
            throw "Bad Palette Segment";
        }
        this.size = (len - 12) / 3;

        for( var i=0; i < this.size; ++i) {
            this.colors[i] = reader.readRGB();
        }
    }
    constructSegment() : Segment {
        var uiComponents : UIComponent[] = [];
        var links : DataLink[] = [];

        // Code goes here
        var comp = new UIComponents.ComplexUIC();
        comp.addPiece('Color Table: <table class="colorTable">');

        var n = Math.ceil( Math.sqrt(this.size));
        for( var row=0; row<n; ++row) {
            comp.addPiece('<tr><td>'+row*n+'-'+(row*n+n-1)+'</td>');
            for( var col=0; col<n; ++col) {
                var index = row*n + col;
                if( index >= this.size) break;
                comp.addPiece('<td class="%c"><div class="colorBox" style="background-color:%d"></div></td>',
                    links.push( this.colors[index])-1);
            }
            comp.addPiece('</tr>');
        }
        comp.addPiece('</table>');

        uiComponents.push( comp);
        
        appendChunkHeaders( this.start, this.length, links, uiComponents);

        return {
            start : this.start,
            length : this.length,
            color : ParseColors.palette,
            uiComponents : uiComponents,
            links : links,
            title : "Palette Chunk"
        };
    }
}