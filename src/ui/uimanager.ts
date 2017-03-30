
import {getFileExtension,Uint8ToString} from "../util";
import {CanvasHexComponent} from "./canvashex";
import {Parser, ParseStructure, Segment, Bound, SegmentNode} from "../parsers/parseStructure";
import {JPGParser} from "../parsers/parseJPG";
import {PNGParser} from "../parsers/parsePNG";
import {GIFParser} from "../parsers/parseGIF";
import {TXTParser} from "../parsers/parseTXT";
import {Queue} from "../util";
import {TreeManager} from "./treemanager";

export class UIManager {
    data  : Uint8Array;
    scrollBar : HTMLDivElement;
    scrollField : HTMLDivElement;
    segmentContent : HTMLDivElement;
    segmentTitle : HTMLElement;
    binfield : HTMLElement;

    btnRefresh : HTMLElement;

    hexContainer : HTMLElement;
    visualField : HTMLElement;

    valueButton : HTMLButtonElement;
    valueContent : HTMLElement;
    valueAuto : HTMLElement;
    valueButtonTTT : HTMLElement;

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
        this.binfield = $("#segmentBin").get(0);
        this.hexContainer = $("#efsContainer").get(0) ;
        this.btnRefresh = $("#btnRefresh").get(0);

        this.visualField = $("visualField").get(0);
        this.valueButton = $("#valueCommit").get(0) as HTMLButtonElement;
        this.valueContent = $("#valueContent").get(0);
        this.valueAuto = $("#valueAuto").get(0);
        this.valueButtonTTT = $("#valButCont").find(".ttt").get(0);


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
        this.hexContainer.onmousedown = (evt : MouseEvent) => 
            {this.hexComponent.mdown(evt);}
        this.hexContainer.onmousemove = (evt : MouseEvent) => 
            {this.hexComponent.mmove(evt);}
        this.hexContainer.onmouseup = (evt : MouseEvent) => 
            {this.hexComponent.mup(evt);}
        this.btnRefresh.onclick = (evt : MouseEvent) =>
            {$("#visualField").html( this.parsed.visualComp.buildUI(this.data) );}
    }

    assosciateData( data : Uint8Array, filename : string) {
        this.data = data;
        this.filename = filename;
        
        var parser = getParserFromExtension(
            getFileExtension(this.filename), this.data);
        this.parsed = (parser)?parser.parse() : null;


        $("#visualField").empty();
        if( this.parsed) {
            $("#visualField").html( this.parsed.visualComp.buildUI(this.data) );
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
    /** Sets the bound segment (i.e. the segment that is shown in the segment field)
     * to the given segment.
     * 
     * scrollto: whether or not to scroll to the selected segment
     * force: if true, will re-build the segment even if it's currently selected.
     */
    setBoundSegment( seg : Segment, scrollto?: boolean, force?:boolean) {
        // Set the bound segment internally
        if( this.boundSegment == seg && !force) return;
        if( this.boundSegment != seg)
            this.nillOutBinding();
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
                ele.mouseover( ((evt: JQueryEventObject): any => {
                    this.bindingHighlighted(i);
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

    /** Called when the user mouses over on one of the bound elements
     *  inside the Segment area.
     */
    private bindingHighlighted( index : number) {
        if( !this.boundSegment || index < 0 || !this.boundSegment.links 
            || this.boundSegment.links.length <= index) 
            return;
        
        var link = this.boundSegment.links[index];

        // Higlight the area of the DataLink
        var bound : Bound = {
            start : link.getStartByte(),
            len : link.getLength()
        };
        if( this.hexComponent) this.hexComponent.setHighlighted(bound );

        var inner = "";
        var sbm = link.getStartBitmask();
        var len = link.getLength();

        if( len == 1) {
            if( (sbm&0xFF) != 0xFF) {
                inner = this.highlightedByte( this.data[link.getStartByte()], sbm);
            }
        }


        this.binfield.innerHTML = inner;
    }

    /** Called when the user clicks on one of the bound elements, displays the
     * element in the Value Field. */
    private bindingClicked( index : number) {
        if( !this.boundSegment || index < 0 || !this.boundSegment.links 
            || this.boundSegment.links.length <= index) 
            return;
        
        var link = this.boundSegment.links[index];

        // Higlight the area of the DataLink
        var bound : Bound = {
            start : link.getStartByte(),
            len : link.getLength()
        };
        this.hexComponent.setSelected( bound );

        // Update the ValueField
        this.valueButton.disabled = !link.editable;
        $(this.valueAuto).empty();
        $(this.valueContent).empty();
        this.valueButton.onclick = null;

        if( link.editable) {
            // Load up the Value UI Component
            var vuic = link.uiComp;
            if( vuic != null) {
                var ele =  vuic.buildUI();
                $(this.valueContent).append(ele);
                vuic.updateUI(link.getValue(this.data));
                
                // Bind everthing together
                this.valueButton.onclick = (evt : MouseEvent) :any => {
                    link.changeValue(this.data, vuic.getUIValue());
                    this.setBoundSegment(this.boundSegment,false, true);
                    this.hexComponent.updateData();
                } ;
            }
        }

        if( this.valueButton.onclick == null )
            $(this.valueButtonTTT).css("display","block");
        else 
            $(this.valueButtonTTT).css("display","none");
    }
    private nillOutBinding() {
        this.valueButton.disabled = true;
        $(this.valueAuto).empty();
        $(this.valueContent).empty();
        this.valueButton.onclick = null;
        $(this.valueButtonTTT).css("display","none");
    }

    // =====================
    // ==== HTML Construction Methods

    /** Constructs and HTML string representing a byte's binary value with
     * the bits from the bitmask highlighted. */
    private highlightedByte( byte : number, bitmask : number) : string {
        var str = byte.toString(2);
        while( str.length < 8) str = "0"+str;

        var set = false;
        for( var i=0; i<9; ++i) {
            if( set && (i == 8 || !(bitmask & (1<<i)))){
                str = str.substr(0, 8-i) + '<span class="segmentBinHL">' + str.substr(8-i);
                set = false;
            }
            else if( !set && i != 8 && (bitmask & (1<<i))){
                str = str.substr(0, 8-i) + '</span>' + str.substr(8-i);
                set = true;
            }
        }

        return str;
    }

    /** Is called by the HexComponent whenever the user's editor selection
     * has changed.
     */
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
        case "txt": return new TXTParser(buffer);
        default: return null;
    }
}