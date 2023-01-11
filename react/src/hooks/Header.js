import React, { useContext, useEffect, useState } from 'react';
import HeaderData from '../HeaderData';

const useHeader = () => {
    const [ header ] = useContext(HeaderData);
    return header;
}

export default useHeader;
