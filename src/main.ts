import {Segment, Parser} from "./parseStructure";
import {getFileExtension} from "./util";
import {UIManager} from "./uimanager";

var manager : UIManager = new UIManager();


function hello(compiler: string) {
    console.log(`Hello from ${compiler}`);
}
hello("TypeScript");

$("#btnStart").get(0).onclick = loadFile;

document.addEventListener("selectionchange",function() {
    var sel = document.getSelection();
    var r = sel.getRangeAt(0);
    
    console.log(sel.anchorOffset);
});

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
    filename : string;

    constructor( file:  File) {
        this.filename = file.name;
        this.fileReader = new FileReader();
        this.fileReader.onload = this.onLoad.bind(this);
        this.fileReader.readAsArrayBuffer( file);
    }

    onLoad( evt : ProgressEvent) {
        var array = this.fileReader.result as ArrayBuffer;
        var uArray = new Uint8Array(array, 0, array.byteLength);

        manager.assosciateData(uArray, this.filename);
    }
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
    if( uint < 127) 
        return _ascii[uint - 32];
    return " ";
};
export {asciiStr};
