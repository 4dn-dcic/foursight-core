// Styles ...

// TODO
// NOT IN USE YET
// Starting to experiment with setting styles dynamically based on Fourfront vs. CGAP styles.

const styles                          = getComputedStyle(document.documentElement)
const foursightFourfrontBoxColor      = styles.getPropertyValue("--foursight-fourfront-box-color");
const foursightFourfrontBoxBackground = styles.getPropertyValue("--foursight-fourfront-box-background");
const foursightCgapBoxColor           = styles.getPropertyValue("--foursight-cgap-box-color");
const foursightCgapBoxBackground      = styles.getPropertyValue("--foursight-cgap-box-background");

function SetFoursightFourfrontStyles() {
    document.documentElement.style.setProperty("--box-color", foursightFourfrontBoxColor);
    document.documentElement.style.setProperty("--box-background", foursightFourfrontBoxBackground);
    document.documentElement.style.setProperty("--box-background-lighten", LightenDarkenColor(foursightFourfrontBoxBackground, 20));
    document.documentElement.style.setProperty("--box-background-darken", LightenDarkenColor(foursightFourfrontBoxBackground, -20));
}

function SetFoursightCgapStyles() {
    document.documentElement.style.setProperty("--box-color", foursightCgapBoxColor);
    document.documentElement.style.setProperty("--box-background", foursightCgapBoxBackground);
    document.documentElement.style.setProperty("--box-background-lighten", LightenDarkenColor(foursightCgapBoxBackground, 20));
    document.documentElement.style.setProperty("--box-background-darken", LightenDarkenColor(foursightCgapBoxBackground, -20));
}

// Adapted from:
// https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
//
function LightenDarkenColor(col, amt) {
    col = col.trim()
    var usePound = false;
    if (col[0] == "#") {
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
    return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    SetFoursightFourfront: SetFoursightFourfrontStyles, 
    SetFoursightCgap: SetFoursightCgapStyles,
};
export default Exports;
