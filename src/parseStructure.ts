

/**
 * 
 */
class ParseStructure {
    segments : Segment[] = [];
}
class Segment {
    start : number;
    length : number;
    color : string;
    descriptor : string;
    binding : Binding[];
}
interface Binding {
    getHTML() : string;
}
class NilBinding implements Binding {
    html : string;
    constructor( html : string ) {
        this.html = html;
    }
    getHTML() { return this.html;}
}
class DataBinding extends NilBinding {
    start : number;
    length : number;
    constructor( html : string, start : number, length : number) {
        super(html);
        this.start = start;
        this.length = length;
    }
}
export {ParseStructure}
export {Segment}
export {Binding, NilBinding, DataBinding}