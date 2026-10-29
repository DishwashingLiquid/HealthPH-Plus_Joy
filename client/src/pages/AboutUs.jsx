/* eslint-disable react/prop-types */
import { useEffect } from "react";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import "../assets/css/about.css";
import "../assets/css/public-site.css";

const featureCards = [
  ["Multilingual NLP", "Curated English, Filipino, Cebuano, Ilocano, and Hiligaynon corpora support inclusive symptom extraction, sentiment analysis, and misinformation detection."],
  ["Outbreak intelligence", "Machine-learning models move surveillance from delayed detection toward real-time outbreak detection and forecasting, with targets for strong precision and recall."],
  ["Environmental context", "Weather patterns and air-quality indicators strengthen forecasting and support a One Health view of human, environmental, and community health."],
  ["Misinformation tracking", "Automated monitoring classifies health-related misinformation and public sentiment across monitored platforms."],
];

const AboutUs = ({ embedded = false }) => {
  useEffect(() => {
    if (!embedded) window.scrollTo(0, 0);
  }, [embedded]);

  const content = (
    <section id={embedded ? "about" : undefined} className={embedded ? "public-section public-content-section section-about" : "mt-[56px]"}>
      <div className={embedded ? "public-shell" : "about-container mb-[112px]"}>
        <p className={embedded ? "public-section-heading" : "section-title"}>About the Project</p>
        <div className="project-grid">
          <div className="project-summary">
            <p><strong>HealthPH+ is Phase 2 of the HealthPH Initiative.</strong> It expands the original HealthPH: Intelligent Disease Surveillance using Social Media project into a responsive, data-driven public health intelligence system.</p>
            <p>The <a href="https://www.pchrd.dost.gov.ph/about-pchrd/" target="_blank" rel="noreferrer">Department of Science and Technology — Philippine Council for Health Research and Development (DOST-PCHRD)</a>, through its Grants-in-Aid Program, approved <a href="https://national-u.edu.ph/" target="_blank" rel="noreferrer">National University&apos;s</a> research proposal to promote public health surveillance in the Philippines.</p>
            <p>Building on RespiratoryPH—the first multilingual respiratory disease dataset in English, Filipino, and Cebuano—Phase 1 developed transformer-based multilingual analysis, including mBERT, models that achieved 81% accuracy in detecting COVID-19, pneumonia, and TB symptoms, and capacity-building initiatives for AI in public health.</p>
          </div>
          <div className="project-cards">
            {featureCards.map(([title, description]) => <article className="project-card" key={title}><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
        <div className="project-objectives">
          <h3>What HealthPH+ aims to deliver</h3>
          <ul>
            <li>Multisectoral partnerships with DOH, LGUs, HEIs, and community organizations.</li>
            <li>Real-time web and mobile reporting platforms designed for public-health users and community volunteers, targeting at least 80% System Usability Scale acceptance.</li>
            <li>Outbreak forecasting that integrates environmental indicators; models target at least 65% accuracy.</li>
            <li>Multilingual NLP modules targeting at least 60% F1 score across major Philippine languages.</li>
            <li>Capacity-building for at least 50 practitioners, with 85% showing measurable improvement.</li>
            <li>Stronger preparedness, resilience, and early-warning capability aligned with SDGs 3, 9, 11, and 17—health and well-being, innovation, sustainable communities, and partnerships.</li>
          </ul>
        </div>
      </div>
    </section>
  );

  if (embedded) return <div className="article-layout about-us one-page-section">{content}</div>;

  return <div className="article-layout about-us flex flex-col min-h-[100vh]"><HomeNavbar />{content}<HomeFooter /></div>;
};

export default AboutUs;
