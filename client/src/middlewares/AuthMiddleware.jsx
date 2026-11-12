import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getPostLoginPath, hasLiveSession } from "../utils/authSession";

const AuthMiddleware = () => {
  const auth = useSelector((state) => state.auth);
  const location = useLocation().state;

  // Checks if there is already a logged in user
  // If true, redirect to dashboard
  // If false, show original page
  return auth.user && hasLiveSession() ? (
    <Navigate to={getPostLoginPath(location?.from)} replace />
  ) : (
    <Outlet />
  );
};
export default AuthMiddleware;
