import './css/App.css';
import { useContext } from 'react';
import GlobalContext from "./GlobalContext";
import * as URL from "./utils/URL";

const Footer = (props) => {

    const [ header ] = useContext(GlobalContext);
    const isFoursightFourfront = header.app?.package != "foursight-cgap";

    if (header.loading) return <span/>
    return <>
        <br />
        <table width="100%"><tbody>
            <tr style={{backgroundColor:"darkred",height:"1px"}}><td></td></tr>
            <tr><td align="center" style={{paddingTop:"2px",paddingBottom:"6px"}}>
                <a href={isFoursightFourfront ? ("https://" + header.env?.public_name + ".4dnucleome.org/") : "https://cgap.hms.harvard.edu/"} target="_blank">
                
                    <img src="https://www.iscb.org/images/stories/ismb2020/bazaar/logo.HarvardMedical-BiomedicalInformatics.png" height="46"/>
                </a>
            </td></tr>
            <tr style={{backgroundColor:"darkred",height:"1px"}}><td></td></tr>
        </tbody></table>
    </>
};

export default Footer;