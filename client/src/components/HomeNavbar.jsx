/* eslint-disable react-refresh/only-export-components */
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import WebLogo from "../assets/images/website-logo.svg";
import NULogoLgAlt from "../assets/images/nu-logo-lg-alt.png";
import Snackbar from "./Snackbar";
import "../assets/css/public-site.css";

const navigation = [
  { href: "/#home", label: "Download the app", download: true },
  { href: "/#articles", label: "Articles" },
  { href: "/#about", label: "About the Project" },
  { href: "/#research-team", label: "Research Team" },
  { href: "/#contact", label: "Contact Us" },
];

const sectionIds = ["home", "articles", "about", "research-team", "contact"];

const announceComingSoon = () => {
  toast(
    <Snackbar
      size="snackbar-md"
      color="public"
      iconName="Information"
      message="Coming soon"
    />
  );
};

// eslint-disable-next-line react/prop-types
const HomeNavbar = ({ trackSections = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const headerRef = useRef(null);
  const closeMenu = () => setIsOpen(false);

  useLayoutEffect(() => {
    if (!trackSections) return undefined;

    const header = headerRef.current;
    const site = header?.closest(".public-site");
    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!site || sections.length !== sectionIds.length) return undefined;

    let frame;
    let offset;
    const updateActiveSection = () => {
      frame = undefined;
      // The header includes the inset above the sticky navigation bar.
      offset = Math.ceil(header.getBoundingClientRect().bottom);
      site.style.setProperty("--public-nav-offset", `${offset}px`);
      let current = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= offset + 1) current = section.id;
      }
      // A short final section may reach the page end before its heading can align.
      const last = sections[sections.length - 1];
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1 &&
          last.getBoundingClientRect().top < window.innerHeight) current = last.id;
      setActiveSection(current === "home" ? null : current);
    };
    const scheduleUpdate = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(header);
    observer.observe(site);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      site.style.removeProperty("--public-nav-offset");
    };
  }, [trackSections]);

  return (
    <header ref={headerRef} className="public-header">
      <nav className="public-nav" aria-label="Public navigation">
        <a href="/#home" className="public-logo" aria-label="HealthPH+ home" onClick={() => { setActiveSection(null); closeMenu(); }}>
          <img src={WebLogo} alt="HealthPH+" />
        </a>
        <button
          type="button"
          className="public-menu-button"
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span></span><span></span><span></span>
        </button>
        <div className={`public-nav-content ${isOpen ? "is-open" : ""}`}>
          <ul className="public-nav-links">
            {navigation.map(({ href, label, download }) => (
              <li key={label}>
                {download ? (
                  <button type="button" className="public-download-button" onClick={() => { announceComingSoon(); closeMenu(); }}>
                    {label}
                  </button>
                ) : (
                  <a
                    href={href}
                    aria-current={trackSections && activeSection === href.slice(2) ? "location" : undefined}
                    onClick={closeMenu}
                  >
                    {label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <img className="public-nu-logo" src={NULogoLgAlt} alt="National University" />
        </div>
      </nav>
    </header>
  );
};

export { announceComingSoon };
export default HomeNavbar;
