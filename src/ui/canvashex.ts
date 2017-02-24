import { UIManager, boundSetSegmentField} from "./uimanager";
import {Dimension, getTextDimensions} from "../util";
import {Segment} from "../parsers/parseStructure";
import {hexStr, asciiStr} from "../main";


class Bound {
    start : number;
    len : number;
}
export class CanvasHexComponent {
    context : UIManager;

    hexField : HTMLCanvasElement;
    asciiField: HTMLCanvasElement;
    hexStage : HTMLCanvasElement;
    asciiStage : HTMLCanvasElement;

    textDim : Dimension;
    bytesPerLine : number;
    visLines : number;

    selected : Bound[] = null;

    constructor(context : UIManager) {
        this.context = context;
        this.hexField = $("#hexField").get(0) as HTMLCanvasElement;
        this.asciiField = $("#asciiField").get(0) as HTMLCanvasElement;
        this.hexStage = $("#hexStaging").get(0) as HTMLCanvasElement;
        this.asciiStage = $("#asciiStaging").get(0) as HTMLCanvasElement;

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
    }

    buildingSel : Bound;
    bsStart : number;
    private startDrag( evt : MouseEvent, hex : boolean) {
        var offset= this.getOffsetFromPos(
            evt.pageX - $(this.hexField).offset().left, 
            evt.pageY - $(this.hexField).offset().top, hex);

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
            boundSetSegmentField.apply(seg);

        this.redraw();
    }
    private continueDrag( evt : MouseEvent, hex : boolean) {
        if( !this.buildingSel) return;

        console.log( this.buildingSel);

        var offset= this.getOffsetFromPos(
            evt.pageX - $(this.hexField).offset().left, 
            evt.pageY - $(this.hexField).offset().top, hex);

        // Continue building the selection
        if( offset < this.bsStart) {
            this.buildingSel.start = offset;
            this.buildingSel.len = this.bsStart - offset;
        }
        else {
            this.buildingSel.start = this.bsStart;
            this.buildingSel.len = offset - this.bsStart + 1;
        }

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
        
        return startLine*this.bytesPerLine 
            + Math.floor(x / ((hex)?dim.width:(dim.width/2))) 
            + Math.floor(y / dim.height) * this.bytesPerLine;
    }

    public getSegmentFromOffset( index : number) : Segment {
        if( !this.context.parsed || !this.context.parsed.segments) return null;

        for( var i=0; i<this.context.parsed.segments.length; ++i) {
            var seg = this.context.parsed.segments[i];
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

    numLines : number;
    startLine : number;
    startByte : number;
    endByte : number;
    private recalculateDims() {
        var dim = this.textDim;

        this.numLines = Math.max( 1, Math.ceil(this.context.data.byteLength / this.bytesPerLine));
        this.startLine = Math.ceil(this.context.scrollBar.scrollTop / dim.height);

        this.startByte = this.startLine * this.bytesPerLine;
        this.endByte = Math.min( this.context.data.length, this.startByte + this.bytesPerLine*this.visLines );
    }
    redraw() {
        var actx = this.asciiField.getContext("2d");
        var hctx = this.hexField.getContext("2d");

        actx.fillStyle = "#AAAAAA";
        actx.fillRect( 0, 0, $(this.asciiField).width(), $(this.asciiField).height());

        hctx.fillStyle = "#AAAAAA";
        hctx.fillRect( 0, 0, $(this.hexField).width(), $(this.hexField).height());

        
        // Determing the dimensions necessary for constructing the fields
        var dim = this.textDim;
        this.recalculateDims();

        // Draw the segments
        if( this.context.parsed && this.context.parsed.segments) {
            for( var i=0; i < this.context.parsed.segments.length; ++i) {
                var seg = this.context.parsed.segments[i];
                this.drawBound( { start: seg.start, len: seg.length}, seg.color, hctx, actx);
            }
        }

        // Draw the Selection
        if( this.selected) {
            var color = "rgba( 0, 0, 0, 0.2)"
            for( var i=0; i<this.selected.length; ++i) {
                this.drawBound( this.selected[i], color, hctx, actx);
            }
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
    }
    
    private drawBound( 
        bound : Bound, 
        color : string, 
        hctx : CanvasRenderingContext2D,
        actx : CanvasRenderingContext2D) 
    {
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

    updateData() {
        var actx = this.asciiStage.getContext("2d");
        var hctx = this.hexStage.getContext("2d");

        this.recalculateDims();

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

}