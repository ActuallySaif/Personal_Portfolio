import React, { useEffect, useState } from 'react';
import './Preloader.css';
import { supabase } from '../supabase';

// Kept between page changes so the name doesn't blink in again every time the preloader shows.
let cachedInfo = null;

// overlay: shown over the page by PageLoader (on every page). hiding: fading out.
const Preloader = ({ overlay = false, hiding = false }) => {
  const [info, setInfo] = useState(cachedInfo);

  useEffect(() => {
    if (cachedInfo) return;
    const fetchInfo = async () => {
      const { data, error } = await supabase
        .from('profile')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching from Supabase:', error.message);
      } else {
        cachedInfo = data;
        setInfo(data);
        console.log('Fetched profile:', data);
      }
    };

    fetchInfo();
  }, []);

  return (
    <div
      className={`Preloader${overlay ? ' is-overlay' : ''}${hiding ? ' is-hiding' : ''}`}
      aria-hidden={hiding}
    >
      <div className="PreloadText">
        <p className="PreloadTitle">Portfolio - system check</p>
        <h3 className="MyName">
          {info ? `${info.first_Name} ${info.last_Name}` : ''}
        </h3>
        <div className='Load'>
            <div className='LoadBar'></div>
        </div>
      </div>
    </div>
  );
};

export default Preloader;