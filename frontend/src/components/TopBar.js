import React, { useState } from 'react';
import './TopBar.css';
import ariacall_logo from './ariacall_logo.png';

function TopBar() {
  const [navOpen, setNavOpen] = useState(false);

  const toggleNavLinks = () => {
    setNavOpen(!navOpen);
  };

  return (
    <div className="top-bar">
      <div className="logo">
        <img src={ariacall_logo}alt="Logo" />
      </div>
      <div className={`nav-links ${navOpen ? 'open' : ''}`} id="navLinks">
        <a href="https://ariacall.pl" target="_blank" rel="noopener noreferrer">Strona projektu</a>
        <a href="https://github.com/mwilkosz/AriaCall" target="_blank" rel="noopener noreferrer">Github</a>
      </div>
      <a href="https://calendly.com/ariacall/30min" className="demo-button">Umów demo</a>
      <div className="hamburger-menu" onClick={toggleNavLinks}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export default TopBar;
