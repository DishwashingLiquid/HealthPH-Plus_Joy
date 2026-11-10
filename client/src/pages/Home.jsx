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
  // A clone at each end allows previous/next to wrap in either direction.
  const [slideIndex, setSlideIndex] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [hasTransition, setHasTransition] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const isRotating = !isPaused;
  const isLoopBoundary = slideIndex === 0 || slideIndex === previewSlides.length + 1;

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!isRotating || isLoopBoundary) return undefined;
    const timer = window.setTimeout(() => {
      setSlideIndex((index) => reducedMotion ? index % previewSlides.length + 1 : index + 1);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [isRotating, slideIndex, reducedMotion, isLoopBoundary]);

  useEffect(() => {
    if (hasTransition) return undefined;
    const frame = window.requestAnimationFrame(() => setHasTransition(true));
    return () => window.cancelAnimationFrame(frame);
  }, [hasTransition]);

  useEffect(() => {
    if (reducedMotion && isLoopBoundary) {
      setHasTransition(false);
      setSlideIndex(slideIndex === 0 ? previewSlides.length : 1);
    }
  }, [reducedMotion, slideIndex, isLoopBoundary]);

  const moveSlide = (direction) => {
    setSlideIndex((index) => {
      if (index === 0 || index === previewSlides.length + 1) return index;
      return reducedMotion
        ? (index - 1 + direction + previewSlides.length) % previewSlides.length + 1
        : index + direction;
    });
  };

  const resetAfterLoop = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform" || !isLoopBoundary) return;
    setHasTransition(false);
    setSlideIndex(slideIndex === 0 ? previewSlides.length : 1);
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
      <div className="mobile-preview">
        <div className="preview-viewport">
          <div
            className={`preview-track${hasTransition ? "" : " preview-track--instant"}`}
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
            aria-live={isRotating ? "off" : "polite"}
            aria-atomic="false"
            onTransitionEnd={resetAfterLoop}
          >
            {[previewSlides[previewSlides.length - 1], ...previewSlides, previewSlides[0]].map((slide, index) => (
              <div
                key={index}
                className="preview-slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${slide.name}, ${(index - 1 + previewSlides.length) % previewSlides.length + 1} of ${previewSlides.length}`}
                aria-hidden={index !== slideIndex}
              >
                <img src={slide.image} alt="" draggable="false" />
              </div>
            ))}
          </div>
          <div className="preview-controls" role="group" aria-label="Screenshot controls"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                moveSlide(event.key === "ArrowLeft" ? -1 : 1);
              }
            }}>
            <button type="button" className="preview-zone preview-zone--previous" aria-label="Show previous mobile app screen" disabled={isLoopBoundary} onClick={() => moveSlide(-1)} />
            <button type="button" className="preview-zone preview-zone--toggle" aria-label={isPaused ? "Play slide rotation" : "Pause slide rotation"} onClick={() => setIsPaused((paused) => !paused)} />
            <button type="button" className="preview-zone preview-zone--next" aria-label="Show next mobile app screen" disabled={isLoopBoundary} onClick={() => moveSlide(1)} />
          </div>
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  useEffect(() => {
    // The lazy homepage may mount after the browser first resolves the hash.
    // Later anchor clicks and history navigation use native fragment scrolling.
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  return (
    <div className="public-site public-buttons">
      <HomeNavbar trackSections />
      <main>
        <section id="home" className="public-section public-hero">
          <div className="public-shell public-hero-grid">
            <div className="public-hero-copy">
              <p className="public-eyebrow">Public health intelligence, reimagined</p>
              <h1>HealthPH+</h1>
              <p className="public-hero-title">Machine Learning and Multilingual NLP for Intelligent Public Health Surveillance</p>
              <p className="public-hero-subtitle">Innovating AI Solutions for Better Public Health</p>
              <button type="button" className="public-button public-button--large public-primary-button" onClick={announceComingSoon}>Download the app</button>
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
