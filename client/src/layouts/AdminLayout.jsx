import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";

import Navbar from "../components/admin/Navbar";
import Sidebar from "../components/admin/Sidebar";
import AccessDenied from "../pages/error/AccessDenied";

import "../assets/css/navbar.css";
import "../assets/css/admin.css";

const AdminLayout = () => {
  const user = useSelector((state) => state.auth.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("admin-active");

    return () => {
      document.documentElement.classList.remove("admin-active");
    };
  }, []);

  return (
    <div
      className="admin-layout internal-buttons flex flex-col max-h-screen h-screen bg-[#F5F5F5] overflow-y-hidden"
      style={{
        "--admin-sidebar-width": sidebarOpen ? "270px" : "72px",
      }}
    >
      <Navbar />

      <div className="flex flex-grow overflow-hidden">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <main className="w-full p-[20px] overflow-y-auto">
          {user.is_disabled ? <AccessDenied /> : <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;