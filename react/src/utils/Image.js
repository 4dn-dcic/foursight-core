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
}

function GetGoogleLoginLogoImage() {
    return "https://cdn-icons-png.flaticon.com/512/2991/2991148.png";
}

function GetElasticsearchLogoImage() {
    return "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Elasticsearch_logo.svg/1280px-Elasticsearch_logo.svg.png"
}

function GetClearCacheImage() {
    return "https://static.thenounproject.com/png/2495429-200.png";
}

function GetHierarchyIcon() {
    return "https://cdn0.iconfinder.com/data/icons/business-454/24/hierarchy-512.png";
}

function GetCalendarIcon() {
    return "https://img.freepik.com/free-icon/calendar-icon-black_318-9776.jpg?w=360";
}

function GetNewIcon() {
    return "https://cdn2.iconfinder.com/data/icons/picons-essentials/71/new-512.png";
}

function GetSettingsIcon() {
    return "https://www.freeiconspng.com/thumbs/settings-icon/settings-icon-16.png"
}

function GetSettingsRedIcon() {
    return "https://icones.pro/wp-content/uploads/2022/02/services-parametres-et-icone-d-engrenage-rouge.png"
}

function GetAtomIcon() {
    return "https://cdn-icons-png.flaticon.com/512/45/45082.png";
}

function GetMenuIcon() {
    return "https://icons.veryicon.com/png/o/miscellaneous/offerino-icons/app-menu.png";
}

function GetCognitoLogoImage() {
    return "https://miro.medium.com/max/600/1*aWDf6UyKfk7sdSMiq9sGJA.png";
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    AtomIcon:                  GetAtomIcon,
    CalendarIcon:              GetCalendarIcon,
    ClearCache:                GetClearCacheImage,
    Clipboard:                 GetClipboardImage,
    CognitoLogo:               GetCognitoLogoImage,
    GitHub:                    GetGitHubImage,
    Lock:                      GetLockImage,
    Harvard:                   GetHarvardImage,
    History:                   GetHistoryImage,
    HierarchyIcon:             GetHierarchyIcon,
    ElasticsearchLogo:         GetElasticsearchLogoImage,
    FoursightCgapFavicon:      GetFoursightCgapFaviconImage,
    FoursightFourfrontFavicon: GetFoursightFourfrontFaviconImage,
    FoursightCgapLogo:         GetFoursightCgapLogoImage,
    FoursightFourfrontLogo:    GetFoursightFourfrontLogoImage,
    GitHubLoginLogo:           GetGitHubLoginLogoImage,
    GoogleLoginLogo:           GetGoogleLoginLogoImage,
    MenuIcon:                  GetMenuIcon,
    NewIcon:                   GetNewIcon,
    PyPi:                      GetPyPiImage,
    Python:                    GetPythonImage,
    SettingsIcon:              GetSettingsIcon,
    SettingsRedIcon:           GetSettingsRedIcon,
    Unlock:                    GetUnlockImage
}; export default exports;
