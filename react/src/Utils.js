import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';

export const useScrollToTop = () => {
  console.log('abc-2')
  const location = useLocation();
  const [search] = useSearchParams();
  console.log('abc-3')
  console.log(location);
  console.log('abc-4')
  console.log(search);
  console.log('abc-5')
  console.log(search.get('sort'));
  useEffect(() => {
    window.scrollTo({ top: 0 });
    // scroll to the top of the browser window when changing route
    // the window object is a normal DOM object and is safe to use in React.
  }, [location]);
};
