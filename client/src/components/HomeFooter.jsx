import Logo from "../assets/images/logo.png";
import "../assets/css/public-site.css";

const HomeFooter = () => (
  <footer className="public-footer">
    <div className="public-footer-inner">
      <div className="footer-logo"><img src={Logo} alt="HealthPH+" /></div>
      <nav aria-label="Footer navigation" className="public-footer-links">
        <a href="/#research-team">Research Team</a>
        <a href="/#contact">Contact Us</a>
      </nav>
      <p>© 2026 HealthPH+. All Rights Reserved.</p>
    </div>
  </footer>
);

export default HomeFooter;
