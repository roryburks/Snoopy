

export function getFileExtension( name : string) : string {
    return /(?:\.([^.]+))?$/.exec(name)[1];
}

export function randcolor() : string {
    return "rgb(" + Math.floor(Math.random()*255) 
        + "," + Math.floor(Math.random()*255) + "," 
        + Math.floor(Math.random()*255) + ")"
}