/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
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
  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    if (!trackSections) return undefined;

    const header = document.querySelector(".public-header");
    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!header || sections.length !== sectionIds.length) return undefined;

    let observer;
    const getProbeOffset = () => {
      const anchorOffset = parseFloat(window.getComputedStyle(sections[0]).scrollMarginTop) || 0;
      return Math.min(
        Math.max(Math.ceil(header.getBoundingClientRect().bottom), anchorOffset) + 1,
        window.innerHeight - 1
      );
    };
    const updateActiveSection = () => {
      const probeOffset = getProbeOffset();
      let current = null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= probeOffset) current = section.id;
      }
      setActiveSection(current === "home" ? null : current);
    };
    const observeSections = () => {
      observer?.disconnect();
      const probeOffset = getProbeOffset();
      observer = new IntersectionObserver(updateActiveSection, {
        rootMargin: `-${probeOffset}px 0px -${window.innerHeight - probeOffset - 1}px 0px`,
      });
      sections.forEach((section) => observer.observe(section));
      updateActiveSection();
    };

    observeSections();
    window.addEventListener("resize", observeSections);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observeSections);
    };
  }, [trackSections]);

  return (
    <header className="public-header">
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
                    onClick={() => { if (trackSections) setActiveSection(href.slice(2)); closeMenu(); }}
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
