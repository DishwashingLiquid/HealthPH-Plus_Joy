import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import Cookies from "js-cookie";
import { expireSession } from "../auth/authSlice";
import { clearSessionStorage, hasLiveSession } from "../../utils/authSession";

const apiUrl = import.meta.env.VITE_API_URL;

const rawBaseQuery = fetchBaseQuery({
    baseUrl: apiUrl,
    prepareHeaders: (headers) => {
      const token = Cookies.get("token");

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return headers;
    },
});

const baseQueryWithSession = async (args, api, extraOptions) => {
  const token = Cookies.get("token");
  const requestUser = api.getState().auth?.user;
  const url = typeof args === "string" ? args : args.url;
  const isAuthRequest = /^\/?auth(?:\/|$)/.test(url);
  const endSession = () => {
    clearSessionStorage();
    api.dispatch(expireSession());
    api.dispatch(baseAPI.util.resetApiState());
  };

  if (requestUser && !isAuthRequest && !hasLiveSession(token)) {
    endSession();
    return { error: { status: 401, data: { detail: "Your session has ended. Please sign in again." } } };
  }

  const result = await rawBaseQuery(args, api, extraOptions);
  // A late failure from an older login must never clear a newly issued session.
  if (result.error?.status === 401 && requestUser && !isAuthRequest &&
      api.getState().auth?.user && token === Cookies.get("token")) {
    endSession();
  }
  return result;
};

export const baseAPI = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithSession,
  tagTypes: [
    "Object",
    "Objects",
    "Auth",
    "Users",
    "User",
    "Admins",
    "Admin",
    "Organizations",
    "Organization",
    "RoleLabels",
    "RoleLabel",
    "AccountActivity",
    "AccountAnalytics",
    "AnalyticsSuspected",
    "AnalyticsFrequent",
    "AnalyticsPercentage",
    "AnalyticsWordcloud",
    "Datasets",
    "Datasets",
    "AnalyticsEntries",
    "ModelEvaluations",
    "ModelTrainingLogs",
    "Points",
    "PointsDisease",
    "HealthLiteracyContent",
    "HealthLiteracyAnalyticsOverview",
    "SentimentPulseRegionalAnalysis",
    "SentimentPulseSurveys",
    "RegionalSymptomSummaries",
    "RegionalAlerts",
  ],
  endpoints: () => ({}),
});
