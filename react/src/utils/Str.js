// -------------------------------------------------------------------------------------------------
// Miscellaneous string related functions.
// -------------------------------------------------------------------------------------------------

function HasValue(value) {
    return value !== undefined && value !== null && value.constructor === String && value.length > 0;
}

function FormatBytes(bytes, decimals = 2) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0; for (i; bytes > 1024; i++) bytes /= 1024;
    return parseFloat(bytes.toFixed(decimals)) + ' ' + units[i];
}

function LongestCommonInitialSubstring(stringArray, f = null) {
    if (!Array.isArray(stringArray) || (stringArray.length <= 1)) {
		return "";
	}
    if (typeof f == 'function') {
        stringArray = stringArray.map(element => f(element));
    }
    const first = stringArray[0];
    let longest = "";
    for (let i = 0 ; i < first.length ; i++) {
      const c = first[i];
      for (let j = 1 ; j < stringArray.length ; j++) {
        if (stringArray[j][i] !== c) {
          return longest;
        }
      }
      longest += c;
    }
    return longest;
}

function StringArrayToCommaSeparatedListOfTitles(sa) {
    return sa?.map(s => s.replace(/\w\S*/g, (s) => s.charAt(0).toUpperCase() + s.substr(1).toLowerCase())).join(", ") || "";
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    HasValue: HasValue,
    FormatBytes: FormatBytes,
	LongestCommonInitialSubstring: LongestCommonInitialSubstring,
    StringArrayToCommaSeparatedListOfTitles: StringArrayToCommaSeparatedListOfTitles
}; export default exports;
