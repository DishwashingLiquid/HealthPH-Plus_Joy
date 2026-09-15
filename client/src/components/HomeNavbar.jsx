/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { toast } from "react-toastify";
import WebLogo from "../assets/images/website-logo.svg";
import NULogoLgAlt from "../assets/images/nu-logo-lg-alt.png";
import Snackbar from "./Snackbar";
import "../assets/css/public-site.css";

const navigation = [
  { href: "/#home", label: "Download the app", download: true },
  { href: "/#articles", label: "Articles" },
  { href: "/#about", label: "About the Project" },
  { href: "/#contact", label: "Contact Us" },
];

const announceComingSoon = () => {
  toast(
    <Snackbar
      size="snackbar-md"
      color="primary"
      iconName="Information"
      message="Coming soon"
    />
  );
};

const HomeNavbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const closeMenu = () => setIsOpen(false);

  return (
    <header className="public-header">
      <nav className="public-nav" aria-label="Public navigation">
        <a href="/#home" className="public-logo" aria-label="HealthPH+ home" onClick={closeMenu}>
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
                  <a href={href} onClick={closeMenu}>{label}</a>
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
