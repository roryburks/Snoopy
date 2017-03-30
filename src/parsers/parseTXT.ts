import {BinaryReader} from "../binaryReader";
import {hexStr} from "../main";
import {hexByteStr, Uint8ToString} from "../util";
import {BinaryReaderLinker, BinLinks, SpecialLinks} from "./binReaderLinker";
import {ParseStructure, Parser, Segment, SegmentNode, UIComponent, UIComponents, DataLink}
     from "./parseStructure";

     
export class TXTParser extends Parser {
    parsed : ParseStructure;
    lread : BinaryReaderLinker;

    
    parse() : ParseStructure {
        this.parsed = new ParseStructure();
        this.lread = new BinaryReaderLinker(this.data);


        this.parsed.visualComp = {
            buildUI : function(data : Uint8Array) : string {
                        
                var str = "";
                for( var i=0; i < this.data.length; ++i) {
                    str += String.fromCharCode( this.data[i]);
                }
                return '<div class="plaintext">'+str+'</div>';
            }
        }

        return this.parsed;
    }
}