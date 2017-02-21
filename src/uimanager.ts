import {Dimension, getTextDimensions} from "./util";
import {Parser, ParseStructure, Segment} from "./parseStructure";
import {JPGParser} from "./parseJPG";
import {PNGParser} from "./parsePNG";
import {getFileExtension} from "./util";
import {hexStr, asciiStr} from "./main";

export class UIManager {
    data  : Uint8Array;
    hexField : HTMLDivElement;
    asciiField: HTMLDivElement;
    scrollBar : HTMLDivElement;
    scrollField : HTMLDivElement;
    parsed : ParseStructure;
    filename : string;

    constructor() {
        this.hexField = $("#hexField").get(0) as HTMLDivElement;
        this.asciiField = $("#asciiField").get(0) as HTMLDivElement;
        this.scrollBar = $("#efsContainer").get(0) as HTMLDivElement;
        this.scrollField = $("#efScroll").get(0) as HTMLDivElement;

        this.initComponents();
    }

    private initComponents() {
        this.scrollBar.onscroll = (evt : Event) => {
            this.buildFromData();
        }

        // Bind input in the not-actually-moving hex and ascii fields into the scrollBar
        var f = (evt : WheelEvent) => {
            this.scrollBar.scrollTop -= evt.wheelDelta;
        }
        this.hexField.onmousewheel = f;
        this.asciiField.onmousewheel = f;
    }

    assosciateData( data : Uint8Array, filename : string) {
        this.data = data;
        this.filename = filename;
        
        var parser = getParserFromExtension(
            getFileExtension(this.filename).toLowerCase(), this.data);
        this.parsed = (parser)?parser.parse() : null;

        // TODO : Make sure segments are non-overlapping, sorted in order.
        
        var w = this.hexField.clientWidth;
        var dim = getTextDimensions("1", window.getComputedStyle(this.hexField, null).font );
        var charPerLine = Math.max(1, Math.floor(w/dim.width));
        var numLines = Math.max( 1, Math.ceil(this.data.byteLength / charPerLine));
        this.scrollField.style.height = (dim.height * numLines) + "px";

        this.buildFromData();
    }

    /** Builds only the visible Hex/ASCII field instead of all of it.  This prevents 
     * obnoxiously long UI waiting and rendering.
     */
    private buildFromData() {
        // Determing the dimensions necessary for constructing the fields
        var dim = getTextDimensions("1", window.getComputedStyle(this.hexField, null).font );
        var w = this.hexField.clientWidth;
        var h = this.hexField.clientHeight;
        var charPerLine = Math.max(1, Math.floor(w/dim.width));
        var numLines = Math.max( 1, Math.ceil(this.data.byteLength / charPerLine));
        var visLines = Math.max( 1, Math.ceil(h/dim.height));
        var startLine = Math.ceil(this.scrollBar.scrollTop / dim.height);
        
        var hex : string = "";
        var ascii : string = "";
        var line : string = "";

        // Set up Segment-Arranging Variables
        var segment : Segment = null;
        var insegment = false;
        var wseg = 0;   // Working Segment Index
        if( this.parsed && this.parsed.segments.length > wseg) {
            // Find first segment to start with.
            segment = this.parsed.segments[wseg++];

            while( segment != null && segment.start+segment.length < startLine * charPerLine) 
                segment = this.parsed.segments[wseg++];
        }

        for( var i=startLine; i < startLine + visLines; ++i) {
            var v : number;
            for( var j=0; j<charPerLine; ++j) {
                var index = i*charPerLine+j;

                if( segment != null && !insegment && index >= segment.start) {
                    var str = '<span class="segment '+ 'segment' + (wseg-1) + '" style="background-color:'+segment.color+';">';
                    insegment = true;
                    hex += str;
                    ascii += str;
                }

                v = this.data[i*charPerLine+j];
                if( v == undefined) break;
                hex += hexStr(v);
                ascii += asciiStr(v);

                if( segment != null && insegment && index >= segment.start + segment.length - 1) {
                    var str = '</span>';
                    hex += str;
                    ascii += str;
                    if( this.parsed.segments.length > wseg) {
                        segment = this.parsed.segments[wseg++];
                        insegment = false;
                    }
                    else segment = null;
                }
            }
            hex += "<br />";
            ascii += "<br />";
            if( v == undefined) break;
        }
        
        if( insegment) {
            hex += "</span>";
            ascii += "</span>";
        }
        
        this.hexField.innerHTML = hex;
        this.asciiField.innerHTML = ascii;

        for( var i=0; i < this.parsed.segments.length; ++i) {
            $('.segment' + i).click( boundSetSegmentField.bind(this.parsed.segments[i]));
        }
    }
    
}
function boundSetSegmentField() {
    var seg = this as Segment;

    var str : string = "";

    str += seg.descriptor + "<br />";

    if( seg.binding) {
        for( var i=0; i < seg.binding.length; ++i) {
            str += seg.binding[i].getHTML();
        }
    }

    $('#segmentField').get(0).innerHTML = str;
}

function getParserFromExtension( ext : string, buffer : Uint8Array) {
    switch( ext) {
        case "jpg": case "jpeg": return new JPGParser(buffer);
        case "png": return new PNGParser(buffer);
        default: return null;
    }
}