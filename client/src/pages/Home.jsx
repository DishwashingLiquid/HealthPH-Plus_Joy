import { useEffect } from "react";
import { announceComingSoon } from "../components/HomeNavbar";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import Articles from "./Articles";
import AboutUs from "./AboutUs";
import ResearchTeam from "./ResearchTeam";
import ContactUs from "./ContactUs";
import "../assets/css/public-site.css";

const Home = () => {
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="public-site">
      <HomeNavbar />
      <main>
        <section id="home" className="public-section public-hero">
          <div className="public-shell public-hero-grid">
            <div className="public-hero-copy">
              <p className="public-eyebrow">Public health intelligence, reimagined</p>
              <h1>HealthPH+</h1>
              <p className="public-hero-title">Machine Learning and Multilingual NLP for Intelligent Public Health Surveillance</p>
              <p className="public-hero-subtitle">Innovating AI Solutions for Better Public Health</p>
              <button type="button" className="public-primary-button" onClick={announceComingSoon}>Download the app</button>
            </div>
            <div className="phone-stage" aria-label="Mobile application preview placeholder">
              <div className="phone-placeholder">
                <div className="phone-speaker"></div>
                <div className="phone-screen">
                  <div className="phone-screen-top"><span></span><i></i><i></i></div>
                  <div className="phone-screen-grid"><i></i><i></i><i></i></div>
                  <p>Mobile application<br />preview</p>
                  <div className="phone-screen-wave"></div>
                  <div className="phone-screen-dots"><i></i><i></i><i></i></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <Articles embedded />
        <AboutUs embedded />
        <ResearchTeam embedded />
        <ContactUs embedded />
      </main>
      <HomeFooter />
    </div>
  );
};

export default Home;
