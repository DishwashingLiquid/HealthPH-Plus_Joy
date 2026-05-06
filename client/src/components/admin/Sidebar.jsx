import { NavLink } from "react-router-dom";
import Icon from "../Icon";

const Sidebar = () => {
    return (
        <aside className="w-[270px] h-full bg-white border-r border-[#E5E5E5] p-[12px] flex-shrink-0">
            <div className="mb-[20px]">
                <p className="text-xs uppercase text-gray-500 px-[12px] mb-[8px]">
                    Main
                </p>

                <nav className="flex flex-col gap-[4px]">
                    <NavLink to="/dashboard" end className="px-[12px] py-[10px] rounded-md">
                        AI Surveillance
                    </NavLink>
                    <NavLink to="/dashboard/nlp-insights" className="px-[12px] py-[10px] rounded-md">
                        NLP Insights
                    </NavLink>
                    <NavLink to="/dashboard/misinformation-tracker" className="px-[12px] py-[10px] rounded-md">
                        Misinformation Tracker
                    </NavLink>
                    <NavLink to="/dashboard/user-management" className="px-[12px] py-[10px] rounded-md">
                        User Management
                    </NavLink>
                    <NavLink to="/dashboard/model-toolkit" className="px-[12px] py-[10px] rounded-md">
                        Model Access and Toolkit
                    </NavLink>
                </nav>
            </div>

            <div>
                <p className="text-xs uppercase text-gray-500 px-[12px] mb-[8px]">
                    Mobile Integration
                </p>

                <nav className="flex flex-col gap-[4px]">
                    <NavLink to="/dashboard/disease-watch-feed" className="px-[12px] py-[10px] rounded-md">
                        Disease Watch Feed
                    </NavLink>
                    <NavLink to="/dashboard/health-literacy-hub" className="px-[12px] py-[10px] rounded-md">
                        Health Literacy Hub
                    </NavLink>
                    <NavLink to="/dashboard/sentiment-pulse" className="px-[12px] py-[10px] rounded-md">
                        Sentiment Pulse Tool
                    </NavLink>
                </nav>
            </div>
        </aside>    
    );
};

export default Sidebar;