import React, { useEffect, useState } from 'react';
import './Preloader.css';
import { supabase } from '../supabase';

const Preloader = () => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const fetchInfo = async () => {
      const { data, error } = await supabase
        .from('profile')
        .select('first_Name, last_Name')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching from Supabase:', error.message);
      } else {
        setInfo(data);
        console.log('Fetched profile:', data);
      }
    };

    fetchInfo();
  }, []);

  return (
    <div className="Preloader">
      <div className="PreloadText">
        <p className="PreloadTitle">Portfolio - system check</p>
        <h3 className="MyName">
          {info ? `${info.first_Name} ${info.last_Name}` : 'Loading'}
        </h3>
      </div>
    </div>
  );
};

export default Preloader;