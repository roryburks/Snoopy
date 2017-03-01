

export module ParseColors {
    export const header = "#a0a2de";
    export const palette = "#44AA44";
    export const marker = "#22AAAA";
    export const data = "#5555AA";
    export const _data = 0x5555AA;

    var seed : {[key:number]: number} = {};

    /** Defines a color that cycles through similar colors based on the given color
     *  (same hue, slightly different Saturation/Value).  
     * Pass it the packed RGB (e.g. if you had a hex color of* "#0ABC0A", you would 
     *  pass it the number 0x0ABC0A). */
    export function cyclingColor( rgb : number) : string{
        if( seed[rgb] == undefined) seed[rgb] = 0;
        var t = (seed[rgb]++ % 5 / 5);
        var hsv = RGBtoHSV( (rgb >> 16) & 0xFF, (rgb>>8)&0xFF, rgb&0xFF);
        var smin = 0.6*(hsv.s);
        var vmin = 0.6*(hsv.v);
        var smax = (1 - hsv.s) * 0.4 + hsv.s;
        var vmax = (1 - hsv.v) * 0.4 + hsv.v;
        hsv.s = smin + (smax - smin) * t;
        hsv.v = vmin + (vmax - vmin) * t;
        return rgbToString( RGBtoInt(HSVtoRGB( hsv.h, hsv.s, hsv.v)));
    }

    export function rgbToString( rgb : number) : string{
        var str = rgb.toString(16);
        if( str.length > 6)
            str = str.substr( 0, 6);
        while( str.length < 6)
            str = "0" + str; 
        return "#"+str;
    }

    export function RGBtoInt( rgb : RGB) : number {
        return (rgb.r << 16 | rgb.g << 8 | rgb.b) >>> 0;
    }
    export interface RGB { r : number, g: number, b: number};
    export interface HSV { h : number, s: number, v: number};
    export function RGBtoHSV(r : number, g : number, b : number) : HSV {

        var max = Math.max(r, g, b), min = Math.min(r, g, b),
            d = max - min,
            h,
            s = (max === 0 ? 0 : d / max),
            v = max / 255;

        switch (max) {
            case min: h = 0; break;
            case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
            case g: h = (b - r) + d * 2; h /= 6 * d; break;
            case b: h = (r - g) + d * 4; h /= 6 * d; break;
        }

        return {
            h: h,
            s: s,
            v: v
        };
    }

    export function HSVtoRGB(h : number, s:number, v:number) : RGB{
        var r, g, b, i, f, p, q, t;

        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
}