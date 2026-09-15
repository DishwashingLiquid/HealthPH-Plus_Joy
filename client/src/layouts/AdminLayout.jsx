import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/admin/Navbar";
import Sidebar from "../components/admin/Sidebar";
import { useSelector } from "react-redux";
import AccessDenied from "../pages/error/AccessDenied";

import { useState } from "react";
import "../assets/css/navbar.css";
import "../assets/css/admin.css";

const AdminLayout = () => {
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
    {/* comment out temp: transitioning from navbar to sidebar */}
      {/* <div className="admin-layout flex flex-col max-h-screen h-screen bg-[#F5F5F5] overflow-y-hidden">
        <Navbar />
        {user.is_disabled ? (
          <main className="w-full p-[20px]">
            <AccessDenied />
          </main>
        ) : ["/dashboard/trends-map"].includes(location.pathname) ? (
          <main className="w-full">
            <Outlet />
          </main>
        ) : (
          <main className="w-full p-[20px]">
            <Outlet />
          </main>
        )}
      </div> */}
    <div
      className="admin-layout flex flex-col max-h-screen h-screen bg-[#F5F5F5] overflow-y-hidden"
      style={{
        "--admin-sidebar-width": sidebarOpen ? "270px" : "72px",
      }}
    >
      <Navbar/>

      <div className="flex flex-grow overflow-hidden">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {user.is_disabled ? (
          <main className="w-full p-[20px] overflow-y-auto">
            <AccessDenied />
          </main>
        ) : ["/dashboard/trends-map"].includes(location.pathname) ? (
          <main className="w-full overflow-y-auto">
            <Outlet />
          </main>
        ) : (
          <main className="w-full p-[20px] overflow-y-auto">
            <Outlet />
          </main>
        )}
      </div>
    </div>
    </>
  );
};
export default AdminLayout;
