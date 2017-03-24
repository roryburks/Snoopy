import {BinaryReader} from "../binaryReader";
import {hexStr} from "../main";
import {hexByteStr, Uint8ToString} from "../util";
import {ParseStructure, Parser, Segment} from "../parsers/parseStructure";
import {Binding, DataBinding_, NilBinding, CellBinding} from "../parsers/parseStructure";

export class TXTParser extends Parser {

    
    parse() : ParseStructure {
        return null;
    }
}