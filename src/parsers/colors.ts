

export module ParseColors {
    export const header = "#a0a2de";

    export function rbgToString( rgb : number) : string{
        var str = rgb.toString(16);
        if( str.length > 6)
            str = str.substr( 0, 6);
        while( str.length < 6)
            str = "0" + str; 
        return "#"+str;
    }
}