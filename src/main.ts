function hello(compiler: string) {
    console.log(`Hello from ${compiler}`);
}
hello("TypeScript");

$("#btnStart").get(0).onclick = loadFile;

var hexField = $("#hexField").get(0);
var asciiField = $("#asciiField").get(0);

// Link the ASCII and Hex Scrollbars together
hexField.onscroll = (evt : Event) => {
    asciiField.scrollTop = hexField.scrollTop;
}
asciiField.onscroll = (evt : Event) => {
    hexField.scrollTop = asciiField.scrollTop;
}

function loadFile() {
    var fileBox = $("#fileinput").get(0) as HTMLInputElement;

    var loader = new Loader( fileBox.files[0]);

}

class Loader {
    fileReader : FileReader;

    constructor( file:  File) {
        this.fileReader = new FileReader();
        this.fileReader.onload = this.onLoad.bind(this);
        this.fileReader.readAsArrayBuffer( file);
    }

    onLoad( evt : ProgressEvent) {
        var array = this.fileReader.result as ArrayBuffer;
        var uArray = new Uint8Array(array, 0, array.byteLength);
        var hexField = $("#hexField").get(0) as HTMLDivElement;
        var asciiField = $("#asciiField").get(0) as HTMLDivElement;

        var len = getTextWidth("12", window.getComputedStyle(hexField, null).font);
//        var lenA = getTextWidth("1", asciiField.style.font);
        var w = hexField.clientWidth;

        var hex : string = "";
        var ascii : string = "";

        console.log( hexField.scrollWidth + "," + hexField.clientWidth)

        var charPerLine = Math.max(1, Math.floor(w/len));
        for( var i =0 ; i < uArray.length; ++i) {
            hex += hexStr(uArray[i]);
            ascii += asciiStr(uArray[i]);
            if(i % charPerLine == charPerLine-1) {
                hex += "<br \>";
                ascii += "<br \>";
            }
        }


        hexField.innerHTML = hex;
        asciiField.innerHTML = ascii;
    }
}

const _hex = "0123456789ABCDEF";
function hexStr( uint : number ) : string {
    return _hex[(uint>>4) & 0xF]+ _hex[uint & 0xF];
}
const _ascii = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
console.log( _ascii.length);
function asciiStr( uint : number) : string {
    if( uint < 32) return " ";
    if( uint < 127) return _ascii[uint - 32];
    return " ";
}


function getTextWidth(text : string, font : string) : number {
    var canvas = $("#canvas").get(0) as HTMLCanvasElement;
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
}