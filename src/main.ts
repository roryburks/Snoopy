import {Segment, Parser} from "./parsers/parseStructure";
import {getFileExtension} from "./util";
import {UIManager} from "./ui/uimanager";

var manager : UIManager = new UIManager();

$("#btnStart").get(0).onclick = loadFile;

document.addEventListener("selectionchange",function() {
    var sel = document.getSelection();
    var r = sel.getRangeAt(0);
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
function asciiStr( uint : number) : string {
    if( uint < 32) return " ";
    if( uint < 127) 
        return _ascii[uint - 32];
    return " ";
};
export {asciiStr};


/** ===== DEBUG TESTING ==== */


// Dynamic typing at its "finest"
class A {
    num : number;
    disp() { console.log(this.num);}
}
class B {
    num : number;
    disp() { console.log(this.num*2);}
}

var a: A = new A();
a.num = 1;
a.disp = B.prototype.disp;
a.disp();