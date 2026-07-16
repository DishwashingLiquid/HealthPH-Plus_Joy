import { useEffect } from "react";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";

const AboutUs = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="article-layout about-us flex flex-col min-h-[100vh]">
      <HomeNavbar background="solid" />

      <section className="mt-[56px] flex-grow">
        <div className="about-container mb-[112px]">
          <div className="w-full max-w-[1144px]">
            <p className="section-title !text-gray-700">About the Project</p>
            <div className="article-body text-gray-700 web-m-p3 sm:web-d-p3">
              <p className="mb-[24px] text-justify">
                The{" "}
                <a
                  href="https://www.pchrd.dost.gov.ph/about-pchrd/"
                  className="underline underline-offset-2"
                  target="_blank"
                >
                  Department of Science and Technology — Philippine Council for
                  Health Research and Development (DOST-PCHRD)
                </a>
                , through the Grants-in-Aid (GIA) Program, has recently
                approved{" "}
                <a
                  href="https://national-u.edu.ph/"
                  className="underline underline-offset-2"
                  target="_blank"
                >
                  National University
                </a>
                's research proposal to promote public health surveillance in
                the Philippines.
              </p>

              <p className="mb-[24px]">
                <strong>
                  HealthPH+: Advancing Intelligent Public Health Surveillance
                </strong>
              </p>

              <p className="mb-[24px]">
                <strong>Phase 2 of the HealthPH Initiative</strong>
              </p>

              <p className="mb-[24px] text-justify">
                An enhanced expansion of HealthPH, integrating multilingual AI,
                environmental intelligence, and misinformation tracking to
                deliver faster, more responsive outbreak detection nationwide.
              </p>

              <p className="mb-[24px] text-justify">
                Strengthening national outbreak preparedness through inclusive,
                data-driven innovation.
              </p>

              <p className="mb-[24px]">
                <strong>
                  Breaking New Ground: From HealthPH to HealthPH+
                </strong>
              </p>

              <p className="mb-[24px] text-justify">
                In a country as linguistically and geographically diverse as the
                Philippines, timely disease surveillance remains a complex
                challenge. While the original HealthPH: Intelligent Disease
                Surveillance using Social Media project laid the groundwork for
                AI-driven monitoring of public health signals, its success has
                paved the way for a more advanced and comprehensive
                system—HealthPH+.
              </p>

              <p className="mb-[24px] text-justify">
                As Phase 2 of the HealthPH project, HealthPH+ expands the
                capabilities of its predecessor by integrating multilingual AI,
                environmental intelligence, and misinformation tracking. This
                evolution transforms HealthPH from a monitoring tool into a
                fully responsive, data-driven public health intelligence system.
              </p>

              <p className="mb-[24px]">
                <strong>
                  FROM DETECTION TO PREDICTION: A SMARTER APPROACH TO PUBLIC
                  HEALTH
                </strong>
              </p>

              <p className="mb-[24px] text-justify">
                Traditional surveillance systems in the Philippines often face
                delays, limited reach, and gaps in community-level reporting.
                Meanwhile, millions of Filipinos share health experiences online
                in multiple local languages—data that remains largely untapped.
              </p>

              <p className="mb-[24px] text-justify">
                HealthPH+ addresses this gap by combining:
              </p>

              <ul className="mb-[24px] list-disc list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[12px]">
                  Multilingual Natural Language Processing (NLP)
                </li>
                <li className="list-item mb-[12px]">
                  Machine Learning (ML) for outbreak detection and forecasting
                </li>
                <li className="list-item mb-[12px]">
                  Environmental data integration (weather and air quality)
                </li>
                <li className="list-item">
                  Misinformation detection and sentiment analysis
                </li>
              </ul>

              <p className="mb-[24px] text-justify">
                This enables a shift from delayed detection → proactive
                response, empowering health authorities with real-time insights.
              </p>

              <p className="mb-[24px]">
                <strong>BUILDING ON PROVEN FOUNDATIONS</strong>
              </p>

              <p className="mb-[24px] text-justify">
                The success of HealthPH (Phase 1) established a strong
                baseline:
              </p>

              <ul className="mb-[24px] list-disc list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[12px]">
                  Development of the RespiratoryPH dataset, the first
                  multilingual respiratory disease dataset in English,
                  Filipino, and Cebuano
                </li>
                <li className="list-item mb-[12px]">
                  AI models achieving 81% accuracy in detecting COVID-19,
                  pneumonia, and TB symptoms
                </li>
                <li className="list-item mb-[12px]">
                  Use of transformer-based models (e.g., mBERT) for
                  multilingual analysis
                </li>
                <li className="list-item">
                  Capacity-building initiatives for AI in public health
                </li>
              </ul>

              <p className="mb-[24px] text-justify">
                HealthPH+ (Phase 2) expands these achievements by:
              </p>

              <ul className="mb-[24px] list-disc list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[12px]">
                  Adding Ilocano and Hiligaynon language support
                </li>
                <li className="list-item mb-[12px]">
                  Introducing outbreak forecasting using environmental
                  indicators
                </li>
                <li className="list-item mb-[12px]">
                  Strengthening misinformation detection systems
                </li>
                <li className="list-item">
                  Deploying real-time web and mobile reporting platforms
                </li>
              </ul>

              <p className="mb-[24px]">
                <strong>HOW HEALTHPH+ WORKS</strong>
              </p>

              <p className="mb-[24px] text-justify">
                Harnessing AI, Multilingual NLP, and Environmental
                Intelligence
              </p>

              <ul className="mb-[24px] list-disc list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[16px]">
                  <strong>Multilingual Corpora Development</strong> Curated
                  linguistic datasets in Filipino, Cebuano, Ilocano,
                  Hiligaynon, and English to ensure representativeness and data
                  quality for AI training.
                </li>
                <li className="list-item mb-[16px]">
                  <strong>Machine Learning Outbreak Detection</strong> Real-time
                  models designed to detect and forecast disease outbreaks,
                  targeting ≥65% accuracy with strong precision and recall
                  performance.
                </li>
                <li className="list-item mb-[16px]">
                  <strong>Multilingual NLP Modules</strong> Symptom extraction,
                  misinformation detection, and sentiment analysis systems
                  targeting ≥60% F1 score across major Philippine languages.
                </li>
                <li className="list-item mb-[16px]">
                  <strong>Environmental Data Integration</strong> Weather
                  patterns and air quality indicators integrated to strengthen
                  outbreak forecasting accuracy.
                </li>
                <li className="list-item mb-[16px]">
                  <strong>AI-Driven Misinformation Monitoring</strong> Automated
                  detection and classification of health-related misinformation
                  across monitored platforms.
                </li>
                <li className="list-item">
                  <strong>User-Centered Web and Mobile Applications</strong>{" "}
                  Accessible dashboards and reporting systems designed to
                  achieve at least 80% System Usability Scale (SUS) acceptance
                  among public health users and community volunteers.
                </li>
              </ul>

              <p className="mb-[24px]">
                <strong>STRATEGIC OBJECTIVES</strong>
              </p>

              <p className="mb-[24px] text-justify">HealthPH+ aims to:</p>

              <ol className="mb-[24px] list-decimal list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[12px]">
                  Establish multisectoral partnerships with DOH, LGUs, HEIs,
                  and community organizations for collaborative implementation
                  and sustainability.
                </li>
                <li className="list-item mb-[12px]">
                  Develop robust multilingual datasets for inclusive disease
                  monitoring.
                </li>
                <li className="list-item mb-[12px]">
                  Deploy AI models for real-time outbreak detection and
                  forecasting.
                </li>
                <li className="list-item mb-[12px]">
                  Integrate misinformation tracking and public sentiment
                  analysis systems.
                </li>
                <li className="list-item">
                  Conduct capacity-building programs for at least 50 public
                  health practitioners, with 85% demonstrating measurable skill
                  improvement.
                </li>
              </ol>

              <p className="mb-[24px]">
                <strong>ALIGNMENT WITH THE ONE HEALTH FRAMEWORK</strong>
              </p>

              <p className="mb-[24px] text-justify">
                HealthPH+ adopts a One Health approach, recognizing the
                interconnectedness of human, environmental, and community
                health. By integrating environmental signals with social and
                participatory data streams, the system supports a more holistic
                and adaptive surveillance ecosystem.
              </p>

              <p className="mb-[24px]">
                <strong>SUSTAINABLE DEVELOPMENT GOALS</strong>
              </p>

              <p className="mb-[24px] text-justify">
                HealthPH+ directly advances multiple UN SDGs:
              </p>

              <ul className="mb-[24px] list-disc list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[16px]">
                  <strong>SDG 3: Good Health and Well-Being</strong> Strengthens
                  early warning systems and reduces the burden of communicable
                  diseases.
                </li>
                <li className="list-item mb-[16px]">
                  <strong>
                    SDG 9: Industry, Innovation, and Infrastructure
                  </strong>{" "}
                  Enhances scientific research and technological capabilities in
                  public health surveillance.
                </li>
                <li className="list-item mb-[16px]">
                  <strong>SDG 11: Sustainable Cities and Communities</strong>{" "}
                  Improves local preparedness and resilience to public health
                  emergencies.
                </li>
                <li className="list-item">
                  <strong>SDG 17: Partnerships for the Goals</strong> Promotes
                  multisectoral collaboration among government, academia, and
                  communities.
                </li>
              </ul>

              <p className="mb-[24px]">
                <strong>WIDER IMPACT</strong>
              </p>

              <p className="mb-[24px] text-justify">
                HealthPH+ delivers measurable social, technological, and
                institutional benefits:
              </p>

              <ul className="list-disc list-outside pl-[24px] marker:text-gray-700">
                <li className="list-item mb-[12px]">
                  Faster detection of respiratory outbreaks
                </li>
                <li className="list-item mb-[12px]">
                  Improved outbreak forecasting and preparedness
                </li>
                <li className="list-item mb-[12px]">
                  Reduced strain on local healthcare systems
                </li>
                <li className="list-item mb-[12px]">
                  Inclusive surveillance across diverse Philippine languages
                </li>
                <li className="list-item mb-[12px]">
                  Strengthened national healthcare resilience
                </li>
                <li className="list-item">
                  Empowered LGUs and frontline health practitioners
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
};

export default AboutUs;
