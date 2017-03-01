

export function getFileExtension( name : string) : string {
    return /(?:\.([^.]+))?$/.exec(name)[1];
}

export function randcolor() : string {
    return "rgb(" + Math.floor(Math.random()*255) 
        + "," + Math.floor(Math.random()*255) + "," 
        + Math.floor(Math.random()*255) + ")"
}
export class Dimension {
    width : number;
    height : number;
}
export function getTextDimensions(text : string, font : string) : Dimension {
    var canvas = $("#canvas").get(0) as HTMLCanvasElement;
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return {
        width : metrics.width,
        height: parseInt(window.getComputedStyle(canvas, font).fontSize, 10)
    };
}
export function Uint8ToString(u8a : Uint8Array) : string{
    var CHUNK_SZ = 0x8000;
    var c = "";
    for (var i=0; i < u8a.length; i+=CHUNK_SZ) {
        c += String.fromCharCode.apply(null, u8a.subarray(i, i+CHUNK_SZ));
    }
    return c;
}

export function hexByteStr( hex : number) : string {
    var str = (hex&0xFF).toString(16);
    while( str.length < 2) str = "0"+str;
    return str;
}