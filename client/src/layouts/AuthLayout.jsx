import { Outlet } from "react-router-dom";
import Icon from "../components/Icon";
import "../assets/css/auth.css";

const AuthLayout = () => {
  return (
    <>
      <div className="auth-layout">
        <main>
          <div className="auth-container">
            <Outlet />
          </div>
          <footer className="auth-footer">
            <span>&#169; 2026 HealthPH+. All Rights reserved.</span>
            <a
              href={"mailto:" + import.meta.env.VITE_HEALTHPH_EMAIL}
              className="flex items-center"
            >
              <Icon
                iconName="Mail"
                height="16px"
                width="16px"
                fill="#8693A0"
                className="me-[8px]"
              />
              <span>{import.meta.env.VITE_HEALTHPH_EMAIL}</span>
            </a>
          </footer>
        </main>
        <div className="content"></div>
        <div className="background"></div>
      </div>
    </>
  );
};
export default AuthLayout;
