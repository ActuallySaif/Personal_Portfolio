import React, { useState, useEffect, useRef } from 'react';
import './PageNav.css';

const PageSections = [
  { id: 'level-00', depth: '000M', label: 'Start', title: '00 // The Surface' },
  { id: 'level-01', depth: '-050M', label: 'About', title: '01 // About me' },
  { id: 'level-02', depth: '-120M', label: 'Categories', title: '02 // Main Cargo Bay' },
  { id: 'level-03', depth: '-250M', label: 'Projects', title: '03 // The Assembly Lab' },
  { id: 'level-05', depth: '-500M', label: 'End', title: '05 // Bottom' },
];

// Layout metrics (aligned to 6px minor / 30px major ruler increments)
const RAIL_MARGIN = 24; // 1.5rem top/bottom offset
const ITEM_HEIGHT = 36; // Height of each nav tab in px
const ITEM_GAP = 24;    // Space between tabs revealing the ruler ticks
const STEP = ITEM_HEIGHT + ITEM_GAP; // 60px total step

const PageNav = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [yPositions, setYPositions] = useState(() =>
    PageSections.map((_, i) => i * STEP)
  );
  const rulerRef = useRef(null);

  useEffect(() => {
    let rafId = null;

    const updateNavPositions = () => {
      const total = PageSections.length;
      const trackHeight = window.innerHeight - RAIL_MARGIN * 2;
      const triggerPoint = window.innerHeight * 0.35;

      // Move the ruler graduations 1:1 with page scroll (wrapped at the 30px major tick interval)
      if (rulerRef.current) {
        const tickOffset = -(window.scrollY % 30);
        rulerRef.current.style.backgroundPosition = `right ${tickOffset}px, right ${tickOffset}px`;
      }

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const remainingScroll = Math.max(0, maxScroll - window.scrollY);
      const endBlendZone = 240;
      const endProgress =
        maxScroll > 0
          ? Math.max(0, Math.min(1, 1 - remainingScroll / endBlendZone))
          : 0;

      let currentActive = 0;

      const nextPositions = PageSections.map((section, index) => {
        const topPos = index * STEP;
        const bottomPos = Math.max(
          topPos,
          trackHeight - (total - index) * STEP + ITEM_GAP
        );

        const el = document.getElementById(section.id);
        if (!el) return index === 0 ? 0 : bottomPos;

        const rect = el.getBoundingClientRect();

        if (rect.top <= triggerPoint) {
          currentActive = index;
        }

        if (index === 0) return 0;

        const sectionRelativeTop = rect.top - RAIL_MARGIN;
        const clampedY = Math.min(
          bottomPos,
          Math.max(topPos, sectionRelativeTop)
        );

        return clampedY + (topPos - clampedY) * endProgress;
      });

      if (remainingScroll <= 24) {
        currentActive = total - 1;
      }

      setActiveIndex(currentActive);
      setYPositions(nextPositions);
    };

    const onScrollOrResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateNavPositions);
    };

    updateNavPositions();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  const scrollToSection = (e, id, index) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIndex(index);
    }
  };

  return (
    <>
      {/* Desktop Right-Rail Depth Meter & Docking Navigation */}
      <aside aria-label="Page Sections" className="page-nav-desktop">
        <div className="page-nav-track">
          {/* Scroll-Synced Vertical Ruler / Depth Gauge Scale */}
          <div ref={rulerRef} className="page-nav-ruler" aria-hidden="true" />

          {PageSections.map((section, index) => {
            const isActive = index === activeIndex;
            const translateY = yPositions[index] ?? index * STEP;

            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(e) => scrollToSection(e, section.id, index)}
                style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
                className={`page-nav-item ${isActive ? 'is-active' : ''}`}
              >
                <span className="page-nav-label">{section.label}</span>
                <span className="page-nav-depth">{section.depth}</span>
              </a>
            );
          })}
        </div>
      </aside>

      {/* Mobile Compact Top Bar */}
      <nav aria-label="Mobile Page Sections" className="page-nav-mobile">
        {PageSections.map((section, index) => {
          const isActive = index === activeIndex;
          return (
            <React.Fragment key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(e) => scrollToSection(e, section.id, index)}
                className={`page-nav-mobile-item ${isActive ? 'is-active' : ''}`}
              >
                <span className="page-nav-mobile-depth">{section.depth}</span>
                {section.label}
              </a>
              {index < PageSections.length - 1 && (
                <span className="page-nav-mobile-ticks" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </>
  );
};

export default PageNav;