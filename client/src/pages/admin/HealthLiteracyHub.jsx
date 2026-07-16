import { useState } from "react";
import Icon from "../../components/Icon";
import AnalyticsTab from "./healthLiteracyHub/AnalyticsTab";
import ArticlesTab from "./healthLiteracyHub/ArticlesTab";
import InfographicsTab from "./healthLiteracyHub/InfographicsTab";
import VideosTab from "./healthLiteracyHub/VideosTab";
import { ILLUSTRATIONS } from "./healthLiteracyHub/shared";
import {
  DASHBOARD_PAGE_SUBTITLE_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "./dashboardTypography";

const TABS = [
  { id: "Articles", label: "Articles", Component: ArticlesTab },
  { id: "Videos", label: "Videos", Component: VideosTab },
  { id: "Infographics", label: "Infographics", Component: InfographicsTab },
  { id: "HealthLiteracyAnalytics", label: "Analytics", Component: AnalyticsTab },
];

const HealthLiteracyHub = () => {
  const [activeTab, setActiveTab] = useState("Articles");
  const ActiveTabComponent =
    TABS.find((tab) => tab.id === activeTab)?.Component ?? ArticlesTab;

  return (
    <div className="flex flex-col gap-[20px]">
      <div>
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>
          Health Literacy Hub
        </h1>
        <p className={`${DASHBOARD_PAGE_SUBTITLE_CLASS} mt-[4px]`}>
          Access educational resources, multilingual content, and community
          insights to enhance your health knowledge.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px]">
        {ILLUSTRATIONS.map((illustration) => (
          <div
            key={illustration.id}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] flex flex-col items-center justify-center text-center"
          >
            <div className="mb-[16px]">
              <Icon
                iconName={illustration.icon}
                height="48px"
                width="48px"
                fill="#6A8EB5"
              />
            </div>
            <h3 className={`${DASHBOARD_SECTION_TITLE_CLASS} mb-[8px]`}>
              {illustration.title}
            </h3>
            <p className="text-[14px] text-gray-500">
              {illustration.description}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <ActiveTabComponent key={activeTab} />
    </div>
  );
};

export default HealthLiteracyHub;
