import { useContext } from 'react';
import HeaderData from './HeaderData';
import Env from './utils/Env';
import Image from './utils/Image';

const Footer = (props) => {

    const [ header ] = useContext(HeaderData);

    // TODO
    // Get the URLs CGAP/4DN URLs below directly from the Portal.

    if (header.loading) return null;
    return <>
        <br />
        <table width="100%"><tbody>
            <tr style={{backgroundColor:"darkred",height:"1px"}}><td></td></tr>
            <tr><td align="center" style={{paddingTop:"2px",paddingBottom:"6px"}}>
                <a href={Env.IsFoursightFourfront(header) ? ("https://" + Env.PublicName(Env.Current()) + ".4dnucleome.org/") : "https://cgap.hms.harvard.edu/"} target="_blank" rel="noreferrer">
                    <img alt="harvard" src={Image.Harvard()} height="46"/>
                </a>
            </td></tr>
            <tr style={{backgroundColor:"darkred",height:"1px"}}><td></td></tr>
        </tbody></table>
    </>
};

export default Footer;
