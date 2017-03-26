import {DataLink} from "./parseStructure";
import {ParseColors} from "./colors";

/**
 * This contains all the basic Data Links for converting common types
 * (int, short, UTF8 Stirngs, etc) from Data to their respective values.
 */
export module BinLinks {
    export abstract class BaseBinLink extends DataLink {
        seek : number;
        constructor( seek : number) {
            super();
            this.seek = seek;
        }
        getValue(data : Uint8Array)  : string {return "" + this.get(data);}
        getStartBitmask() : number {return 0xFF;}
        getEndBitmask() : number {return 0xFF;}
        get(data : Uint8Array) : any {return undefined;}
    }
    export class COPY_ME extends BaseBinLink {
        get( data : Uint8Array) : number {
            return data[this.seek];
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 1;}
    }

    export abstract class NumberLink extends BaseBinLink {
        abstract get(data : Uint8Array) : number;
    }

    export class ByteLink extends NumberLink {
        get( data : Uint8Array) : number {
            return data[this.seek];
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 1;}
    }
    export class UShortLink extends NumberLink {
        get( data : Uint8Array) : number {
            return data[this.seek] << 8 |
                data[this.seek+1];
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 2;}
    }
    export class UShortLELink extends UShortLink {
        get( data : Uint8Array) : number {
            return data[this.seek+1] << 8 |
                data[this.seek];
        }
    }
    export class RGBLink extends NumberLink {
        getValue( data : Uint8Array) : string {
            return ParseColors.rgbToString( this.get(data));
        }
        get( data : Uint8Array) : number {
            return (data[this.seek] << 16 |
                data[this.seek+1] << 8 |
                data[this.seek+2]) >>> 0;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 3;}
    }
    export class UIntLink extends NumberLink {
        get( data : Uint8Array) : number {
            return (data[this.seek] << 24 |
                data[this.seek+1] << 16 |
                data[this.seek+2] << 8 |
                data[this.seek+3]) >>> 0;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 4;}
    }
    export class BytesLink extends BaseBinLink {
        length : number;
        constructor( seek : number, length: number) {
            super(seek);
            this.length = length;
        }
        get( data : Uint8Array) : Uint8Array {
            var bytes = new Uint8Array(this.length);

            for( var i=0; i < this.length; ++i) 
                bytes[i] = data[this.seek+i];

            return bytes;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return this.length;}
    }
    export class UTF8StrLink extends BaseBinLink {
        length : number;
        nt: boolean;
        constructor( seek : number, length: number, nullTerminated : boolean) {
            super(seek);
            this.length = length;
            this.nt = nullTerminated;
        }
        get( data : Uint8Array) : string {
            var n = (this.nt)?this.length-1:this.length;
            var bytes = new Uint8Array(n);

            for( var i=0; i < n; ++i) 
                bytes[i] = data[this.seek+i];
            
            var encodedString = String.fromCharCode.apply(null, new Uint8Array(bytes)),
                decodedString = decodeURIComponent(encodeURI(encodedString));
            return decodedString;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return this.length;}
    }

    class PNSubLink extends DataLink {
        context: PackedNumberLink;
        index : number;

        constructor( context: PackedNumberLink, index : number) {
            super();
            this.context = context;
            this.index = index;
        }
        
        get( data : Uint8Array) : number {return this.context.get(data, this.index);}
        getValue(data : Uint8Array)  : string { return "" + this.get(data);}
        
        getStartByte() : number {return this.context.seek + this.index*this.context.bytelen;}
        getLength() : number {return this.context.bytelen;}
        getStartBitmask() : number {return 0xFF;}
        getEndBitmask() : number {return 0xFF;}
    }
    export class PackedNumberLink extends DataLink {
        seek : number;
        length : number;
        bytelen : number
        littleEndian : boolean;
        constructor( seek : number, length : number, bytelen : number, littleEndian : boolean) 
        {
            super();
            this.seek = seek;
            this.length = length;
            this.bytelen = bytelen;
            this.littleEndian = littleEndian;
        }

        subLink( index : number) : DataLink {return new PNSubLink(this, index);}

        get(data : Uint8Array, index : number) : number {
            var n = 0;
            var s = index * this.bytelen + this.seek;

            for( var i=0; i<this.bytelen; ++i) {
                if( this.littleEndian) {
                    n |= data[s+i] << (8*i);
                }
                else {
                    n <<= 8;
                    n |= data[s+i];
                }
            }
            return n;
        }

        getVLength() : number { return this.length;}
        getValue(data : Uint8Array)  : string {return "Packed Data";}
        getStartByte() : number {return this.seek;}
        getLength() : number {return this.length * this.bytelen;}
        getStartBitmask() : number {return 0xFF;}
        getEndBitmask() : number {return 0xFF;}

    }
}

/**
 * This module contains special 
 */
export module SpecialLinks {

    /** An EnumLink is a type of data link designed for data which has a set number
     * of options, each mapped to a certain value.     */
    export class EnumLink extends DataLink {
        base : DataLink;
        map : {[key:string]:string};
        def : string;
        constructor( base : DataLink, map : {[key:string]:string},  def? : string) {
            super();
            this.base = base;
            this.map = map;
            this.def = def;
        }

        getValue(data : Uint8Array)  : string {
            var val = this.base.getValue(data);
            var str = this.map[val];

            if( str == undefined) return this.def + " ("+val+")";
            return str + " ("+val+")";
        }
        getStartByte() : number { return this.base.getStartByte();}
        getStartBitmask() : number { return this.base.getStartBitmask();}
        getLength() : number { return this.base.getLength();}
        getEndBitmask() : number { return this.base.getEndBitmask();}
    }

    /** A FactorLink is a type of link designed for data which is stored at a certain
     * rational factor from its intended use.  For example, data might be stored as 
     * 1000 * val so that three decimal places can be preserved.
     */
    export class FactorLink extends DataLink {
        base : BinLinks.NumberLink;
        factor : number;
        constructor( base : BinLinks.NumberLink, factor : number) {
            super();
            this.base = base;
            this.factor = factor;
        }
        
        get( data: Uint8Array) : number {
            return this.base.get(data) / this.factor;
        }
        getValue(data : Uint8Array)  : string { return "" + this.get(data);}
        getStartByte() : number { return this.base.getStartByte();}
        getStartBitmask() : number { return this.base.getStartBitmask();}
        getLength() : number { return this.base.getLength();}
        getEndBitmask() : number { return this.base.getEndBitmask();}
    }

    /** A PartialByteLink is a type of link designed for data which is packed in 
     * bit-lengths smaller than a byte (but still all in one byte).
     */
    export class PartialByteLink extends DataLink {
        base : BinLinks.ByteLink;
        offset : number;
        len : number
        constructor( base : BinLinks.ByteLink, offset : number, len: number) {
            super();
            this.base = base;
            this.offset = offset;
            this.len = len;
        }
        
        get( data: Uint8Array) : number {
            return (this.base.get(data) >>> this.offset) & ((1 << this.len) - 1);
        }
        getValue(data : Uint8Array)  : string { return "" + this.get(data);}
        getStartByte() : number { return this.base.getStartByte();}
        getStartBitmask() : number { return this.base.getStartBitmask();}
        getLength() : number { return this.base.getLength();}
        getEndBitmask() : number { return this.base.getEndBitmask();}
    }
}

export class BinaryReaderLinker {
    buffer : Uint8Array;
    private seeker : number = 0;

    constructor( buffer : Uint8Array) {
        this.buffer = buffer;
        this.seeker = 0;
    }

    getLength() : number {
        return this.buffer.byteLength;
    }

    readByte() : BinLinks.ByteLink {
        if( this.seeker >= this.buffer.length)
            return undefined;
        
        return new BinLinks.ByteLink(this.seeker++);
    }
    peekByte() : BinLinks.ByteLink {
        if( this.seeker >= this.buffer.length)
            return undefined;
        
        return new BinLinks.ByteLink(this.seeker);
    }
    readUShort() : BinLinks.UShortLink {
        if( this.seeker + 1 >= this.buffer.length)
            return undefined;
        this.seeker += 2;
        return new BinLinks.UShortLink(this.seeker-2);
    }
    readUShortLE() : BinLinks.UShortLELink {
        if( this.seeker + 1 >= this.buffer.length)
            return undefined;
        this.seeker += 2;
        return new BinLinks.UShortLELink(this.seeker-2);
    }
    /** Reads 3 bytes as an int32 packed as RGB; essentially readUint24 */
    readRGB() : BinLinks.RGBLink {
        if( this.seeker + 3 > this.buffer.length)
            return undefined;
        this.seeker += 3;
        return new BinLinks.RGBLink(this.seeker-3);
    }
    readUInt() : BinLinks.UIntLink {
        if( this.seeker + 4 > this.buffer.length)
            return undefined;
        this.seeker += 4;
        return  new BinLinks.UIntLink(this.seeker-4);
    }

    readBytes( len : number) : BinLinks.BytesLink {
        if( len <= 0) return null;
        if( len + this.seeker >= this.buffer.length) return null;
        this.seeker += len;
        return new BinLinks.BytesLink(this.seeker-len, len);
    }

    /** Reads a UTF8-encoded, null-terminated String starting at the current seek point. */
    readUTF8Str() : BinLinks.UTF8StrLink {
        var bytes = [];//new Uint8Array();
        var i=0;
        
        while( this.buffer[this.seeker+i] !== 0) {
            bytes[i] = this.buffer[this.seeker+i];
            ++i;
        }
        this.seeker += i+1;
        
        return new BinLinks.UTF8StrLink( this.seeker - (i+1), i+1, true);
    }

    /** Reads a UTF8-encoded string from a fixed length of bytes.  */
    readUTF8StrLen( n :number) : BinLinks.UTF8StrLink {
        this.seeker += n;
        return new BinLinks.UTF8StrLink(this.seeker-n, n, false);
    }
    
    readPacked( count: number,  bytelen: number,littleEndian: boolean) {
        var l = bytelen*count;
        this.seeker += l;
        return new BinLinks.PackedNumberLink( this.seeker-l, count, bytelen, littleEndian);
    }

    getSeek() : number { return this.seeker;}
    setSeek(n : number) { 
        if( n <= 0) 
            this.seeker = 0;
        else if( n >= this.buffer.length)
            this.seeker = this.buffer.length;
        else 
            this.seeker = n;
    }
    eof() : boolean {
        return( this.seeker >= this.buffer.length);
    }
}

