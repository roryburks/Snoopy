import {JPGParser} from "./parseJPG";
import {Segment} from "./parseStructure";

function hello(compiler: string) {
    console.log(`Hello from ${compiler}`);
}
hello("TypeScript");

$("#btnStart").get(0).onclick = loadFile;

var hexField = $("#hexField").get(0);
var asciiField = $("#asciiField").get(0);

// Link the ASCII and Hex Scrollbars together
// Note: By having one element lock it and the other element unlock it,
//  you avoid component conflicts which dampen the event.  However this 
//  is an imperfect solution depending on how it is multithreaded.
var locked = true;
hexField.onscroll = (evt : Event) => {
    if( !locked) {
        locked = true;
        asciiField.scrollTop = hexField.scrollTop;
    }
    else locked = false;
}
asciiField.onscroll = (evt : Event) => {
    if( !locked) {
        locked = true;
        hexField.scrollTop = asciiField.scrollTop;
    }
    else locked = false;
}

/**
 * Loads the file stored in the #fileinput object and arranges the corresponding
 * UI objects
 */
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
        var line : string = "";

        var parser = new JPGParser(uArray);
        var parsed = parser.parse();
        var segment : Segment = null;
        var insegment = false;
        var wseg = 0;

        if( parsed.segments.length > wseg) {
            segment = parsed.segments[wseg++];
        }


        var charPerLine = Math.max(1, Math.floor(w/len));
        for( var i =0 ; i < uArray.length; ++i) {
            if( segment != null && !insegment && i == segment.start) {
                var str = '<span class="segment '+ 'segment' + (wseg-1) + '" style="background-color:'+segment.color+';">';
                insegment = true;
                hex += str;
                ascii += str;
            }
            hex += hexStr(uArray[i]);
            ascii += asciiStr(uArray[i]);

            if( segment != null && insegment && i == segment.start + segment.length - 1) {
                var str = '</span>';
                hex += str;
                ascii += str;
                if( parsed.segments.length > wseg) {
                    segment = parsed.segments[wseg++];
                    insegment = false;
                }
                else segment = null;
            }

            if(i % charPerLine == charPerLine-1) {
                hex += '<br />';
                ascii += '<br />';
            }
        }

        hexField.innerHTML = hex;
        asciiField.innerHTML = ascii;
        

        for( var i=0; i < parsed.segments.length; ++i) {
            $('.segment' + i).click( boundSetSegmentField.bind(parsed.segments[i]));
        }

    }
}

function boundSetSegmentField() {
    var seg = this as Segment;

    var str : string = "";

    str += seg.descriptor + "<br />";

    if( seg.binding) {
        for( var i=0; i < seg.binding.length; ++i) {
            str += seg.binding[i].getHTML();
        }
    }

    $('#segmentField').get(0).innerHTML = str;
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

function getTextWidth(text : string, font : string) : number {
    var canvas = $("#canvas").get(0) as HTMLCanvasElement;
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
}