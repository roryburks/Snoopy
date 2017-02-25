

export module ParseColors {
    export const header = "#a0a2de";

    export function rbgToString( rgb : number) : string{
        return "#"+rgb.toString(16);
    }
}