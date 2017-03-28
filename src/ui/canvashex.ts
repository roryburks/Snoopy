import { UIManager, HexComponent} from "./uimanager";
import {Dimension, getTextDimensions} from "../util";
import {Segment, Bound} from "../parsers/parseStructure";
import {hexStr, asciiStr} from "../main";



class Coord {
    r : number;
    c : number;
}

export class CanvasHexComponent  {
    context : UIManager;

    hexField : HTMLCanvasElement;
    asciiField: HTMLCanvasElement;
    hexStage : HTMLCanvasElement;
    asciiStage : HTMLCanvasElement;
    efScroll : HTMLElement;

    textDim : Dimension;
    bytesPerLine : number;
    visLines : number;

    selected : Bound[] = null;
    currentSegment: Segment = null;

    constructor(context : UIManager) {
        this.context = context;
        this.hexField = $("#hexField").get(0) as HTMLCanvasElement;
        this.asciiField = $("#asciiField").get(0) as HTMLCanvasElement;
        this.hexStage = $("#hexStaging").get(0) as HTMLCanvasElement;
        this.asciiStage = $("#asciiStaging").get(0) as HTMLCanvasElement;
        this.efScroll = $("#efScroll").get(0);

        this.initBindings();
    }

    private initBindings() {
        // Bind input in the not-actually-moving hex and ascii fields into the scrollBar
        var f = (evt : JQueryEventObject) : any => {
            var me = (evt.originalEvent as WheelEvent)
            var amt = me.wheelDelta || 
                -me.deltaY * 30;

            this.context.scrollBar.scrollTop -= amt;
            try {
                evt.stopPropagation();
                evt.preventDefault();
                me.preventDefault();
                me.stopPropagation();
                me.stopImmediatePropagation();
            } catch(e) {}
        }
        $(this.hexField).bind("touchstart",((evt : JQueryEventObject) : any => {
            $(this.efScroll).trigger("touchstart", evt)}));
        $(this.asciiField).bind("touchstart",((evt : JQueryEventObject) : any => {
            $(this.efScroll).trigger("touchstart", evt)}));
        $(this.hexField).bind("touchmove",((evt : JQueryEventObject) : any => {
            $(this.efScroll).trigger("touchmove", evt)}));
        $(this.asciiField).bind("touchmove",((evt : JQueryEventObject) : any => {
            $(this.efScroll).trigger("touchmove", evt)}));

        $(this.hexField).bind("wheel",f);
        $(this.asciiField).bind("wheel",f);

        $(this.hexField).mousedown(((evt : JQueryEventObject) : any => {
            this.startDrag( evt.originalEvent as MouseEvent, true);
        }).bind(this));
        $(this.asciiField).mousedown(((evt : JQueryEventObject) : any => {
            this.startDrag( evt.originalEvent as MouseEvent, false);
        }).bind(this));
        $(this.hexField).mousemove(((evt : JQueryEventObject) : any => {
            this.continueDrag( evt.originalEvent as MouseEvent, true);
        }).bind(this));
        $(this.asciiField).mousemove(((evt : JQueryEventObject) : any => {
            this.continueDrag( evt.originalEvent as MouseEvent, false);
        }).bind(this));
        $(this.hexField).mouseup(((evt : JQueryEventObject) : any => {
            this.endDrag( evt.originalEvent as MouseEvent, true);
        }).bind(this));
        $(this.asciiField).mouseup(((evt : JQueryEventObject) : any => {
            this.endDrag( evt.originalEvent as MouseEvent, false);
        }).bind(this));

        $(window).resize(((evt : JQueryEventObject) : any => {
            // TODO
        }).bind(this));

    }

    private selectionChanged() {
        this.context.selectionChanged( this.selected);
    }

    buildingSel : Bound;
    bsStart : number;
    private startDrag( evt : MouseEvent, hex : boolean) {
        var offset= this.getOffsetFromPos( evt.pageX , evt.pageY , hex);

        // Start building the new selection
        this.bsStart = offset;
        this.buildingSel = {start:offset, len:1};
        if( evt.ctrlKey) {
            this.selected.push(this.buildingSel);
        }
        else this.selected = [this.buildingSel];

        // Set the Segment Data in the Segment Field
        var seg = this.getSegmentFromOffset( offset);
        if(seg)
            this.context.setBoundSegment(seg);
            
        this.selectionChanged();

        this.redraw();
    }
    private continueDrag( evt : MouseEvent, hex : boolean) {
        if( !this.buildingSel) return;

        var offset= this.getOffsetFromPos( evt.pageX , evt.pageY , hex);

        // Continue building the selection
        if( offset < this.bsStart) {
            this.buildingSel.start = offset;
            this.buildingSel.len = this.bsStart - offset;
        }
        else {
            this.buildingSel.start = this.bsStart;
            this.buildingSel.len = offset - this.bsStart + 1;
        }
        this.selectionChanged();

        this.redraw();
    }
    private endDrag( evt: MouseEvent, hex : boolean) {
        this.buildingSel = null;
        this.bsStart = -1;
    }

    private findTextDimensions() {
        var context = this.hexField.getContext("2d");
        context.font = "12px Courier New, Courier, monospace";
        var metrics = context.measureText("FF");
        this.textDim = {
            width : metrics.width,
            height: 13
        };
        
        var w = $(this.hexField).width();
        var h = $(this.hexField).height();
        this.bytesPerLine = Math.max(1, Math.floor(w/this.textDim.width))-1;
        this.visLines = Math.max( 1, Math.floor(h/this.textDim.height)); 

    }
    public getOffsetFromPos( x:number, y:number, hex : boolean) : number {
        var dim = this.textDim;
        var startLine = Math.ceil(this.context.scrollBar.scrollTop / dim.height);

        if( hex) {
            x -= $(this.hexField).offset().left;
            y -= $(this.hexField).offset().top;
        }
        else {
            x -= $(this.asciiField).offset().left;
            y -= $(this.asciiField).offset().top;
        }
        
        
        return startLine*this.bytesPerLine 
            + Math.floor(x / ((hex)?dim.width:(dim.width/2))) 
            + Math.floor(y / dim.height) * this.bytesPerLine;
    }

    public getSegmentFromOffset( index : number) : Segment {
        if( !this.context.parsed || !this.context.segments) return null;

        for( var i=0; i<this.context.segments.length; ++i) {
            var seg = this.context.segments[i];
            if( seg.start <= index && seg.start + seg.length > index)
                return seg;
        }

        return null;
    }


    rebuildHexTables() {
        this.findTextDimensions();

        var w = this.hexField.clientWidth;
        var h = this.hexField.clientHeight;
        this.hexField.width = w;
        this.hexField.height = h;
        this.hexStage.width = w;
        this.hexStage.height = h;
        w = this.asciiField.clientWidth;
        h = this.asciiField.clientHeight;
        this.asciiField.width = w;
        this.asciiField.height = h;
        this.asciiStage.width = w;
        this.asciiStage.height = h;
    }
    getScrollHeight() : number {
        
        var dim = this.textDim;
        var numLines = Math.max( 1, Math.ceil(this.context.data.byteLength / this.bytesPerLine));
        return dim.height * numLines;
    }

    // Cached for ease of access
    numLines : number;
    startLine : number;
    startByte : number;
    endByte : number;
    hctx : CanvasRenderingContext2D;
    actx : CanvasRenderingContext2D;
    private recalculateDims() {
        var dim = this.textDim;

        this.numLines = Math.max( 1, Math.ceil(this.context.data.byteLength / this.bytesPerLine));
        this.startLine = Math.ceil(this.context.scrollBar.scrollTop / dim.height);

        this.startByte = this.startLine * this.bytesPerLine;
        this.endByte = Math.min( this.context.data.length, this.startByte + this.bytesPerLine*this.visLines );
    }
    redraw() {
        var actx = this.actx = this.asciiField.getContext("2d");
        var hctx = this.hctx = this.hexField.getContext("2d");

        actx.fillStyle = "#AAAAAA";
        actx.fillRect( 0, 0, $(this.asciiField).width(), $(this.asciiField).height());

        hctx.fillStyle = "#AAAAAA";
        hctx.fillRect( 0, 0, $(this.hexField).width(), $(this.hexField).height());

        
        // Determing the dimensions necessary for constructing the fields
        var dim = this.textDim;
        this.recalculateDims();

        // Draw the segments
        if( this.context.parsed && this.context.segments) {
            for( var i=0; i < this.context.segments.length; ++i) {
                var seg = this.context.segments[i];
                this.drawBound( { start: seg.start, len: seg.length}, seg.color);
            }
        }

        // Draw the Selection
        if( this.selected) {
            var color = "rgba( 0, 0, 0, 0.2)"
            for( var i=0; i<this.selected.length; ++i) {
                this.drawBound( this.selected[i], color);
            }
        }

        // Draw the Highlighted Area
        if( this.highlighted) {
            var color = "rgba( 160, 160, 190, 0.7)"
            this.drawBound( this.highlighted, color);
        }


        // Draw the text that has been pre-rendered on the staging field, since "SOME BROWSERS"
        // (Firefox) are apparently horrible at drawing text
        hctx.drawImage( this.hexStage, 0, 0);
        actx.drawImage( this.asciiStage, 0, 0);

        // Draw Grid
        var tw = this.textDim.width;
        var tw2 = this.textDim.width/2;
        var th = this.textDim.height;
        var w = $(this.hexField).width();
        var h = $(this.hexField).height();
        hctx.lineWidth = 1;
        actx.lineWidth = 1;
        hctx.save();
        actx.save();
        hctx.translate(0.5,0.5);
        actx.translate(0.5,0.5);
        hctx.beginPath();
        actx.beginPath();
        for( var x=1; x <= this.bytesPerLine; ++x) {
            hctx.moveTo( Math.round(x*tw), 0);
            actx.moveTo( Math.round(x*tw2), 0);
            hctx.lineTo( Math.round(x*tw), Math.round(h));
            actx.lineTo( Math.round(x*tw2), Math.round(h));
        }
        for( var y=1; y <= this.visLines; ++y) {
            hctx.moveTo( 0, Math.round(y*th));
            actx.moveTo( 0, Math.round(y*th));
            hctx.lineTo( Math.round(w), Math.round(y*th));
            actx.lineTo( Math.round(w), Math.round(y*th));
        }
        hctx.strokeStyle = "rgba(255,255,255,0.25)";
        actx.strokeStyle = "rgba(255,255,255,0.25)";
        hctx.stroke();
        actx.stroke();
        hctx.restore();
        actx.restore();

        // Draw Borders
        if( this.currentSegment) {
            // Segment
            var color = "rgb( 0, 255, 0)"
            var bound : Bound = {
                start: this.currentSegment.start,
                len : this.currentSegment.length
            }
            this.drawBorder( bound, color, 2);
        }
        if( this.selected) {
            // Selected
            var color = "rgb( 255, 255, 255)"
            for( var i=0; i<this.selected.length; ++i) {
                this.drawBorder( this.selected[i], color, 2);
            }
        }
        if( this.highlighted) {
            // Highlighted
            var color = "rgb( 0, 0, 0)"
            this.drawBorder( this.highlighted, color, 2);
        }
    }
    
    private drawBound( 
        bound : Bound, 
        color : string) 
    {
        var actx = this.actx;
        var hctx = this.hctx;
        if( !bound) return;
        var dim = this.textDim;
        if( bound.start < this.endByte && bound.start+bound.len > this.startByte) {
            var start =Math.floor((bound.start - this.startByte) / this.bytesPerLine); 
            var end = Math.floor((bound.start + bound.len - this.startByte) / this.bytesPerLine);
            for( var row=start; row <= end; ++row) {
                actx.fillStyle = color;
                hctx.fillStyle = color;

                var x1 = (row == start) ? (bound.start % this.bytesPerLine) : 0;
                var x2 = (row == end) ? ((bound.start + bound.len) % this.bytesPerLine) : (this.bytesPerLine);

                actx.fillRect( x1*dim.width/2, row*dim.height, (x2-x1)*dim.width/2, dim.height);
                hctx.fillRect( x1*dim.width, row*dim.height, (x2-x1)*dim.width, dim.height);
            }
        }
    }

    private drawBorder(
        bound : Bound,
        color : string, 
        width : number)
    {
        if(!bound) return;

        var start = this.toCoord(bound.start);
        var e = bound.len+bound.start-1;
        var end = this.toCoord(e);
        var o = width/2;

        this.beginLine( color, width);
        if( start.r == end.r) {
            this.moveTo( start.c, start.r, -o, -o);
            this.lineTo( end.c+1, start.r, o, -o);
            this.lineTo( end.c+1, end.r+1, o, o);
            this.lineTo( start.c, end.r+1, -o, o);
            this.lineTo( start.c, start.r, -o, -o);
        }
        else if( bound.len <= this.bytesPerLine) {
            var s_2 = this.toCoord(bound.start - (bound.start % this.bytesPerLine) + this.bytesPerLine - 1);
            var e_2 = this.toCoord(e - (e % this.bytesPerLine));
            this.moveTo( start.c, start.r, -o, -o);
            this.lineTo( s_2.c+1, start.r, o, -o);
            this.lineTo( s_2.c+1, s_2.r+1, o, o);
            this.lineTo( start.c, s_2.r+1, -o, o);
            this.lineTo( start.c, start.r, -o, -o);
            
            this.moveTo( e_2.c, e_2.r, -o, -o);
            this.lineTo( end.c+1, e_2.r, o, -o);
            this.lineTo( end.c+1, end.r+1, o, o);
            this.lineTo( e_2.c, end.r+1, -o, o);
            this.lineTo( e_2.c, e_2.r, -o, -o);
        }
        else {
            var br = this.toCoord(e - (e % this.bytesPerLine) - 1);
            var tl = this.toCoord(bound.start - (bound.start % this.bytesPerLine) + this.bytesPerLine);

            this.moveTo( start.c, start.r, -o, -o);
            this.lineTo( br.c+1, start.r, o, -o);
            this.lineTo( br.c+1, br.r+1, o, o);
            this.lineTo( end.c+1, br.r+1, o, o);
            this.lineTo( end.c+1, end.r+1, o, o);
            this.lineTo( tl.c, end.r+1, -o, o);
            this.lineTo( tl.c, tl.r, -o, -o);
            this.lineTo( start.c, tl.r, -o, -o);
            this.lineTo( start.c, start.r, -o, -o);
        }
        this.endLine();
    }

    private beginLine( style : string, lineWidth : number) {
        var hctx = this.hctx;
        var actx = this.actx;
        hctx.strokeStyle = style;
        actx.strokeStyle = style;
        hctx.lineWidth = lineWidth;
        actx.lineWidth = lineWidth;
        hctx.save();
        actx.save();
        hctx.translate(0.5,0.5);
        actx.translate(0.5,0.5);
        hctx.beginPath();
        actx.beginPath();
    }
    private endLine() {
        var hctx = this.hctx;
        var actx = this.actx;
        hctx.stroke();
        actx.stroke();
        hctx.restore();
        actx.restore();
    }
    private moveTo( c : number, r: number, ox = 0, oy = 0) {
        this.hctx.moveTo( Math.round(c*this.textDim.width+ ox) , Math.round(r*this.textDim.height+oy));
        this.actx.moveTo( Math.round(c*this.textDim.width/2+ ox), Math.round(r*this.textDim.height+oy));
    }
    private lineTo( c : number, r: number, ox = 0, oy = 0) {
        this.hctx.lineTo( Math.round(c*this.textDim.width+ox), Math.round(r*this.textDim.height+oy));
        this.actx.lineTo( Math.round(c*this.textDim.width/2+ox), Math.round(r*this.textDim.height+oy));
    }

    private toCoordR( n: number) : number {
        return Math.floor((n- this.startByte)/this.bytesPerLine);
    }
    private toCoordC( n : number) : number {
        return (n-this.startByte)%this.bytesPerLine;
    }
    private toCoord( n : number) : Coord {
        return  {
            r: Math.floor((n- this.startByte)/this.bytesPerLine),
            c : (n-this.startByte)%this.bytesPerLine
        }
    }

    updateData() {
        var actx = this.asciiStage.getContext("2d");
        var hctx = this.hexStage.getContext("2d");

        this.recalculateDims();

        hctx.clearRect(0, 0, this.hexStage.width, this.hexStage.height);
        actx.clearRect(0, 0, this.asciiStage.width, this.asciiStage.height);
        // Draw Data Text onto the staging Field
        actx.font = "12px Courier New, Courier, monospace";
        hctx.font = "12px Courier New, Courier, monospace";
        actx.fillStyle = "#000000";
        actx.textBaseline = "hanging";
        hctx.fillStyle = "#000000";
        hctx.textBaseline = "hanging";
        if( this.context.data) {
            var x = 0, y = 0;
            for( var index = this.startByte; index < this.endByte; ++index) {
                actx.fillText( asciiStr(this.context.data[index]), x*this.textDim.width/2, y * this.textDim.height);
                hctx.fillText( hexStr(this.context.data[index]), x*this.textDim.width, y * this.textDim.height);
                ++x;
                if( x >= this.bytesPerLine) 
                    {x = 0; ++y;}
            }
        }

        this.redraw();
    }

    highlighted : Bound;
    setHighlighted( bound : Bound) {
        this.highlighted = bound;
        this.redraw();
    }

    public setSegment( seg : Segment) {
        this.currentSegment = seg;
        this.redraw;
    }

    
    public scrollTo( index : number) {
        var dim = this.textDim;
        this.context.scrollBar.scrollTop = Math.floor(index / this.bytesPerLine) * dim.height;
    }
}