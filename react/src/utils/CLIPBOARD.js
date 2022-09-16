import UTIL from './UTIL';

function CopyToClipboard(id) {
    if (UTIL.IsNonEmptyString(id)) {
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

export default {
    Copy: CopyToClipboard
}
