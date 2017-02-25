import {BinaryReader} from "../binaryReader";
import {ParseStructure, Parser, Segment, Binding, NilBinding, DataBinding}
     from "./parseStructure";
import {ParseColors} from "./colors";
import {randcolor} from "../util";

export class PNGParser extends Parser {
    parsed : ParseStructure;
    error : string = "";
    parse() : ParseStructure {
        this.parsed = new ParseStructure();

        if( !this.parseHeader()) return null;
        while( !this.reader.eof()) this.parseChunk();

        return this.parsed;
    }
    getError() : string{
        return this.error;
    }
    parseHeader() : boolean {
        var sign = this.reader.readBytes(8);
        
        if( !sign ||  sign[0] != 137 || sign[1] != 80 || sign[2] != 78 || sign[3] != 71 ||
            sign[4] != 13 || sign[5]!=10 || sign[6]!=26 || sign[7] != 10) 
        {
            this.error = "Not a valid PNG File."
            return false;
        }
        this.parsed.segments.push( {
            start : 0,
            length : 8,
            color : ParseColors.header,
            binding : [],
            descriptor : "PNG Signature"
        });
        return true;
    }
    parseChunk() : boolean {
        var start = this.reader.getSeek();
        var len = this.reader.readUInt();
        var type = this.reader.readUTF8StrLen(4);
        var data : SegmentData;
        switch( type) {
        case "IHDR": 
            data = new IHDRData(this.reader, start, len + 12);
            break;
        case "sRGB":
            data = new sRGBData( this.reader, start, len + 12);
            break;
        default:
            data = new UnknownSegment(this.reader, start, len + 12, type);
        }

        this.parsed.segments.push( data.constructSegment());

        this.reader.setSeek( start + 8 + len);

        var crc = this.reader.readUInt();



        return true;
    }
}

abstract class SegmentData {
    start : number;
    length : number;
    reader : BinaryReader;
    constructor( reader : BinaryReader, start:number, len:number) {
        this.start = start;
        this.reader = reader;
        this.length = len;
    }
    abstract constructSegment() : Segment;
}

class UnknownSegment extends SegmentData {
    type : string;
    constructor( reader : BinaryReader, start:number, len:number, type : string) {
        super( reader, start, len);
        this.type = type;
    }
    constructSegment() : Segment {
        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            binding : [],
            descriptor : this.type + " Chunk"
        };
    }
}

class IHDRData extends SegmentData {
    width : number;
    height : number;
    bitDepth : number;
    colorType : number;
    compressionMethod: number;
    filterMethod : number;
    interlaceMethod : number;
    constructor( reader : BinaryReader, start:number, len:number) {
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
        switch( this.colorType) {
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
        seg.descriptor = "IHDR Chunk (Image Header)";

        var bindings : Binding[] = [];

        var str : string;
        bindings.push( new NilBinding("Image Dimensions: "));
        bindings.push( new DataBinding(""+this.width, this.start + 8, 4));
        bindings.push( new NilBinding("x"));
        bindings.push( new DataBinding(""+this.height, this.start + 12, 4));
        bindings.push( new NilBinding("<br />Bit Depth: "));
        bindings.push( new DataBinding(""+this.bitDepth, this.start + 16, 1));
        bindings.push( new NilBinding("<br />Color Type: "));
        bindings.push( new DataBinding(this.getColorTypeName(), this.start + 17, 1));
        bindings.push( new NilBinding("<br />Compression Method: "));
        str = (this.compressionMethod == 0) ? "Default Compression (Deflate/Inflate Compression)" : "Nonstandard Compression Method";
        bindings.push( new DataBinding(str, this.start + 18, 1));
        bindings.push( new NilBinding("<br />Filter Method: "));
        str = (this.filterMethod == 0) ? "Default Filter (Adaptive Filtering)" : "Nonstandard Filtering Method";
        bindings.push( new DataBinding(str, this.start + 19, 1));
        bindings.push( new NilBinding("<br />Interlace Method: "));
        if( this.interlaceMethod == 0) str = "No Interlacing";
        else if( this.interlaceMethod == 1) str = "Adam7 Interlacing";
        else str = "Nonstandard Interlacing Method";
        bindings.push( new DataBinding(str, this.start + 20, 1));

        seg.binding = bindings;

        return seg;
    }
}

class sRGBData extends SegmentData {
    constructor( reader : BinaryReader, start:number, len:number) {
        super( reader, start, len);
    }
    constructSegment() : Segment {
        var bindings : Binding[] = [];

        return {
            start : this.start,
            length : this.length,
            color : randcolor(),
            binding : bindings,
            descriptor : "sRGB Chunk"
        };
    }
}