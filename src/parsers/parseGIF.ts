import {ParseStructure, Parser, Segment, Binding, NilBinding,
     DataBinding_, CellBinding, SegmentNode, UIComponents, UIComponent, DataLink}
     from "./parseStructure";
import {ParseColors} from "./colors";
import {randcolor, Uint8ToString} from "../util";
import {BinaryReaderLinker, BinLinks, SpecialLinks} from "./binReaderLinker";

export class GIFParser extends Parser {
    parsed : ParseStructure;

    header : HeaderSegment;
    globalTable : ColorTable = null;
    lread : BinaryReaderLinker;
    
    parse() : ParseStructure {
        this.parsed = new ParseStructure();
        this.lread = new BinaryReaderLinker(this.data);

        // Parse the IHDR
        this.header = new HeaderSegment( this.lread, 0, this);
        if( this.header.bad) return null;

        if( this.header.globalTable) {
            this.globalTable = new ColorTable(this.lread, this.lread.getSeek(), this, this.header.ctableSize.getValue(this.data));
        }


        var head = this.parsed.segmentTree.getRoot().addSegment(this.header.constructSegment());
        var currentImageRoot : SegmentNode= null;
        var imgNum = 0;
        if( this.header.globalTable) {
            var seg = this.globalTable.constructSegment();
            seg.title = "Global Color Table";
            head.addSegment(seg);
        }

        while( true) {
            var start = this.lread.getSeek();
            var marker = this.lread.readByte().get( this.data);

            if( marker == 0x3B) {
                this.parsed.segmentTree.getRoot().addSegment( {
                    start : this.lread.getSeek()-1,
                    length : 1,
                    color : "#AACCCC",
                    uiComponents : [],
                    links : [],
                    title : "Trailer (End of File Marker)"
                });
                break;
            }
            else if( marker == 0x2C) {
                //   Image Super-Segment
                var localRoot : SegmentNode =((currentImageRoot == null) ? this.parsed.segmentTree.getRoot().addNullSegment("Image #"+(imgNum++)) : currentImageRoot);

                var imgDesc = new ImageDescriptor( this.lread, start, this);
                localRoot.addSegment( imgDesc.constructSegment());
                if( imgDesc.hasColorTable.get(this.data)) {
                    var cTable = new ColorTable( this.lread, this.lread.getSeek(), this, imgDesc.ctableSize.getValue(this.data));
                    localRoot.addSegment( cTable.constructSegment());
                }
                var imgData = new ImageData( this.lread, this.lread.getSeek(), this);
                localRoot.addSegment( imgData.constructSegment());
                currentImageRoot = null;
            }
            else {
                if( marker == undefined) break;
                marker = (marker << 8) + this.lread.readByte().get(this.data);
                var len = this.lread.readByte().get(this.data);

                var data : SegmentData;
                switch( marker) {
                    case 0x21F9:
                    data = new GraphicsControlSegment( this.lread, start, this, len);
                    currentImageRoot = this.parsed.segmentTree.getRoot().addNullSegment("Image #"+(imgNum++));
                    break;
                    case 0x21FE:
                    data = new CommentExtension( this.lread, start, this, len);
                    break;
                    case 0x21FF:
                    data = new ApplicationExtension(this.lread, start, this, len);
                    len += (data as ApplicationExtension).sublen.getValue(this.data) + 1;
                    break;
                    default:
                    data = new UnknownBlock( this.lread, start, this, marker, len);
                    break;
                }
                if( currentImageRoot)
                    currentImageRoot.addSegment( data.constructSegment());
                else 
                    this.parsed.segmentTree.getRoot().addSegment( data.constructSegment());
                this.lread.setSeek( start + 4 + len);
            }
        }

        this.parsed.visualHTML = '<img src="data:image/*;base64,' + btoa(Uint8ToString(this.data)) + '" />';

        return this.parsed;
    }

    private parseHeader() : boolean {
        return (this.header.bad);
    }
}


abstract class SegmentData {
    start : number;
    reader : BinaryReaderLinker;
    context : GIFParser;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser) {
        this.start = start;
        this.reader = reader;
        this.context = context;
    }
    abstract constructSegment() : Segment;
}

class UnknownBlock extends SegmentData {
    id : number;
    length : number;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser, id : number, length : number) {
        super( reader, start, context);
        this.id = id;
        this.length = length;
    }
    constructSegment() : Segment {
        return {
            start: this.start,
            length : this.length + 4,
            color : randcolor(),
            uiComponents : [],
            links : [],
            title : "Unknown Block Type: " + this.id.toString(16)
        };
    }
}

class CommentExtension extends SegmentData {
    length : number;
    comment : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser, length : number) {
        super( reader, start, context);
        this.length = length;

        this.comment = reader.readUTF8StrLen(length);
    }
    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            '<span class="comment">%D</span>', links.push( this.comment)-1));

        return {
            start: this.start,
            length : this.length + 4,
            color : ParseColors.comment,
            uiComponents : uiComponents,
            links : links,
            title : "Comment Extension"
        };
    }
}

class ApplicationExtension extends SegmentData {
    len : number;

    identifier : DataLink;
    authentifier : DataLink;
    sublen : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser, length : number) {
        super( reader, start, context);

        this.len = length;
        this.identifier = reader.readUTF8StrLen(8);
        this.authentifier = reader.readUTF8StrLen(3);

        this.sublen = reader.readByte();
    }
    
    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        var comp = new UIComponents.ComplexUIC();

        comp.addPiece( "Application: %D<br />", links.push(this.identifier)-1);
        comp.addPiece( "Authentifier: %D<br />", links.push(this.authentifier)-1);
        comp.addPiece( "Length of Sub-data: %D<br />", links.push(this.sublen)-1);


        uiComponents.push( comp);
        return {
            start: this.start,
            length : this.len + this.sublen.getValue(this.reader.buffer) + 5,
            color : randcolor(),
            uiComponents : uiComponents,
            links : links,
            title : "Application Block"
        };
    }
}



class GraphicsControlSegment extends SegmentData {
    length : number;
    transparent : SpecialLinks.BitLink;
    userInput : SpecialLinks.BitLink;
    disposal : DataLink;
    delay : DataLink;
    transIndex : DataLink;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser, length : number) {
        super( reader, start, context);
        this.length = length;

        var packed = reader.readByte();

        this.transparent = new SpecialLinks.BitLink(packed, 0);
        this.userInput = new SpecialLinks.BitLink(packed, 1);
        this.disposal = new SpecialLinks.EnumLink(
            new SpecialLinks.PartialByteLink(packed, 2, 3),
            {
                "0": "No disposal method specified",
                "1":"Do not dispose.",
                "2":"Restore to background color.",
                "3":"Restore to previous.",
            },"Unknown disposal method.");
        this.delay = new SpecialLinks.FactorLink(reader.readUShortLE(), 100);
        this.transIndex = reader.readByte();
    }
    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        var comp = new UIComponents.ComplexUIC();
        
        comp.addPiece("Is Transparent: %D <br />", links.push( this.transparent)-1);
        comp.addPiece("Waits for User Input: %D <br />", links.push( this.userInput)-1);
        comp.addPiece("Disposal Method: %D <br />", links.push( this.disposal)-1);
        comp.addPiece("Delay Time: %D <br />", links.push( this.delay)-1);
        comp.addPiece("Transparent Index: %D <br />", links.push( this.transIndex)-1);
/*
        bindings.push( new NilBinding( "<br/>Transparent Index: "));
        bindings.push( new DataBinding_("" + ((this.transparent)?this.transIndex:"unused"), this.start + 6, 1));
*/
        uiComponents.push( comp);

        return {
            start : this.start,
            length : this.length + 4,
            uiComponents : uiComponents,
            links : links,
            color : "#c72cd3",
            title : "Graphics Control Extension" 
        };
    }
}

class ImageDescriptor extends SegmentData {
    left : BinLinks.NumberLink;
    top : BinLinks.NumberLink;
    width: BinLinks.NumberLink;
    height : BinLinks.NumberLink;

    
    ctableSize : DataLink;
    sorted : SpecialLinks.BitLink;
    hasColorTable : SpecialLinks.BitLink;
    interlaced : SpecialLinks.BitLink;

    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser) {
        super( reader, start, context);

        this.left = reader.readUShortLE();
        this.top = reader.readUShortLE();
        this.width = reader.readUShortLE();
        this.height = reader.readUShortLE();

        var packed = reader.readByte();

        this.hasColorTable = new SpecialLinks.BitLink(packed, 7);//(packed >> 7) == 1;
        this.interlaced = new SpecialLinks.BitLink(packed, 6);
        this.sorted = new SpecialLinks.BitLink(packed, 5);
        this.ctableSize = new CTableDataLink( new SpecialLinks.PartialByteLink(packed, 0, 4));
    }
    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        var comp = new UIComponents.ComplexUIC();

        comp.addPiece("Offset: %D x %D <br />",
            links.push(this.left)-1, links.push(this.top)-1);
        comp.addPiece("Size: %D x %D <br />",
            links.push(this.width)-1, links.push(this.height)-1);
        comp.addPiece("Has Local Color Table: %D  (Size: %D) <br />",
            links.push(this.hasColorTable)-1, links.push(this.ctableSize)-1);
        comp.addPiece("Is Sorted: %D <br />", links.push(this.sorted)-1);
        comp.addPiece("Is Interlaced: %D <br />", links.push(this.interlaced)-1);

        uiComponents.push( comp);

        return {
            start : this.start,
            length : 10,
            uiComponents : uiComponents,
            links : links,
            color : "#bf983e",
            title : "Image Descriptor"
        };
    }
}


class ImageData extends SegmentData {
    LZWMin : number;
    len : number;
    
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser) {
        super( reader, start, context);

        this.LZWMin = reader.readByte().getValue(reader.buffer);

        var size = reader.readByte().getValue(reader.buffer);

        while( size != 0) {
            reader.setSeek(reader.getSeek() + size);
            size = reader.readByte().getValue(reader.buffer);
        }

        this.len = this.reader.getSeek() - this.start;
    }
    constructSegment() : Segment {
        return {
            start : this.start,
            length : this.len,
            uiComponents : [],
            links : [],
            color : ParseColors.data,
            title : "Image Data"
        };
    }
}

class ColorTable extends SegmentData {
    size : number;
    table : BinLinks.PackedNumberLink;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser, size : number) {
        super( reader, start, context);
        this.size = size;
        this.table = this.reader.readPacked( this.size, 3, false);
    }
    
    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        var n = Math.ceil( Math.sqrt(this.size));

        var comp = new UIComponents.ComplexUIC();
        comp.addPiece('<table class="colorTable">');
        for( var row=0; row < n; ++row) {
            comp.addPiece('<tr><td>'+row*n+'-'+(row*n-1)+'</td>');
            for( var col=0; col < n; ++col) {
                var index = row*n + col;
                if( index >= this.size) break;

                comp.addPiece('<td class="%c"><div class="colorBox" style="background-color:#%dh_6"></div></td>',
                    links.push(this.table.subLink(index))-1);
            }
            comp.addPiece('</tr>');
        }
        comp.addPiece('</table>');

        uiComponents.push(comp);

        return {
            start: this.start,
            length : this.size * 3,
            color : ParseColors.palette,
            uiComponents : uiComponents,
            links : links,
            title : "Color Table"
        };
    }
}

class CTableDataLink extends DataLink {
    base : DataLink;
    constructor( base : DataLink) {
        super();
        this.base = base;
    }
    getValue(data : Uint8Array)  : any {
        return 1 << (this.base.getValue(data) + 1);
    }
    getStartByte() : number { return this.base.getStartByte();}
    getStartBitmask() : number { return this.base.getStartBitmask();}
    getLength() : number { return this.base.getLength();}
    getEndBitmask() : number { return this.base.getEndBitmask();}

}

class HeaderSegment extends SegmentData {
    bad = false;
    ver89a : boolean;

    header : BinLinks.UTF8StrLink;
    width : BinLinks.NumberLink;
    height : BinLinks.NumberLink;
    
    ctableSize : DataLink;
    sorted : SpecialLinks.BitLink;
    globalTable : SpecialLinks.BitLink;
    colorRes : DataLink;

    bgColorIndex : BinLinks.NumberLink;
    pixelAspectRatio : BinLinks.NumberLink;
    constructor( reader : BinaryReaderLinker, start:number, context : GIFParser) {
        super( reader, start, context);

        this.header = this.reader.readUTF8StrLen(6);
        var header = this.header.get(reader.buffer);

        if( header == "GIF87a") this.ver89a = false;
        else if( header == "GIF89a") this.ver89a = true;
        else {this.bad = true; return;}

        this.width = this.reader.readUShortLE();
        this.height = this.reader.readUShortLE();

//        var packed = this.reader.readByte().get(reader.buffer);
        var byte = this.reader.readByte();

        this.globalTable = new SpecialLinks.BitLink( byte, 7);
        this.colorRes = new SpecialLinks.PartialByteLink( byte, 4, 3);
        this.sorted = new SpecialLinks.BitLink( byte, 3)
        this.ctableSize = new CTableDataLink( new SpecialLinks.PartialByteLink(byte, 0, 3));

//        this.globalTable = (packed & 0x80) != 0;
//        this.colorRes = (packed >> 4) & 0x7;
//        this.sorted = (packed & 0x8) != 0;
//        this.ctableSize = (this.globalTable) ? 1 << ((packed & 0x7)+1) : 0;

        this.bgColorIndex = this.reader.readByte();
        this.pixelAspectRatio = this.reader.readByte();
    }

    constructSegment() : Segment {
        var links : DataLink[] = [];
        var uiComponents : UIComponent[] = [];

        uiComponents.push( new UIComponents.SimpleUIC(
            "Signature/Version: %D <br />", links.push( this.header)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Display Size: %D x %D <br />", 
            links.push( this.width)-1,links.push( this.height)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Has Color Table: %D (size: %D) <br />", 
            links.push( this.globalTable)-1,links.push( this.ctableSize)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Color Resolution of Source: %D <br />", links.push( this.colorRes)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Sorted: %D <br />", links.push( this.sorted)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Background Color Index: %D <br />", links.push( this.bgColorIndex)-1));
        uiComponents.push( new UIComponents.SimpleUIC(
            "Poxel Aspect Ration: %D <br />", links.push( this.pixelAspectRatio)-1));
        

/*        var color = (this.context.globalTable) ? this.context.globalTable.table[this.bgColorIndex] : 0;
        bindings.push( new DataBinding_(""+this.bgColorIndex + '<span class="colorBox" style="background-color:'+ParseColors.rgbToString(color)+'"></span>', 11, 1));
        bindings.push( new NilBinding('<br />Pixel Aspect Ratio: ' ));
        bindings.push( new DataBinding_((this.pixelAspectRatio == 0)?"1:1":"nonzero value: I don't actually know what this means.", 12, 1));*/

        return {
            start: this.start,
            length: 13,
            uiComponents : uiComponents,
            links : links,
            color : ParseColors.header,
            title: "Header"
        };
    }
}