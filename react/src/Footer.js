import './css/App.css';
import { useContext } from 'react';
import Global from "./Global";
import ENV from "./utils/ENV";
import Image from "./utils/Image";

const Footer = (props) => {

    const [ header ] = useContext(Global);

    if (header.loading) return null;
    return <>
        <br />
        <table width="100%"><tbody>
            <tr style={{backgroundColor:"darkred",height:"1px"}}><td></td></tr>
            <tr><td align="center" style={{paddingTop:"2px",paddingBottom:"6px"}}>
                <a href={ENV.IsFoursightFourfront(header) ? ("https://" + ENV.PublicName(ENV.Current()) + ".4dnucleome.org/") : "https://cgap.hms.harvard.edu/"} target="_blank">
                    <img src={Image.Harvard()} height="46"/>
                </a>
            </td></tr>
            <tr style={{backgroundColor:"darkred",height:"1px"}}><td></td></tr>
        </tbody></table>
    </>
};

export default Footer;
