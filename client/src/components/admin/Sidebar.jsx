/* eslint-disable react/prop-types */
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";

import Icon from "../Icon";
import {
  ROLE_PAGES,
  hasRolePageAccess,
} from "../../utils/rolePageAccess";

const NAVIGATION_SECTIONS = [
  {
    label: "Main",
    items: [
      { page: ROLE_PAGES.AI_SURVEILLANCE, to: "/dashboard", icon: "PanelsTopLeft", end: true },
      { page: ROLE_PAGES.NLP_INSIGHTS, to: "/dashboard/nlp-insights", icon: "Languages" },
      { page: ROLE_PAGES.MISINFORMATION_TRACKER, to: "/dashboard/misinformation-tracker", icon: "CircleAlert" },
      { page: ROLE_PAGES.USER_MANAGEMENT, to: "/dashboard/user-management", icon: "Users" },
      {
        page: ROLE_PAGES.MODEL_ACCESS_TOOLKIT,
        to: "/dashboard/model-access-toolkit",
        icon: "Database",
        label: "Model Access & Toolkit",
      },
    ],
  },
  {
    label: "Mobile Integration",
    items: [
      { page: ROLE_PAGES.DISEASE_WATCH_FEED, to: "/dashboard/disease-watch-feed", icon: "Stethoscope" },
      { page: ROLE_PAGES.HEALTH_LITERACY_HUB, to: "/dashboard/health-literacy-hub", icon: "Heart" },
      { page: ROLE_PAGES.SENTIMENT_PULSE_TOOL, to: "/dashboard/sentiment-pulse", icon: "SquareActivity" },
    ],
  },
];

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const user = useSelector((state) => state.auth.user);

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-[12px] px-[12px] py-[10px] rounded-md transition ${
      isActive
        ? "bg-primary-50 text-primary-600 font-medium"
        : "text-gray-900 hover:bg-gray-10"
    }`;

  const iconColor = (isActive) => (isActive ? "#0064D1" : "#5A6876");

  return (
    <aside
      className={`${
        sidebarOpen ? "w-[270px]" : "w-[72px]"
      } h-full bg-white border-r border-[#E5E5E5] overflow-hidden px-[12px] py-[16px] flex-shrink-0 transition-all duration-1000`}
    >
      <div className="flex items-center justify-between px-[12px] mb-[12px]">
        {sidebarOpen && (
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Navigation
          </p>
        )}
        <button
          type="button"
          className="h-[28px] w-[28px] flex items-center justify-center rounded-[6px] hover:bg-gray-100 text-gray-500"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          ☰
        </button>
      </div>

      {NAVIGATION_SECTIONS.map((section) => {
        const accessibleItems = section.items.filter((item) =>
          hasRolePageAccess(user, item.page)
        );

        if (accessibleItems.length === 0) return null;

        return (
          <div key={section.label} className="mb-[20px]">
            {sidebarOpen && (
              <p className="text-xs uppercase text-gray-500 px-[12px] mb-[8px]">
                {section.label}
              </p>
            )}
            <nav className="flex flex-col gap-[4px]">
              {accessibleItems.map((item) => (
                <NavLink
                  key={item.page}
                  to={item.to}
                  end={item.end}
                  className={navItemClass}
                  title={!sidebarOpen ? item.label || item.page : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        iconName={item.icon}
                        height="20px"
                        width="20px"
                        fill="none"
                        stroke={iconColor(isActive)}
                      />
                      {sidebarOpen && <span>{item.label || item.page}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        );
      })}
    </aside>
  );
};

export default Sidebar;
