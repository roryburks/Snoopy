

class BinaryReader {
    private buffer : Uint8Array;
    private seeker : number = 0;

    constructor( buffer : Uint8Array) {
        this.buffer = buffer;
        this.seeker = 0;
    }

    readByte() : number {
        if( this.seeker >= this.buffer.length)
            return -1;
        
        return this.buffer[this.seeker++];
    }
    readUShort() : number {
        if( this.seeker + 1 >= this.buffer.length)
            return -1;
        var n = this.buffer[this.seeker] << 8 |
                this.buffer[this.seeker+1];

        this.seeker += 2;
        return n;
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
export {BinaryReader};