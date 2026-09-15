/* eslint-disable react/prop-types */
import HomeNavbar from "../components/HomeNavbar";
import TestimonialsList from "../assets/data/testimonials.json";
import TestimonialItem from "../components/about-us/TestimonialItem";
import HomeFooter from "../components/HomeFooter";
import "../assets/css/about.css";

const ResearchTeam = ({ embedded = false }) => {
  const dostPCHRD = TestimonialsList["dost-pchrd"];
  const researchTeam = TestimonialsList["research-team"];

  const content = (
    <section id={embedded ? "research-team" : undefined} className={embedded ? "public-section public-content-section section-team" : "mt-[56px]"}>
      <div className={embedded ? "public-shell" : "about-container"}>
          <div className="w-full max-w-[360px] md:max-w-[762px] lg:max-w-[1144px] mx-auto">
            {embedded && <p className="public-section-intro">Meet the DOST-PCHRD officials and researchers guiding HealthPH+.</p>}
            <p className="section-title">DOST-PCHRD Officials</p>
            <div className="testimonials mb-[112px]">
              {dostPCHRD.map((v, i) => {
                return <TestimonialItem {...v} key={i} />;
              })}
            </div>
            <p className="section-title">Research Team</p>
            <div className="testimonials">
              {researchTeam.map((v, i) => {
                return <TestimonialItem {...v} key={i} />;
              })}
            </div>
            {/* <p className="section-title">Interns</p>
            <div className="testimonials">
              {interns.map((v, i) => {
                return <TestimonialItem {...v} key={i} />;
              })}
            </div> */}
          </div>
      </div>
    </section>
  );

  if (embedded) return <div className="article-layout research-team-page one-page-section">{content}</div>;

  return <div className="article-layout research-team-page"><HomeNavbar />{content}<HomeFooter /></div>;
};
export default ResearchTeam;
