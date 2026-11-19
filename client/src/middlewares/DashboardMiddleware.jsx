import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasLiveSession } from "../utils/authSession";

const DashboardMiddleware = () => {
  const auth = useSelector((state) => state.auth);
  const location = useLocation();

  // Checks if there is already a logged in user
  // If true, show original page
  // If false, redirect to Login page
  const validSession = auth.user && hasLiveSession();
  return validSession ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location, sessionExpired: auth.sessionExpired || Boolean(auth.user) }} replace />
  );
};
export default DashboardMiddleware;
