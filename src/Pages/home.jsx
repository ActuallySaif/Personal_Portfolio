import React from 'react';
import './home.css';
import PageNav from '../Components/Layout/PageNav';
import BlenderScene from '../Components/Scene/BlenderScene';

const Home = () => {
  return (
    <div className="home-layout">
      {/* Blender scene: fixed behind the page, camera driven by scroll */}
      <BlenderScene />

      {/* Right-rail docking navigation */}
      <PageNav />

      {/* Main scrollable content area */}
      <main className="facility-content">
        {/* LEVEL 00: Hero / Surface */}
        <section id="level-00" className="facility-section">
          <div className="section-header">
            <span className="section-title">00 // The Surface</span>
            <span className="section-depth">000M</span>
          </div>
          <div className="section-body">
            {/* Your Hero component, custom Saif Hossam typography, and sky/rooftop background */}
          </div>
        </section>

        {/* LEVEL 01: About / Reception */}
        <section id="level-01" className="facility-section">
          <div className="section-header">
            <span className="section-title">01 // About Me</span>
            <span className="section-depth">-050M</span>
          </div>
          <div className="section-body">
            {/* Your Reception bio, operator manifest, and Three.js point-cloud portrait */}
          </div>
        </section>

        {/* LEVEL 02: Categories / Main Cargo Bay */}
        <section id="level-02" className="facility-section">
          <div className="section-header">
            <span className="section-title">02 // Main Cargo Bay</span>
            <span className="section-depth">-120M</span>
          </div>
          <div className="section-body">
            {/* Your 3 main discipline containers: 3D Design, UI/UX Design, Frontend Dev */}
          </div>
        </section>

        {/* LEVEL 03: Projects / Assembly Lab */}
        <section id="level-03" className="facility-section">
          <div className="section-header">
            <span className="section-title">03 // The Assembly Lab</span>
            <span className="section-depth">-250M</span>
          </div>
          <div className="section-body">
            {/* Featured projects (STARTUP - Act 1, Megastructure, Pinky Lollypop) */}
          </div>
        </section>

        {/* LEVEL 05: Contact & Footer */}
        <section id="level-05" className="facility-section">
          <div className="section-header">
            <span className="section-title">05 // Bottom</span>
            <span className="section-depth">-500M</span>
          </div>
          <div className="section-body">
            {/* Contact form, social links, and footer telemetry */}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;