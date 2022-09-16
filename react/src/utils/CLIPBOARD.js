import STR from './STR';

function CopyToClipboard(id) {
    if (STR.HasValue(id)) {
        const range = document.createRange();
        if (range) {
            const element = document.getElementById(id);
            if (element) {
                range.selectNode(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('copy');
                selection.removeAllRanges();
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    Copy: CopyToClipboard
}
