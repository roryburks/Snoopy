import {BinaryReader} from "../binaryReader";

/**
 * 
 */
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
    getHTML() : string;
}
export class NilBinding implements Binding {
    html : string;
    constructor( html : string ) {
        this.html = html;
    }
    getHTML() { return this.html;}
}
export class DataBinding extends NilBinding {
    start : number;
    length : number;
    constructor( html : string, start : number, length : number) {
        super(html);
        this.start = start;
        this.length = length;
    }
}