import "./App.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ToastContainer } from "react-toastify";

import { authenticateUser } from "./features/auth/authSlice";

import AuthLayout from "./layouts/AuthLayout";
import AdminLayout from "./layouts/AdminLayout";

import DashboardMiddleware from "./middlewares/DashboardMiddleware";
import AuthMiddleware from "./middlewares/AuthMiddleware";

import Articles from "./pages/Articles";
import ArticlePage from "./pages/ArticlePage";
import ContactUs from "./pages/ContactUs";

import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

import AISurveillance from "./pages/admin/AISurveillance";
import NLPInsights from "./pages/admin/NLPInsights";
import MisinformationTracker from "./pages/admin/MisinformationTracker";
import ModelAccessToolkit from "./pages/admin/ModelAccessToolkit";
import Analytics from "./pages/admin/Analytics";
import TrendsMap from "./pages/admin/TrendsMap";
import UploadDataset from "./pages/admin/UploadDataset";
import UserManagement from "./pages/admin/UserManagement";
import Help from "./pages/admin/Help";
import Settings from "./pages/admin/Settings";
import EditEmail from "./pages/admin/EditEmail";
import EditPassword from "./pages/admin/EditPassword";

import PageNotFound from "./pages/error/PageNotFound";
import Test from "./Test";

import HelmetTitle from "./components/HelmetTitle";

import useDeviceDetect from "./hooks/useDeviceDetect";
import FullMap from "./pages/admin/FullMap";
import Print from "./pages/Print";

const Home = lazy(() => import("./pages/Home"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ResearchTeam = lazy(() => import("./pages/ResearchTeam"));
const Login = lazy(() => import("./pages/auth/Login"));
const HealthLiteracyHub = lazy(() =>
  import("./pages/admin/healthLiteracyHub/HealthLiteracyHub")
);
const DiseaseWatchFeed = lazy(() =>
  import("./pages/admin/diseaseWatchFeed/DiseaseWatchFeed")
);
const SentimentPulseTool = lazy(() =>
  import("./pages/admin/sentimentPulseTool/SentimentPulseTool")
);

function App() {
  const user = useSelector((state) => state.auth.user);
  const canManageAccounts =
    user && (user.user_type === "SUPERADMIN" || user.role_label === "Admin");

  const dispatch = useDispatch();

  const [isLoading, setIsLoading] = useState(true);

  const { isPWA } = useDeviceDetect();

  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem("auth"));
    if (auth) {
      dispatch(authenticateUser(auth));
    }
    setIsLoading(false);
  }, []);

  const renderLazyRoute = (title, Component) => (
    <>
      <HelmetTitle title={title} />
      <Suspense fallback={<p>...</p>}>
        <Component />
      </Suspense>
    </>
  );

  return isLoading ? (
    <p>...</p>
  ) : (
    <>
      <Routes>
        <Route path="/test" element={<Test />}></Route>
        <Route path="/" element={<AuthMiddleware />}>
          <Route
            index
            element={
              !isPWA ? (
                renderLazyRoute("HealthPH", Home)
              ) : (
                <Navigate to="/login" />
              )
            }
          ></Route>
          <Route
            path="about-the-project"
            element={
              !isPWA ? (
                renderLazyRoute("HealthPH | About Us", AboutUs)
              ) : (
                <Navigate to="/login" />
              )
            }
          ></Route>
          <Route
            path="articles"
            element={
              !isPWA ? (
                <>
                  <HelmetTitle title="HealthPH | Articles" />
                  <Articles />
                </>
              ) : (
                <Navigate to="/login" />
              )
            }
          ></Route>
          <Route
            path="articles/:slug"
            element={
              !isPWA ? (
                <>
                  <HelmetTitle title="HealthPH | Article Page" />
                  <ArticlePage />
                </>
              ) : (
                <Navigate to="/login" />
              )
            }
          ></Route>
          <Route
            path="research-team"
            element={
              !isPWA ? (
                renderLazyRoute("HealthPH | Research Team", ResearchTeam)
              ) : (
                <Navigate to="/login" />
              )
            }
          ></Route>
          <Route
            path="contact-us"
            element={
              !isPWA ? (
                <>
                  <HelmetTitle title="HealthPH | Contact Us" />
                  <ContactUs />
                </>
              ) : (
                <Navigate to="/login" />
              )
            }
          ></Route>
          <Route
            path="full-map"
            element={
              <>
                <HelmetTitle title="HealthPH | Map" />
                <FullMap />
              </>
            }
          ></Route>
          <Route element={<AuthLayout />}>
            <Route
              path="login"
              element={
                renderLazyRoute("HealthPH | Sign In", Login)
              }
            ></Route>
            <Route
              path="forgot-password"
              element={
                <>
                  <HelmetTitle title="HealthPH | Forgot Password" />
                  <ForgotPassword />
                </>
              }
            ></Route>
            <Route
              path="reset-password/:token"
              element={
                <>
                  <HelmetTitle title="HealthPH | Reset Password" />
                  <ResetPassword />
                </>
              }
            ></Route>
          </Route>
        </Route>
        <Route element={<DashboardMiddleware />}>
          <Route path="/print" element={<Print />} />
          <Route path="/dashboard" element={<AdminLayout />}>
            <Route
              index
              element={
                <>
                  <HelmetTitle title="HealthPH | AI Surveillance" />
                  <AISurveillance />
                </>
              }
            />
            <Route
              path="health-literacy-hub"
              element={
                renderLazyRoute(
                  "HealthPH | Health Literacy Hub",
                  HealthLiteracyHub
                )
              }
            />
            <Route
              path="NLP-insights"
              element={
                <>
                  <HelmetTitle title="HealthPH | NLP Insights" />
                  <NLPInsights />
                </>
              }
            />
            <Route
              path="disease-watch-feed"
              element={
                renderLazyRoute(
                  "HealthPH | Disease Watch Feed",
                  DiseaseWatchFeed
                )
              }
            />
            <Route
              path="misinformation-tracker"
              element={
                <>
                  <HelmetTitle title="HealthPH | Misinformation Tracker" />
                  <MisinformationTracker />
                </>
              }
            />
            <Route
              path="model-access-toolkit"
              element={
                <>
                  <HelmetTitle title="HealthPH | Model Access and Toolkit" />
                  <ModelAccessToolkit />
                </>
              }
            />
            <Route
              path="trends-map"
              element={
                <>
                  <HelmetTitle title="HealthPH | Trends Map" />
                  <TrendsMap />
                </>
              }
            />
            <Route
              path="sentiment-pulse"
              element={
                renderLazyRoute(
                  "HealthPH | Sentiment Pulse Tool",
                  SentimentPulseTool
                )
              }
            />
            <Route
              path="trends-map/upload-dataset"
              element={
                canManageAccounts ? (
                  <>
                    <HelmetTitle title="HealthPH | Upload Dataset" />
                    <UploadDataset />
                  </>
                ) : (
                  <Navigate to="/dashboard" />
                )
              }
            />
            {!isPWA && (
              <Route
                path="user-management"
                element={
                  user ? (
                    <>
                      <HelmetTitle title="HealthPH | User Management" />
                      <UserManagement />
                    </>
                  ) : (
                    <Navigate to="/dashboard" />
                  )
                }
              />
            )}
            {!isPWA && (
              <Route
                path="user-management/add-user"
                element={
                  canManageAccounts ? (
                    <Navigate to="/dashboard/user-management" replace />
                  ) : (
                    <Navigate to="/dashboard" />
                  )
                }
              />
            )}
            <Route
              path="help"
              element={
                <>
                  <HelmetTitle title="HealthPH | Help" />
                  <Help />
                </>
              }
            />
            <Route
              path="activity-logs"
              element={<Navigate to="/dashboard/user-management" replace />}
            />
            <Route
              path="settings"
              element={
                <>
                  <HelmetTitle title="HealthPH | Settings" />
                  <Settings />
                </>
              }
            />
            <Route
              path="settings/edit-email"
              element={
                <>
                  <HelmetTitle title="HealthPH | Edit Email" />
                  <EditEmail />
                </>
              }
            />
            <Route
              path="settings/edit-password"
              element={
                <>
                  <HelmetTitle title="HealthPH | Edit Password" />
                  <EditPassword />
                </>
              }
            />
            <Route
              path="*"
              element={
                <>
                  <HelmetTitle title="HealthPH | Page Not Found" />
                  <PageNotFound />
                </>
              }
            />
          </Route>
          {/* <Route path="/*" element={<AdminLayout />}>
            <Route
              path="*"
              element={
                <>
                  <HelmetTitle title="HealthPH | Page Not Found" />
                  <PageNotFound />
                </>
              }
            />
          </Route> */}
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {/* TOAST CONTAINER */}
      <ToastContainer
        hideProgressBar
        pauseOnHover={false}
        autoClose={3000}
        className="snackbar-wrapper"
      />
    </>
  );
}

export default App;
