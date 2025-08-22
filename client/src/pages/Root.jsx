import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Home from './Home.jsx';
import Landing from './Landing.jsx';

export default function Root() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      // Delay to ensure Landing has rendered
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, [location]);
  return (
    <>
      <SignedIn>
        <Home />
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  );
}
