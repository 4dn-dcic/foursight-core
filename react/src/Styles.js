// NOT YET IN IN WIDE USE
// Starting to experiment with setting styles dynamically based on Fourfront vs. CGAP styles.

import Image from './utils/Image';

// TODO
// const styles = getComputedStyle(document.documentElement)
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
const foursightFourfrontBoxColor                = "#09430C";
const foursightFourfrontBoxBackground           = "#DDFFEE";
const foursightFourfrontTitleBackgroundColor    = "#14533C";
const foursightCgapBoxColor                     = "#000066";
const foursightCgapBoxBackground                = "#DDEEFF";
const foursightCgapTitleBackgroundColor         = "#143C53";
const foursightSmahtBoxColor                    = "#221100";
const foursightSmahtBoxBackground               = "#FFEEDD";
const foursightSmahtTitleBackgroundColor        = "#553322";

function SetFoursightCgapStyles() {
    document.documentElement.style.setProperty("--box-fg", foursightCgapBoxColor);
    document.documentElement.style.setProperty("--box-bg", foursightCgapBoxBackground);
    document.documentElement.style.setProperty("--box-bg-lighten", LightenDarkenColor(foursightCgapBoxBackground, 20));
    document.documentElement.style.setProperty("--box-bg-darken", LightenDarkenColor(foursightCgapBoxBackground, -20));
    document.documentElement.style.setProperty("--title-bg", foursightCgapTitleBackgroundColor);
    let faviconElement = document.getElementById("favicon");
    if (faviconElement) {
        faviconElement.href = Image.FoursightCgapFavicon();
    }
}

function SetFoursightFourfrontStyles() {
    document.documentElement.style.setProperty("--box-fg", foursightFourfrontBoxColor);
    document.documentElement.style.setProperty("--box-bg", foursightFourfrontBoxBackground);
    document.documentElement.style.setProperty("--box-bg-lighten", LightenDarkenColor(foursightFourfrontBoxBackground, 20));
    document.documentElement.style.setProperty("--box-bg-darken", LightenDarkenColor(foursightFourfrontBoxBackground, -20));
    document.documentElement.style.setProperty("--title-bg", foursightFourfrontTitleBackgroundColor);
    let faviconElement = document.getElementById("favicon");
    if (faviconElement) {
        faviconElement.href = Image.FoursightFourfrontFavicon();
    }
}

function SetFoursightSmahtStyles() {
    document.documentElement.style.setProperty("--box-fg", foursightSmahtBoxColor);
    document.documentElement.style.setProperty("--box-bg", foursightSmahtBoxBackground);
    document.documentElement.style.setProperty("--box-bg-lighten", LightenDarkenColor(foursightSmahtBoxBackground, 20));
    document.documentElement.style.setProperty("--box-bg-darken", LightenDarkenColor(foursightSmahtBoxBackground, -20));
    document.documentElement.style.setProperty("--title-bg", foursightSmahtTitleBackgroundColor);
    let faviconElement = document.getElementById("favicon");
    if (faviconElement) {
        faviconElement.href = Image.FoursightSmahtFavicon();
    }
}

// Adapted from:
// https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
// Also:
// https://stackoverflow.com/questions/13375039/javascript-calculate-darker-colour
//
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

function GetForegroundColor() {
    return document.documentElement.style.getPropertyValue("--box-fg");
}

function GetBackgroundColor() {
    return document.documentElement.style.getPropertyValue("--box-bg");
}

function GetTitleBackgroundColor() {
    return document.documentElement.style.getPropertyValue("--title-bg");
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    SetFoursightCgap: SetFoursightCgapStyles,
    SetFoursightFourfront: SetFoursightFourfrontStyles, 
    SetFoursightSmaht: SetFoursightSmahtStyles, 
    GetForegroundColor: GetForegroundColor,
    GetBackgroundColor: GetBackgroundColor,
    GetTitleBackgroundColor: GetTitleBackgroundColor,
    LightenDarkenColor: LightenDarkenColor
};
export default Exports;
