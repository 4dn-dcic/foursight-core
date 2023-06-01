import Styles from '../Styles';
import Str from '../utils/Str';
import Char from '../utils/Char';
import { HorizontalLine } from '../Components';
import useFetcher from '../hooks/Fetch';

const ChecksValidation = () => {
    const checksValidation = useFetcher("/checks_validation");
    const actionsWithNoAssociatedCheck = checksValidation.data?.actions_with_no_associated_check;
    if (!actionsWithNoAssociatedCheck) {
        return <></>
    }
    return <>
        <div className="box error thickborder" style={{width:"80%",fontSize:"small"}}>
            <b>The following defined action functions have no assocated check</b>: <br />
            <HorizontalLine top="6" bottom="6" color="darkred" thick={true} />
            { actionsWithNoAssociatedCheck.map(item => <>
                {Char.RightArrow} <a href={item.github_url} target="_blank"><span style={{color:"darkred"}}>{item.name}</span></a><br />
            </>)}
        </div>
        <br />
    </>
}

export default ChecksValidation;
