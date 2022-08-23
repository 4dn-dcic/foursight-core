import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';

export const fetchData = (url, setData, setLoading) => {
    fetch(url).then(response => {
        return response.json();
    }).then(responseJson => {
        setData(responseJson);
        if (setLoading) {
            setLoading(false);
        }
    })
}
