
import {getFileExtension,Uint8ToString} from "../util";
import {CanvasHexComponent} from "./canvashex";
import {Parser, ParseStructure, Segment} from "../parsers/parseStructure";
import {JPGParser} from "../parsers/parseJPG";
import {PNGParser} from "../parsers/parsePNG";


export class UIManager {
    data  : Uint8Array;
    scrollBar : HTMLDivElement;
    scrollField : HTMLDivElement;
    parsed : ParseStructure;
    filename : string;

    hexComponent : HexComponent;



    constructor() {
        this.hexComponent = new CanvasHexComponent(this);
        
        this.scrollBar = $("#efsContainer").get(0) as HTMLDivElement;
        this.scrollField = $("#efScroll").get(0) as HTMLDivElement;

        this.initComponents();
        this.initBindings();
    }

    private findTexDimensions() {
    }
    
    private initComponents() {
        if( this.hexComponent) {
            this.hexComponent.rebuildHexTables();
        }
    }

    private initBindings() {
        this.scrollBar.onscroll = (evt : Event) => {
            if( this.hexComponent)
                this.hexComponent.updateData();
        }


    }

    assosciateData( data : Uint8Array, filename : string) {
        this.data = data;
        this.filename = filename;
        
        var parser = getParserFromExtension(
            getFileExtension(this.filename).toLowerCase(), this.data);
        this.parsed = (parser)?parser.parse() : null;

        if( this.parsed) {
            $("#visualField").empty();
            var img = document.createElement("img") as HTMLImageElement;

            var str = "data:image/*;base64," + btoa(Uint8ToString(this.data));

            img.setAttribute("src", str);
            $("#visualField").append(img);
        }

        // TODO : Make sure segments are non-overlapping, sorted in order.
        
        // Adjust the size of the scrollField
        var h = Math.max( $(this.scrollBar).height(), (this.hexComponent)?this.hexComponent.getScrollHeight():0);
        this.scrollField.style.height =  h + "px";

        if( this.hexComponent)
            this.hexComponent.updateData();
    }
}


export abstract class HexComponent {
    abstract rebuildHexTables() : void;
    abstract updateData() : void;
    abstract getScrollHeight() : number;
}

export function boundSetSegmentField() {
    var seg = this as Segment;

    console.log("TEST");

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