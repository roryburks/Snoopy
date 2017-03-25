import {DataLink} from "./parseStructure";

export module BinLinks {
    export abstract class BaseBinLink extends DataLink {
        seek : number;
        constructor( seek : number) {
            super();
            this.seek = seek;
        }
        getStartBitmask() : number {return 0xFF;}
        getEndBitmask() : number {return 0xFF;}
    }
    export class COPY_ME extends BaseBinLink {
        constructor( seek : number) {
            super( seek);
        }
        getValue(data : Uint8Array)  : string {return "" + this.get(data);}
        get( data : Uint8Array) : number {
            return data[this.seek];
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 1;}
    }

    export class ByteLink extends BaseBinLink {
        constructor( seek : number) {
            super( seek);
        }
        getValue(data : Uint8Array)  : string {return "" + this.get(data);}
        get( data : Uint8Array) : number {
            return data[this.seek];
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 1;}
    }
    export class UShortLink extends BaseBinLink {
        constructor( seek : number) {
            super( seek);
        }
        getValue(data : Uint8Array)  : string {return "" + this.get(data);}
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
    export class RGBLink extends BaseBinLink {
        constructor( seek : number) {
            super( seek);
        }
        getValue(data : Uint8Array)  : string {return "" + this.get(data);}
        get( data : Uint8Array) : number {
            return (data[this.seek] << 16 |
                data[this.seek+1] << 8 |
                data[this.seek+2]) >>> 0;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 3;}
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
    readUInt() : number {
        if( this.seeker + 4 > this.buffer.length)
            return undefined;
        var n = this.buffer[this.seeker] << 24 |
                this.buffer[this.seeker+1] << 16 |
                this.buffer[this.seeker+2] << 8 |
                this.buffer[this.seeker+3];
        this.seeker += 4;
        return n >>> 0;
    }

    readBytes( len : number) : Uint8Array {
        if( len <= 0) return null;
        if( len + this.seeker >= this.buffer.length) return null;

        var bytes = new Uint8Array(len);

        for( var i=0; i < len; ++i) {
            bytes[i] = this.buffer[this.seeker+i];
        }
        this.seeker += len;
        return bytes;
    }

    /** Reads a UTF8-encoded, null-terminated String starting at the current seek point. */
    readUTF8Str() : string {
        var bytes = [];//new Uint8Array();
        var i=0;
        
        while( this.buffer[this.seeker+i] !== 0) {
            bytes[i] = this.buffer[this.seeker+i];
            ++i;
        }
        this.seeker += i+1;
        
        var encodedString = String.fromCharCode.apply(null, new Uint8Array(bytes)),
            decodedString = decodeURIComponent(encodeURI(encodedString));
        return decodedString;
    }

    /** Reads a UTF8-encoded string from a fixed length of bytes.  */
    readUTF8StrLen( n :number) : string {
        var bytes = new Uint8Array(n);
        var i=0;
        
        for( var i =0; i<n; ++i) {
            bytes[i] = this.buffer[this.seeker+i];
        }
        this.seeker += n;
        
        var encodedString = String.fromCharCode.apply(null, new Uint8Array(bytes)),
            decodedString = decodeURIComponent(encodeURI(encodedString));
        return decodedString;
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

