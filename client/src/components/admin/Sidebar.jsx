import { NavLink } from "react-router-dom";
import Icon from "../Icon";

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    return (
        <aside className={`${
            sidebarOpen ? "w-[270px]" : "w-[72px]"
            } h-full bg-white border-r border[#E5E5E5] overflow-hidden px-[16px] flex-shrink-0 transition-all duration-500`}>
            <div className="mb-[20px]">
                <div className="flex items-center justify-between my-[18px]">
                    {sidebarOpen && (
                        <p className="text-[20px] font-semibold text-gray-800">
                            HealthPH+
                        </p>
                    )}

                    <button
                        type="button"
                        className="h-[36px] w-[36px] flex items-center justify-center rounded-[8px] hover:bg-gray-100"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        ☰
                    </button>
                </div>
                {sidebarOpen && (
                <p className="text-xs uppercase text-gray-500 px-[12px] mb-[8px]">
                    Main
                </p>
                )}
                <nav className="flex flex-col gap-[4px]">
                    <NavLink to="/dashboard" end className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "AI Surveillance"}
                    </NavLink>
                    <NavLink to="/dashboard/nlp-insights" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "NLP Insights"}
                    </NavLink>
                    <NavLink to="/dashboard/misinformation-tracker" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "Misinformation Tracker"}
                    </NavLink>
                    <NavLink to="/dashboard/user-management" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "User Management"}
                    </NavLink>
                    <NavLink to="/dashboard/model-toolkit" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "Model Access and Toolkit"}
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
                    <NavLink to="/dashboard/disease-watch-feed" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "Disease Watch Feed"}
                    </NavLink>
                    <NavLink to="/dashboard/health-literacy-hub" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "Health Literacy Hub"}
                    </NavLink>
                    <NavLink to="/dashboard/sentiment-pulse" className="px-[12px] py-[10px] rounded-md">
                        {sidebarOpen && "Sentiment Pulse Tool"}
                    </NavLink>
                </nav>
            </div>
        </aside>    
    );
};

export default Sidebar;