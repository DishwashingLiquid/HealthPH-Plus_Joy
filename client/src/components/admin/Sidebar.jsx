import { NavLink } from "react-router-dom";
import Icon from "../Icon";
import { icon } from "leaflet";

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const navItemClass = ({ isActive }) =>
        `flex items-center gap-[12px] px-[12px] py-[10px] rounded-md transition ${
            isActive
                ? "bg-primary-50 text-primary-600 font-medium"
                : "text-gray-900 hover:bg-gray-10"
        }`;

    const iconColor = (isActive) => (isActive ? "#0064D1" : "#5A6876");

    return (
        <aside className={`${
            sidebarOpen ? "w-[270px]" : "w-[72px]"
            } h-full bg-white border-r border-[#E5E5E5] overflow-hidden px-[12px] py-[16px] flex-shrink-0 transition-all duration-1000`}>
            <div className="mb-[20px]">
                <div className="flex items-center justify-between px-[12px] mb-[12px]">
                    {sidebarOpen && (
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                            Main
                        </p>
                    )}
                    <button
                        type="button"
                        className="h-[28px] w-[28px] flex items-center justify-center rounded-[6px] hover:bg-gray-100 text-gray-500"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        ☰
                    </button>
                </div>
                <nav className="flex flex-col gap-[4px]">
                    <NavLink to="/dashboard" end className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon 
                                    iconName="Analytics"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>AI Surveillance</span>}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/dashboard/nlp-insights" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="TowerLine"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>NLP Insights</span>}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/dashboard/misinformation-tracker" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="Megaphone"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>Misinformation Tracker</span>}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/dashboard/user-management" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="UserThree"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>User Management</span>}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/dashboard/model-access-toolkit" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="Settings"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>Model Access and Toolkit</span>}
                            </>
                        )}
                    </NavLink>
                </nav>
            </div>

            <div>
                {sidebarOpen && (
                <p className="text-xs uppercase text-gray-500 px-[12px] mb-[8px]">
                    Mobile Integration
                </p>
                )}
                <nav className="flex flex-col gap-[4px]">
                    <NavLink to="/dashboard/disease-watch-feed" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="Stethoscope"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>Disease Watch Feed</span>}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/dashboard/health-literacy-hub" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="Document"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>Health Literacy Hub</span>}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/dashboard/sentiment-pulse" className={navItemClass}>
                        {({ isActive }) => (
                            <>
                                <Icon
                                    iconName="ActivityLog"
                                    height="20px"
                                    width="20px"
                                    fill={iconColor(isActive)}
                                />
                                {sidebarOpen && <span>Sentiment Pulse Tool</span>}
                            </>
                        )}
                    </NavLink>
                </nav>
            </div>
        </aside>    
    );
};

export default Sidebar;