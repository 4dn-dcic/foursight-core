// -------------------------------------------------------------------------------------------------
// Image locations functions.
// -------------------------------------------------------------------------------------------------

function GetClipboardImage() {
    return "https://cdn.iconscout.com/icon/premium/png-256-thumb/document-1767412-1505234.png";
}

function GetLockImage() {
    return "https://raw.githubusercontent.com/dmichaels/public/master/img/lock.f70cb2627ad278feb47e.jpg";
}

function GetUnlockImage() {
    return "https://raw.githubusercontent.com/dmichaels/public/master/img/unlock.a39edec5f19bde275fe6.jpg";
}

function GetHistoryImage() {
    return "https://cdn-icons-png.flaticon.com/512/32/32223.png";
}

function GetPyPiImage() {
    return "https://cdn-images-1.medium.com/max/1064/1*8Zh-mzLnVMDsbvXdKsU4lw.png";
}

function GetPythonImage() {
    return "https://logos-download.com/wp-content/uploads/2016/10/Python_logo_wordmark.png";
}

function GetGitHubImage() {
    return "https://git-scm.com/images/logos/downloads/Git-Logo-1788C.png";
}

function GetHarvardImage() {
    return "https://www.iscb.org/images/stories/ismb2020/bazaar/logo.HarvardMedical-BiomedicalInformatics.png";
}

function GetFoursightCgapFaviconImage() {
    return "https://cgap-dbmi.hms.harvard.edu/favicon.ico";
}

function GetFoursightFourfrontFaviconImage() {
    return "https://data.4dnucleome.org/static/img/favicon-fs.ico";
}

function GetFoursightCgapLogoImage() {
    return "https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png";
}

function GetFoursightFourfrontLogoImage() {
    return "https://data.4dnucleome.org/static/img/favicon-fs.ico";
}

function GetGitHubLoginLogoImage() {
    return "https://github.githubassets.com/images/modules/logos_page/Octocat.png"
 // return "https://cdn4.iconfinder.com/data/icons/iconsimple-logotypes/512/github-512.png";
}

function GetGoogleLoginLogoImage() {
    return "https://cdn-icons-png.flaticon.com/512/2991/2991148.png";
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    Clipboard:                 GetClipboardImage,
    GitHub:                    GetGitHubImage,
    Lock:                      GetLockImage,
    Harvard:                   GetHarvardImage,
    History:                   GetHistoryImage,
    FoursightCgapFavicon:      GetFoursightCgapFaviconImage,
    FoursightFourfrontFavicon: GetFoursightFourfrontFaviconImage,
    FoursightCgapLogo:         GetFoursightCgapLogoImage,
    FoursightFourfrontLogo:    GetFoursightFourfrontLogoImage,
    GitHubLoginLogo:           GetGitHubLoginLogoImage,
    GoogleLoginLogo:           GetGoogleLoginLogoImage,
    PyPi:                      GetPyPiImage,
    Python:                    GetPythonImage,
    Unlock:                    GetUnlockImage
}; export default exports;
