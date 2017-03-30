import {DataLink, ValueUIComponent} from "./parseStructure";
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
        getValue(data : Uint8Array)  : any {return this.get(data);}
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
        
        changeValue( data : Uint8Array, val : any) : void{
            var n = val as number;
            data[this.seek] =n & 0xFF;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 1;}
        uiComp : ValueUIComponent = ValueUIComponents.getByteNE();
    }
    export class UShortLink extends NumberLink {
        get( data : Uint8Array) : number {
            return data[this.seek] << 8 |
                data[this.seek+1];
        }
        changeValue( data : Uint8Array, val : any) : void{
            var n = val as number;
            data[this.seek] = (n>>>8) & 0xFF;
            data[this.seek+1] =n & 0xFF;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 2;}
        uiComp : ValueUIComponent = ValueUIComponents.getUShortNE();
    }
    export class UShortLELink extends UShortLink {
        get( data : Uint8Array) : number {
            return data[this.seek+1] << 8 |
                data[this.seek];
        }
        changeValue( data : Uint8Array, val : any) : void{
            var n = val as number;
            data[this.seek+1] = (n>>>8) & 0xFF;
            data[this.seek] =n & 0xFF;
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
        changeValue( data : Uint8Array, val : any) : void{
            var n = val as number;
            data[this.seek] = (n>>>16) & 0xFF;
            data[this.seek+1] = (n>>>8) & 0xFF;
            data[this.seek+2] =n & 0xFF;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 3;}
        uiComp : ValueUIComponent = ValueUIComponents.getColorPickerUI();
    }
    export class UIntLink extends NumberLink {
        get( data : Uint8Array) : number {
            return (data[this.seek] << 24 |
                data[this.seek+1] << 16 |
                data[this.seek+2] << 8 |
                data[this.seek+3]) >>> 0;
        }
        changeValue( data : Uint8Array, val : any) : void{
            var n = val as number;
            data[this.seek] = (n>>>24) & 0xFF;
            data[this.seek+1] = (n>>>16) & 0xFF;
            data[this.seek+2] = (n>>>8) & 0xFF;
            data[this.seek+3] =n & 0xFF;
        }
        getStartByte() : number {return this.seek;}
        getLength() : number {return 4;}
        uiComp : ValueUIComponent = ValueUIComponents.getUIntNE();
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
        getValue(data : Uint8Array)  : any { return this.get(data);}
        changeValue( data : Uint8Array, val : any) : void{this.context.set(data, this.index, val);}
        
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
        set( data : Uint8Array, index : number, val : any) {
            if( isNaN(val))return;
            var n = (val as number);
            var s = index * this.bytelen + this.seek;

            for( var i=0; i<this.bytelen; ++i) {
                if( this.littleEndian) 
                    data[s + i] = (n >>> (8*i))&0xFF;
                else 
                    data[s + i] = (n >> (8*(this.bytelen-i-1)))&0xFF;
            }

            console.log("set");
        }

        getVLength() : number { return this.length;}
        getValue(data : Uint8Array)  : string {return "Packed Data";}
        getStartByte() : number {return this.seek;}
        getLength() : number {return this.length * this.bytelen;}
        getStartBitmask() : number {return 0xFF;}
        getEndBitmask() : number {return 0xFF;}
    }

}

class WrapLink extends DataLink {
    base : DataLink;
    constructor( base : DataLink) {
        super();
        this.base = base;
    }
    getValue(data : Uint8Array)  : any {return this.base.getValue(data);}
    getStartByte() : number {return this.base.getStartByte();}
    getStartBitmask() : number {return this.base.getStartBitmask();}
    getLength() : number {return this.base.getLength();}
    getEndBitmask() : number {return this.base.getEndBitmask();}
    changeValue( data : Uint8Array, val : any) : void{ this.base.changeValue(data, val);}
}
export module ValueUIComponents {
    
    class ColorPickerVUIC implements ValueUIComponent
    {
        colorPicker : HTMLInputElement;
        buildUI() : HTMLElement {
            var ele = document.createElement('div');
            ele.innerHTML = '<input type="color" id="htcp""></input>';
            this.colorPicker = $(ele).find("#htcp").get(0) as HTMLInputElement;
            return ele;
        }
        updateUI(value:any) {
            var hexStr = (value as number).toString(16);
            while( hexStr.length < 6) hexStr = "0" + hexStr;
            $(this.colorPicker).val("#"+hexStr);
        }
        getUIValue() :any {
            return parseInt(($(this.colorPicker).val() as string).substr(1), 16);
        }
    }
    var defColPick = new ColorPickerVUIC();
    export function getColorPickerUI() : ColorPickerVUIC {return defColPick;}
    
    class BoolVUIC implements ValueUIComponent
    {
        checker : HTMLInputElement;
        buildUI() : HTMLElement {
            var ele = document.createElement('div');
            ele.innerHTML = '<input type="checkbox"></input>';
            this.checker = $(ele).find("input").get(0) as HTMLInputElement;
            return ele;
        }
        updateUI(value:any) {
            this.checker.checked = !!value;
        }
        getUIValue() :any {
            
            return this.checker.checked;
        }
    }
    var defBoolUIC = new BoolVUIC();
    export function getBoolUI() : BoolVUIC {return defBoolUIC;}

    // ==================
    // ==== Plain Number Editors
    export class NumberEditorVUIC implements ValueUIComponent
    {
        editor : HTMLInputElement;
        min : number;
        max: number;
        constructor( min: number, max: number) {
            this.max = max;
            this.min = min;
        }
        buildUI() : HTMLElement {
            var ele = document.createElement('div');
            ele.innerHTML = '<input type="number" min="'+this.min+'" max="'+this.max+'">'
            this.editor = $(ele).find("input").get(0) as HTMLInputElement;
            return ele;
        }
        updateUI(value:any) {
            console.log(value);
            this.editor.value = value;
        }
        getUIValue() :any {
            return this.editor.value;
        }
    }
    var partialNE : NumberEditorVUIC[] = new Array(8);
    for( var i=0; i<8; ++i) {
        partialNE[i] = new NumberEditorVUIC(0, (1 << i)-1);
    }
    var byteNE = new NumberEditorVUIC(0, 255);
    var ushortNE = new NumberEditorVUIC(0, 65535);
    var uintNE = new NumberEditorVUIC(0, 4294967295);
    export function getPartialNE( i : number) : NumberEditorVUIC {return partialNE[i];}
    export function getByteNE() : NumberEditorVUIC {return byteNE;}
    export function getUShortNE() : NumberEditorVUIC {return ushortNE;}
    export function getUIntNE() : NumberEditorVUIC {return uintNE;}

    // =================
    // ==== Special UI ValueUIComponents
    export class EnumVUIC implements ValueUIComponent
    {
        option : HTMLSelectElement;
        map : {[key:string]:string};
        constructor( map : {[key:string]:string}){
            this.map = map;
        } 
        buildUI() : HTMLElement {
            var ele = document.createElement('div');

            var str = '<select>';
            for( var key in this.map) {
                str += '<option value="'+key+'">'+this.map[key]+'</option>';
            }
            str += '</select>'
            ele.innerHTML = str;
            this.option = $(ele).find("select").get(0) as HTMLSelectElement;
            return ele;
        }
        updateUI(value:any) : void {
            var i =0;
            for( var key in this.map) {
                if( key == value) {
                    this.option.selectedIndex = i;
                }
                ++i;
            }
        }
        getUIValue() : any {
            var i =0;
            for( var key in this.map) {
                if( i ==  this.option.selectedIndex) {
                    return key;
                }
                ++i;
            }
            return undefined;
        }
    }
    
//        
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

            this.uiComp = new ValueUIComponents.EnumVUIC(this.map);
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
        changeValue( data : Uint8Array, val : any) : void{
            this.base.changeValue(data, val*this.factor);
        }
        getValue(data : Uint8Array)  : any { return this.get(data);}
        getStartByte() : number { return this.base.getStartByte();}
        getStartBitmask() : number { return this.base.getStartBitmask();}
        getLength() : number { return this.base.getLength();}
        getEndBitmask() : number { return this.base.getEndBitmask();}
        uiComp = ValueUIComponents.getUIntNE();
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
            this.uiComp = ValueUIComponents.getPartialNE(len);
        }
        
        get( data: Uint8Array) : number {
            return (this.base.get(data) >>> this.offset) & ((1 << this.len) - 1);
        }
        changeValue( data : Uint8Array, val : any) : void{
            var bitmask = ((1 << this.len) - 1) << this.offset;
            var demaskedByte = this.base.getValue(data) & (~bitmask);
            var maskedVal = (val & ((1 << this.len)-1)) << this.offset;
            this.base.changeValue( data, maskedVal | demaskedByte );
        }
        getValue(data : Uint8Array)  : any { return this.get(data);}
        getStartByte() : number { return this.base.getStartByte();}
        getStartBitmask() : number { return ((1 << this.len) -1)<<this.offset;}
        getLength() : number { return this.base.getLength();}
        getEndBitmask() : number { return this.getStartBitmask();}
    }
    export class BitLink extends DataLink {
        base : BinLinks.ByteLink;
        offset : number;
        constructor( base : BinLinks.ByteLink, offset : number) {
            super();
            this.base = base;
            this.offset = offset;
        }
        
        get( data: Uint8Array) : boolean {
            return ((this.base.get(data) >>> this.offset) & 0x1) != 0;
        }
        changeValue( data : Uint8Array, val : any) : void{
            var demaskedByte = this.base.getValue(data) & (~(1 << this.offset));
            var maskedVal = (val)? (1 << this.offset) : 0;
            this.base.changeValue( data, maskedVal | demaskedByte );
        }
        getValue(data : Uint8Array)  : any { return this.get(data);}
        getStartByte() : number { return this.base.getStartByte();}
        getStartBitmask() : number { return 1 << this.offset;}
        getLength() : number { return this.base.getLength();}
        getEndBitmask() : number { return 1 << this.offset;}
        uiComp : ValueUIComponent = ValueUIComponents.getBoolUI();
    }
    
    export class NullDataLink extends DataLink {
        seek: number;
        length: number;
        constructor( seek : number, length: number) {
            super();
            this.seek = seek;
            this.length = length;

        }
        getValue(data : Uint8Array)  : any {return undefined;}
        getStartByte() : number {return this.seek;}
        getLength() : number {return this.length;}
        getStartBitmask() : number {return 0xFF;}
        getEndBitmask() : number {return 0xFF;}
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

