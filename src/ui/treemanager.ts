import {UIManager} from "./uimanager";
import {SegmentNode} from "../parsers/parseStructure";

/** A class in charge of managing the Tree Section's UI Componnets */
export class TreeManager {
    treeField : HTMLElement;
    
    context : UIManager;
    constructor(context : UIManager) {
        this.context = context;
        this.treeField = $("#treeField").get(0);
        this.initBindings();
    }
    initBindings() {
        $("#tbHide").click( ((evt : JQueryEventObject) : any => {
            $("#taE").css("display","none");
            $("#taC").css("display","block");
        }));
        $("#tbShow").click( ((evt : JQueryEventObject) : any => {
            $("#taC").css("display","none");
            $("#taE").css("display","block");
        }));
        $("#tbExpand").click( ((evt : JQueryEventObject) : any => {
            this.collapseAll();
        }).bind(this));
    }
            
    constructTree() {
        $(this.treeField).empty();
        this.constructTreeRec(this.context.parsed.segmentTree.getRoot(),0,true);
    }
    
    private constructTreeRec(  node:  SegmentNode, depth : number, visible : boolean)  {
        var children = node.getChildren();
        var str = "";
        for( var ci = 0; ci<children.length; ++ci) {
            var ele = document.createElement("div");
            $(ele).addClass("tfEle");

            // Binds a click event to the Tree Entry.
            //  -If the Node has a segment, the event will select that segment
            //      and will scroll to that segment's start.
            //  -If the Node is not linked to a segment, it will search its children
            //      for the first Node that has a segment (depth-first) and scroll to
            //      its start (while setting the selected segment to null)

            // Note: the let scope effectively binds these two values to the click event.
            //  without them, they would be bound to variables that will have changed
            let seg = children[ci].getSegment();
            let scrollTo : number;
            if( seg) scrollTo = seg.start;
            else {
                var all = children[ci].getAll();
                if( all.length > 0) 
                    scrollTo = all[0].start;
            }
            $(ele).click( ((evt : JQueryEventObject) : any => {
                this.context.setBoundSegment(seg);
                if( scrollTo)
                    this.context.scrollTo(scrollTo);
            }).bind(this));

            // Finish setting the attributes
            var str = "";
            for( var i=0; i<depth; ++i) {
                str += "-";
            }
            str += children[ci].getName();
            if( seg) {
                $(ele).css("background-color", seg.color);
            }
            $(ele).text(str);


            // Adds the elements to a row then to the field
            var row = document.createElement("div");
            $(row).addClass("tfRow");
            if( children[ci].getChildren().length > 0) {
                var exp = document.createElement('div');

                $(exp).addClass(children[ci].isExpanded()?"tfExp":"tfCol");
                
                let nnode = children[ci];
                $(exp).click( ((evt : JQueryEventObject) : any => {
                    this.toggleExpanded( nnode);
                }).bind(this));
                $(row).append(exp);
            }
            else {
                var exp = document.createElement('div');
                $(exp).addClass("tfGap");
                $(row).append(exp);
            }
            for( var i=0; i<depth; ++i){
                var exp = document.createElement('div');
                $(exp).addClass("tfGap");
                $(row).append(exp);
            }
            $(row).append( ele);
            if(!visible)
                $(row).css("display", "none");
            $(this.treeField).append( row);

            // Construct the rest
            this.constructTreeRec( children[ci], depth+1, visible && children[ci].isExpanded());
        }
    }

    private toggleExpanded( node : SegmentNode) {
        node.setExpanded( !node.isExpanded());
        this.reevaluateExpandedState();
    }

    private collapseAll() {
        var p = this.context.parsed;

        if( p)
            this._caRec(p.segmentTree.getRoot());
        this.reevaluateExpandedState();
    }
    private _caRec(node:  SegmentNode) {
        var children = node.getChildren();
        for( var i=0; i < children.length; ++i) {
            children[i].setExpanded(false);
            this._caRec( children[i]);
        }
    }
    
    private reevaluateExpandedState() {
        // This can be done much more efficiently by showing/hiding, which
        //  would require some binding between node and HTML element
        this.constructTree();
    }
}