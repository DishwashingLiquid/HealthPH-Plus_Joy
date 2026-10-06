import { useEffect, useState } from "react";
import { announceComingSoon } from "../components/HomeNavbar";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import Articles from "./Articles";
import AboutUs from "./AboutUs";
import ResearchTeam from "./ResearchTeam";
import ContactUs from "./ContactUs";
import landingPreview from "../assets/images/mobile-preview/landing.png";
import languagePreview from "../assets/images/mobile-preview/language.png";
import loginPreview from "../assets/images/mobile-preview/login.png";
import mainPreview from "../assets/images/mobile-preview/main.png";
import reportsPreview from "../assets/images/mobile-preview/self-reports.png";
import "../assets/css/public-site.css";

const previewSlides = [
  { image: landingPreview, name: "Landing screen" },
  { image: languagePreview, name: "Language selection" },
  { image: loginPreview, name: "Login screen" },
  { image: mainPreview, name: "Main screen" },
  { image: reportsPreview, name: "My Self-Reports" },
];

const MobilePreviewCarousel = () => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasTransition, setHasTransition] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const isRotating = !isPaused && !isHovered;

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!isRotating || slideIndex === previewSlides.length) return undefined;
    const timer = window.setTimeout(() => {
      setSlideIndex((index) => reducedMotion ? (index + 1) % previewSlides.length : index + 1);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [isRotating, slideIndex, reducedMotion]);

  useEffect(() => {
    if (hasTransition) return undefined;
    const frame = window.requestAnimationFrame(() => setHasTransition(true));
    return () => window.cancelAnimationFrame(frame);
  }, [hasTransition]);

  useEffect(() => {
    if (reducedMotion && slideIndex === previewSlides.length) {
      setHasTransition(false);
      setSlideIndex(0);
    }
  }, [reducedMotion, slideIndex]);

  const advanceSlide = () => {
    if (slideIndex === previewSlides.length) return;
    setSlideIndex((index) => reducedMotion ? (index + 1) % previewSlides.length : index + 1);
  };

  const resetAfterLastSlide = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform" || slideIndex !== previewSlides.length) return;
    setHasTransition(false);
    setSlideIndex(0);
  };

  return (
    <div
      className="phone-stage"
      role="group"
      aria-roledescription="carousel"
      aria-label="Mobile application preview"
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && event.target.matches(":focus-visible")) setIsPaused(true);
      }}
    >
      <div
        className="mobile-preview"
        onPointerEnter={(event) => { if (event.pointerType !== "touch") setIsHovered(true); }}
        onPointerLeave={(event) => { if (event.pointerType !== "touch") setIsHovered(false); }}
      >
        <button
          type="button"
          className="preview-rotation"
          aria-label={isPaused ? "Play slide rotation" : "Pause slide rotation"}
          onClick={() => setIsPaused((paused) => !paused)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {isPaused ? (
              <path d="M8 5.5 18 12 8 18.5Z" />
            ) : (
              <>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </>
            )}
          </svg>
        </button>
        <div className="preview-viewport">
          <div
            className={`preview-track${hasTransition ? "" : " preview-track--instant"}`}
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
            aria-live={isRotating ? "off" : "polite"}
            aria-atomic="false"
            onTransitionEnd={resetAfterLastSlide}
          >
            {[...previewSlides, previewSlides[0]].map((slide, index) => (
              <div
                key={index}
                className="preview-slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${slide.name}, ${(index % previewSlides.length) + 1} of ${previewSlides.length}`}
                aria-hidden={index !== slideIndex}
              >
                <img src={slide.image} alt="" draggable="false" />
              </div>
            ))}
          </div>
          <button type="button" className="preview-next" aria-label="Show next mobile app screen" onClick={advanceSlide} />
        </div>
        <span className="preview-hint" aria-hidden="true">Tap to explore</span>
      </div>
    </div>
  );
};

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
      <HomeNavbar trackSections />
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
            <MobilePreviewCarousel />
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
