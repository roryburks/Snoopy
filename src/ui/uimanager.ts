
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
    segmentField : HTMLDivElement;
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
        this.segmentField = $("#segmentField").get(0) as HTMLDivElement;

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
        if( this.boundSegment == seg) return;
        this.boundSegment = seg;

        if( seg == null) {
            $(this.segmentField).empty();
            return;
        }

        var str : string = "";

        str += seg.title + "<br />";

        if( seg.binding) {
            for( var i=0; i < seg.binding.length; ++i) {
                var html = seg.binding[i].getHTML();
                if( seg.binding[i].binding) {
                    if( seg.binding[i] instanceof CellBinding)
                        str += '<td class="dbnd'+i+'">' + html + '</td>';
                    else 
                        str += '<span class="dbnd'+i+'">' + html + '</span>';
                }
                else str += html;
            }
            $(this.segmentField).get(0).innerHTML = str;
            for( var i=0; i < seg.binding.length; ++i) {
                if( seg.binding[i].binding) {
                    {
                        // Create a strictly-scoped copy of i so that bindingClicked is bound
                        //  to a different one each time, instead of being bound to the itterating
                        //  i which will always be seg.binding.length by the time the binding
                        //  is ever called
                        let ind = i;

                        var ele = $(".dbnd"+ind);
                        ele.click( ((evt : JQueryEventObject) : any => {
                            this.bindingClicked(ind);
                        }).bind(this));
                        ele.addClass("sfInt");
                    }
                }
            }
        }
        else $(this.segmentField).get(0).innerHTML = str;

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
        if( !this.boundSegment || index < 0 || !this.boundSegment.binding 
            || this.boundSegment.binding.length <= index) 
            return;

        //
        var bound = this.boundSegment.binding[index].binding;
        if( this.hexComponent) this.hexComponent.setHighlighted(bound );
    }

    selectionChanged( selected : Bound[]) {
        if( !selected) return;

        var seg = this.boundSegment;
        if( seg && seg.binding) {
            for( var i=0; i < seg.binding.length; ++i) {
                var b1 = seg.binding[i].binding;
                if( !b1) continue;

                var sel = false;
                for( var j=0; j < selected.length; ++j) {
                    var b2 = selected[j];
                    if( !b2 || b1.start > b2.start + b2.len-1 || b1.start + b1.len-1 < b2.start)
                        continue;
                        
                    sel = true;
                    $(this.segmentField).find(".dbnd"+i).addClass("sfSel");
                }
                if( !sel) {
                    $(this.segmentField).find(".dbnd"+i).removeClass("sfSel");
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