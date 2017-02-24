import { UIManager, boundSetSegmentField} from "./uimanager";
import {Dimension, getTextDimensions} from "../util";
import {Segment} from "../parsers/parseStructure";
import {hexStr, asciiStr} from "../main";

export class CanvasHexComponent {
    context : UIManager;

    hexField : HTMLCanvasElement;
    asciiField: HTMLCanvasElement;

    textDim : Dimension;
    bytesPerLine : number;
    visLines : number;

    constructor(context : UIManager) {
        this.context = context;
        this.hexField = $("#hexField").get(0) as HTMLCanvasElement;
        this.asciiField = $("#asciiField").get(0) as HTMLCanvasElement;

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

        $(this.hexField).click(
            ((evt : JQueryEventObject) : any => {
                var me = (evt.originalEvent as MouseEvent);

                var seg = this.getSegmentFromOffset( this.getOffsetFromPos(
                    evt.pageX - $(this.hexField).offset().left, 
                    evt.pageY - $(this.hexField).offset().top, true));
                if(seg) 
                    boundSetSegmentField.apply(seg);
            }).bind(this)
        );
        $(this.asciiField).click(
            ((evt : JQueryEventObject) : any => {
                var me = (evt.originalEvent as MouseEvent);
                var seg = this.getSegmentFromOffset( this.getOffsetFromPos(
                    evt.pageX - $(this.asciiField).offset().left, 
                    evt.pageY - $(this.asciiField).offset().top, false));
                if(seg)
                    boundSetSegmentField.apply(seg);
            }).bind(this)
        );
    }

    private findTextDimensions() {
        var context = this.hexField.getContext("2d");
        context.font = "12px Courier New, Courier, monospace";
        var metrics = context.measureText("12");
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

        this.hexField.width = this.hexField.clientWidth;
        this.hexField.height = this.hexField.clientHeight;
        this.asciiField.width = this.asciiField.clientWidth;
        this.asciiField.height = this.asciiField.clientHeight;
    }
    getScrollHeight() : number {
        
        var dim = this.textDim;
        var numLines = Math.max( 1, Math.ceil(this.context.data.byteLength / this.bytesPerLine));
        return dim.height * numLines;
    }

    updateData() {
        var actx = this.asciiField.getContext("2d");
        var hctx = this.hexField.getContext("2d");

        actx.font = "12px Courier New, Courier, monospace";
        actx.fillStyle = "#AAAAAA";
        actx.fillRect( 0, 0, $(this.asciiField).width(), $(this.asciiField).height());

        hctx.font = "12px Courier New, Courier, monospace";
        hctx.fillStyle = "#AAAAAA";
        hctx.fillRect( 0, 0, $(this.hexField).width(), $(this.hexField).height());

        
        // Determing the dimensions necessary for constructing the fields
        var dim = this.textDim;
        var w = $(this.hexField).width();
        var h = $(this.hexField).height();
        var dim = this.textDim;
        var numLines = Math.max( 1, Math.ceil(this.context.data.byteLength / this.bytesPerLine));
        var startLine = Math.ceil(this.context.scrollBar.scrollTop / dim.height);

        var startByte = startLine * this.bytesPerLine;
        var endByte = Math.min( this.context.data.length, startByte + this.bytesPerLine*this.visLines );

        // Draw the segments
        if( this.context.parsed && this.context.parsed.segments) {
            for( var i=0; i < this.context.parsed.segments.length; ++i) {
                var seg = this.context.parsed.segments[i];
                if( seg.start < endByte && seg.start+seg.length > startByte) {
                    var start =Math.floor((seg.start - startByte) / this.bytesPerLine); 
                    var end = Math.floor((seg.start + seg.length - startByte) / this.bytesPerLine);
                    for( var row=start; row <= end; ++row) {
                        actx.fillStyle = seg.color;
                        hctx.fillStyle = seg.color;

                        var x1 = (row == start) ? (seg.start % this.bytesPerLine) : 0;
                        var x2 = (row == end) ? ((seg.start + seg.length) % this.bytesPerLine) : (this.bytesPerLine);

                        actx.fillRect( x1*dim.width/2, row*dim.height, (x2-x1)*dim.width/2, dim.height);
                        hctx.fillRect( x1*dim.width, row*dim.height, (x2-x1)*dim.width, dim.height);
                    }
                }
            }
        }

        // Draw Data Text
        actx.fillStyle = "#000000";
        actx.textBaseline = "hanging";
        hctx.fillStyle = "#000000";
        hctx.textBaseline = "hanging";
        if( this.context.data) {
            var x = 0, y = 0;
            for( var index = startByte; index < endByte; ++index) {
                actx.fillText( asciiStr(this.context.data[index]), x*this.textDim.width/2, y * this.textDim.height);
                hctx.fillText( hexStr(this.context.data[index]), x*this.textDim.width, y * this.textDim.height);
                ++x;
                if( x >= this.bytesPerLine) 
                    {x = 0; ++y;}
            }
            
        }

        // Draw Grid
        var tw = this.textDim.width;
        var tw2 = this.textDim.width/2;
        var th = this.textDim.height;
        hctx.lineWidth = 1;
        actx.lineWidth = 1;
        hctx.save();
        actx.save();
        hctx.translate(0.5,0.5);
        actx.translate(0.5,0.5);
        hctx.beginPath();
        actx.beginPath();
        for( x=1; x <= this.bytesPerLine; ++x) {
            hctx.moveTo( Math.round(x*tw), 0);
            actx.moveTo( Math.round(x*tw2), 0);
            hctx.lineTo( Math.round(x*tw), Math.round(h));
            actx.lineTo( Math.round(x*tw2), Math.round(h));
        }
        for( y=1; y <= this.visLines; ++y) {
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
        console.log( this.bytesPerLine);
    }
}