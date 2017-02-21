

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

const _hex = "0123456789ABCDEF";
function hexStr( uint : number ) : string {
    return _hex[(uint>>4) & 0xF]+ _hex[uint & 0xF];
}
export {hexStr};

const _ascii = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
console.log( _ascii.length);
function asciiStr( uint : number) : string {
    if( uint < 32) return " ";
    if( uint < 65 || (uint>90 && uint<97))
        return '&#'+uint+';';
    if( uint < 127) 
        return _ascii[uint - 32];
    return " ";
};