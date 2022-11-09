// Styles ...

// TODO
// NOT IN USE YET
// Starting to experiment with setting styles dynamically based on Fourfront vs. CGAP styles.

const styles                          = getComputedStyle(document.documentElement)
// TODO
// For some reason reading these values, when NOT running in cross-origin local mode (UI on 3000 and API on 8000),
// get garbled from the getPropertyValue calls below. Hardcode them for now ....
// --foursight-fourfront-box-bg:#DDFFEE;
// --foursight-fourfront-box-fg:#09430C;
// --foursight-cgap-box-bg:#DDEEFF;
// --foursight-cgap-box-fg:#000069;
// const foursightFourfrontBoxColor      = styles.getPropertyValue("--foursight-fourfront-box-fg");
// const foursightFourfrontBoxBackground = styles.getPropertyValue("--foursight-fourfront-box-bg");
// const foursightCgapBoxColor           = styles.getPropertyValue("--foursight-cgap-box-fg");
// const foursightCgapBoxBackground      = styles.getPropertyValue("--foursight-cgap-box-bg");
const foursightFourfrontBoxColor      = "#09430C";
const foursightFourfrontBoxBackground = "#DDFFEE";
const foursightCgapBoxColor           = "#000069";
const foursightCgapBoxBackground      = "#DDEEFF";

function SetFoursightFourfrontStyles() {
    document.documentElement.style.setProperty("--box-fg", foursightFourfrontBoxColor);
    document.documentElement.style.setProperty("--box-bg", foursightFourfrontBoxBackground);
    document.documentElement.style.setProperty("--box-bg-lighten", LightenDarkenColor(foursightFourfrontBoxBackground, 20));
    document.documentElement.style.setProperty("--box-bg-darken", LightenDarkenColor(foursightFourfrontBoxBackground, -20));
}

function SetFoursightCgapStyles() {
    document.documentElement.style.setProperty("--box-fg", foursightCgapBoxColor);
    document.documentElement.style.setProperty("--box-bg", foursightCgapBoxBackground);
    document.documentElement.style.setProperty("--box-bg-lighten", LightenDarkenColor(foursightCgapBoxBackground, 20));
    document.documentElement.style.setProperty("--box-bg-darken", LightenDarkenColor(foursightCgapBoxBackground, -20));
}

// Adapted from:
// https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
// Also:
// https://stackoverflow.com/questions/13375039/javascript-calculate-darker-colour
//
function oldLightenDarkenColor(col, amt) {
    col = col.trim()
    var usePound = false;
    if (col[0] === "#") {
        col = col.slice(1);
        usePound = true;
    }
    var num = parseInt(col,16);
    var r = (num >> 16) + amt;
    if (r > 255) r = 255;
    else if  (r < 0) r = 0;
    var b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255;
    else if  (b < 0) b = 0;
    var g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    col = (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
    return col;
}
function LightenDarkenColor(hexColor, magnitude) {
    hexColor = hexColor.trim()
    hexColor = hexColor.replace(`#`, ``);
    if (hexColor.length === 6) {
        const decimalColor = parseInt(hexColor, 16);
        let r = (decimalColor >> 16) + magnitude;
        r > 255 && (r = 255);
        r < 0 && (r = 0);
        let g = (decimalColor & 0x0000ff) + magnitude;
        g > 255 && (g = 255);
        g < 0 && (g = 0);
        let b = ((decimalColor >> 8) & 0x00ff) + magnitude;
        b > 255 && (b = 255);
        b < 0 && (b = 0);
        hexColor = `#${(g | (b << 8) | (r << 16)).toString(16)}`;
        return hexColor;
    } else {
        return hexColor;
    }
};

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    SetFoursightFourfront: SetFoursightFourfrontStyles, 
    SetFoursightCgap: SetFoursightCgapStyles,
};
export default Exports;
