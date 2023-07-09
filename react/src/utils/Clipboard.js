// -------------------------------------------------------------------------------------------------
// Clipboard related functions.
// -------------------------------------------------------------------------------------------------

import Str from './Str';

function CopyToClipboard(id) {
    if (Str.HasValue(id)) {
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

function CopyTextToClipboard(text) {
    navigator.clipboard.writeText(text);
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    Copy: CopyToClipboard,
    CopyText: CopyTextToClipboard
}; export default exports;
