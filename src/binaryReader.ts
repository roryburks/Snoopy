

class BinaryReader {
    private buffer : Uint8Array;
    private seeker : number = 0;

    constructor( buffer : Uint8Array) {
        this.buffer = buffer;
        this.seeker = 0;
    }

    readByte() : number {
        if( this.seeker >= this.buffer.length)
            return undefined;
        
        return this.buffer[this.seeker++];
    }
    peekByte() : number {
        if( this.seeker >= this.buffer.length)
            return undefined;
        
        return this.buffer[this.seeker];
    }
    readUShort() : number {
        if( this.seeker + 1 >= this.buffer.length)
            return undefined;
        var n = this.buffer[this.seeker] << 8 |
                this.buffer[this.seeker+1];

        this.seeker += 2;
        return n;
    }
    readUShortLE() : number {
        if( this.seeker + 1 >= this.buffer.length)
            return undefined;
        var n = this.buffer[this.seeker+1] << 8 |
                this.buffer[this.seeker];

        this.seeker += 2;
        return n;
    }
    /** Reads 3 bytes as an int32 packed as RGB; essentially readUint24 */
    readRGB() : number {
        if( this.seeker + 3 > this.buffer.length)
            return undefined;
        var n = this.buffer[this.seeker] << 16 |
                this.buffer[this.seeker+1] << 8 |
                this.buffer[this.seeker+2];
        this.seeker += 3;
        return n >>> 0;
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


class BitSeeker {
    bitseek = 0;
    byte : number;
    reader : BinaryReader;

    constructor( reader : BinaryReader) {
        this.reader = reader;
    }
    
    /** Reads up to 32 bits from the stream, memorizing the bit-counter for subsequent
     * readBits attempts.
     * 
     * NOTE: when done reading bits you should clear the bitcounter with clipBits otherwise
     * it will not properly align.  Other read functions will NOT honor the bitcounter.
    */
    readBits( n : number) : number {
        var r = 0;


        if( !this.byte) 
            this.byte = this.getNextByte();

        while( n + this.bitseek >= 8) {
            var bits = 8 - this.bitseek;
            r = (r << bits) | (this.byte >> this.bitseek);
            n -= bits;
            this.bitseek = 0;
            this.byte = this.getNextByte();
        }

        if( n + this.bitseek < 8) {
            bits = n;
            r = (r << n) | (this.byte >> this.bitseek);
            this.bitseek += n;
        }

        return r;
    }
    private getNextByte() : number {
        var n = this.reader.readByte();

        if( n == 0xFF) {
            if( this.reader.peekByte() != 0xFF) {
                console.log( "Unpacked 0xFF outside of data section.")
            }
            else {
                this.reader.readByte();
            }
        }

        return n;
    }
}
export {BinaryReader, BitSeeker};
