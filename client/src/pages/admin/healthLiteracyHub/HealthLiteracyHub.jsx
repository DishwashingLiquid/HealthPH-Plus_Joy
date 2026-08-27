import { useState } from "react";
import Icon from "../../../components/Icon";
import AnalyticsTab from "./AnalyticsTab";
import ArticlesTab from "./ArticlesTab";
import InfographicsTab from "./InfographicsTab";
import VideosTab from "./VideosTab";
import { ILLUSTRATIONS } from "./shared";

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
    <div className="flex flex-col gap-[10px]">
      <div>
        <h1 className="text-[24px] font-semibold text-gray-800">
          Health Literacy Hub
        </h1>
        <p className="text-[14px] text-gray-500">
          Access educational resources, multilingual content, and community
          insights to enhance your health knowledge.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-3">
        {ILLUSTRATIONS.map((illustration) => (
          <div
            key={illustration.id}
            className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]"
          >
            <div className="flex items-start gap-[14px]">
              <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] bg-[#F5F8FD]">
                <Icon
                  iconName={illustration.icon}
                  height="24px"
                  width="24px"
                  fill="#32418C"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-gray-800">
                  {illustration.title}
                </h3>
                <p className="mt-[6px] text-[14px] leading-[20px] text-gray-500">
                  {illustration.description}
                </p>
              </div>
            </div>
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
