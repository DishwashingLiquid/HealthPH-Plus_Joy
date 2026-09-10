import HomeNavbar from "../components/HomeNavbar.jsx";

const Home = () => {
  return (
    <div className="home-layout">
      <HomeNavbar />
      <main className="flex-grow pb-[96px] flex justify-center items-center">
        <div className="header">
          <p className="heading">
            HealthPH+: Machine Learning and Multilingual NLP for Intelligent Public Health Surveillance
          </p>
          <p className="subheading">Innovating AI Solutions for Better Public Health</p>
        </div>
      </main>
    </div>
  );
};
export default Home;
