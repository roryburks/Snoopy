import {BinaryReader} from "../binaryReader";

/**
 * 
 */
export class Bound {
    start : number;
    len : number;
}

export abstract class Parser {
    reader : BinaryReader;

    constructor( buffer : Uint8Array) {
        this.reader = new BinaryReader(buffer);
    }
    abstract parse() : ParseStructure;
}
export class ParseStructure {
    segments : Segment[] = [];
}
export class Segment {
    start : number;
    length : number;
    color : string;
    descriptor : string;
    binding : Binding[];
}
export interface Binding {
    binding : Bound;
    getHTML() : string;
}
export class NilBinding implements Binding {
    binding : Bound = null;
    html : string;
    constructor( html : string ) {
        this.html = html;
    }
    getHTML() { return this.html;}
}
export class DataBinding implements Binding {
    binding : Bound;
    html : string;
    constructor( html : string, start : number, length : number) {
        this.html = html;
        this.binding = {start:start, len:length};
    }
    getHTML() { 
        return this.html;
    }
}

/** A Cell Binding is a specific Binding for <td> cells to tell the Segment UI constructor
 * it has to wrap them.  Because HTML renderers are terrible at rendering something as simple 
 * as a grid.
 */
export class CellBinding extends DataBinding{}