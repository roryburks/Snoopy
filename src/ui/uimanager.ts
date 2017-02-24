
import {getFileExtension,Uint8ToString} from "../util";
import {CanvasHexComponent} from "./canvashex";
import {Parser, ParseStructure, Segment, Bound} from "../parsers/parseStructure";
import {JPGParser} from "../parsers/parseJPG";
import {PNGParser} from "../parsers/parsePNG";


export class UIManager {
    data  : Uint8Array;
    scrollBar : HTMLDivElement;
    scrollField : HTMLDivElement;
    parsed : ParseStructure;
    filename : string;

    hexComponent : any;



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
        
        // Adjust the size of the scrollField
        var h = Math.max( $(this.scrollBar).height(), (this.hexComponent)?this.hexComponent.getScrollHeight():0);
        this.scrollField.style.height =  h + "px";

        if( this.hexComponent)
            this.hexComponent.updateData();
    }

    boundSegment : Segment;
    setBoundSegment( seg : Segment) {
        this.boundSegment = seg;

        var str : string = "";

        str += seg.descriptor + "<br />";

        if( seg.binding) {
            for( var i=0; i < seg.binding.length; ++i) {
                var html = seg.binding[i].getHTML();
                if( seg.binding[i].binding) {
                    str += '<span class="dbnd'+i+'">' + html + '</span>';
                }
                else str += html;
            }
            $('#segmentField').get(0).innerHTML = str;
            for( var i=0; i < seg.binding.length; ++i) {
                if( seg.binding[i].binding) {
                    {
                        // Create a strictly-scoped copy of i so that bindingClicked is bound
                        //  to a different one each time, instead of being bound to the itterating
                        //  i which will always be seg.binding.length by the time the binding
                        //  is ever called
                        let ind = i;
                        $(".dbnd"+ind).click( ((evt : JQueryEventObject) : any => {
                            this.bindingClicked(ind);
                        }).bind(this));
                    }
                }
            }
        }
        else $('#segmentField').get(0).innerHTML = str;
    }

    bindingClicked( index : number) {
        if( !this.boundSegment || index < 0 || !this.boundSegment.binding 
            || this.boundSegment.binding.length <= index) 
            return;

        //
        var bound = this.boundSegment.binding[index].binding;
        if( this.hexComponent) this.hexComponent.setHighlighted(bound );
    }
}


export abstract class HexComponent {
    abstract rebuildHexTables() : void;
    abstract updateData() : void;
    abstract getScrollHeight() : number;
    abstract setHighlighted( bound : Bound) : void;
}



function getParserFromExtension( ext : string, buffer : Uint8Array) {
    switch( ext) {
        case "jpg": case "jpeg": return new JPGParser(buffer);
        case "png": return new PNGParser(buffer);
        default: return null;
    }
}