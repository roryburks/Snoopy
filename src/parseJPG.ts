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
            this.parsed.segments.push( data.constructSegment());
        }
        else if( identifier == "JFXX") {
            console.log("JFXX");
        }

        return true;
    }

    private parseSOF0() : boolean {
        return true;
    }
}
export {JPGParser}

class JFIFData {
    start : number;
    length : number;
    versionMajor : number;
    versionMinor : number;
    pixelDensityUnits : number;
    xDensity : number;
    yDensity : number;
    xThumbnail : number;
    yThumbnail : number;

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