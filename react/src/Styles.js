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
}

function SetFoursightCgapStyles() {
    document.documentElement.style.setProperty("--box-color", foursightCgapBoxColor);
    document.documentElement.style.setProperty("--box-background", foursightCgapBoxBackground);
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    SetFoursightFourfront: SetFoursightFourfrontStyles, 
    SetFoursightCgap: SetFoursightCgapStyles,
};
export default Exports;
