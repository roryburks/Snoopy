
import {getFileExtension,Uint8ToString} from "../util";
import {CanvasHexComponent} from "./canvashex";
import {Parser, ParseStructure, Segment, Bound, CellBinding, SegmentNode} from "../parsers/parseStructure";
import {JPGParser} from "../parsers/parseJPG";
import {PNGParser} from "../parsers/parsePNG";
import {GIFParser} from "../parsers/parseGIF";
import {Queue} from "../util";
import {TreeManager} from "./treemanager";

export class UIManager {
    data  : Uint8Array;
    scrollBar : HTMLDivElement;
    scrollField : HTMLDivElement;
    segmentContent : HTMLDivElement;
    segmentTitle : HTMLElement;
    parsed : ParseStructure;
    segments : Segment[];
    filename : string;

    hexComponent : any;
    treeManager : TreeManager;



    constructor() {
        this.hexComponent = new CanvasHexComponent(this);
        this.treeManager = new TreeManager(this)
        
        this.scrollBar = $("#efsContainer").get(0) as HTMLDivElement;
        this.scrollField = $("#efScroll").get(0) as HTMLDivElement;
        this.segmentContent = $("#segmentContent").get(0) as HTMLDivElement;
        this.segmentTitle = $("#segmentTitle").get(0);


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
            getFileExtension(this.filename), this.data);
        this.parsed = (parser)?parser.parse() : null;


        $("#visualField").empty();
        if( this.parsed) {
            $("#visualField").html( this.parsed.visualHTML );
            this.treeManager.constructTree();
            this.segments = this.parsed.segmentTree.getRoot().getAll();
        }
        
        // Adjust the size of the scrollField
        var h = Math.max( $(this.scrollBar).height(), (this.hexComponent)?this.hexComponent.getScrollHeight():0);
        this.scrollField.style.height =  h + "px";

        if( this.hexComponent)
            this.hexComponent.updateData();
    }


    boundSegment : Segment;
    setBoundSegment( seg : Segment, scrollto?: boolean) {
        // Set the bound segment internally
        if( this.boundSegment == seg) return;
        this.boundSegment = seg;
        this.hexComponent.setSegment(seg);

        // If the segment is null, empty out the segment
        if( seg == null) {
            $(this.segmentContent).empty();
            return;
        }

        // Otherwise construct a new segment
        this.segmentTitle.innerHTML = seg.title;
        var str : string = "";

        if( seg.uiComponents) {
            // Build the HTML
            for( var i=0; i<seg.uiComponents.length; ++i) {
                str += seg.uiComponents[i].buildUI(seg, this.data);
            }
            $(this.segmentContent).get(0).innerHTML = str;
            // Link the Event watchers
            for( let i=0; i<seg.links.length; ++i) {
                var ele = $(".db_"+i);
                ele.click( ((evt: JQueryEventObject): any => {
                    this.bindingClicked(i);
                }).bind(this));
                ele.addClass("sfInt");
            }
        }
        else $(this.segmentContent).get(0).innerHTML = str;

        if( scrollto && seg ) {
            this.scrollTo(seg.start);
        }
    }
    scrollTo( index : number) {
        if( index && this.hexComponent) {
            this.hexComponent.scrollTo(index);
        }
    }

    private bindingClicked( index : number) {
        if( !this.boundSegment || index < 0 || !this.boundSegment.links 
            || this.boundSegment.links.length <= index) 
            return;

        //
        var bound : Bound = {
            start : this.boundSegment.links[index].getStartByte(),
            len : this.boundSegment.links[index].getLength()
        };
        if( this.hexComponent) this.hexComponent.setHighlighted(bound );
    }

    selectionChanged( selected : Bound[]) {
        if( !selected) return;

        var seg = this.boundSegment;
        if( seg && seg.links) {
            for( var i=0; i < seg.links.length; ++i) {
                var b1 = seg.links[i].getBound();
                if( !b1) continue;

                var sel = false;
                for( var j=0; j < selected.length; ++j) {
                    var b2 = selected[j];
                    if( !b2 || b1.start > b2.start + b2.len-1 || b1.start + b1.len-1 < b2.start)
                        continue;
                        
                    sel = true;
                    $(this.segmentContent).find(".db_"+i).addClass("sfSel");
                }
                if( !sel) {
                    $(this.segmentContent).find(".db_"+i).removeClass("sfSel");
                }
            }
        }
    }
}


export abstract class HexComponent {
    abstract rebuildHexTables() : void;
    abstract updateData() : void;
    abstract getScrollHeight() : number;
    abstract setHighlighted( bound : Bound) : void;
}



function getParserFromExtension( ext : string, buffer : Uint8Array) {
    if( ext) ext = ext.toLowerCase();
    switch( ext) {
        case "jpg": case "jpeg": return new JPGParser(buffer);
        case "png": return new PNGParser(buffer) ;
        case "gif": return new GIFParser(buffer) ;
        default: return null;
    }
}