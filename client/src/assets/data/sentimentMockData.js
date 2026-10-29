// Mock data for Sentiment Pulse Tool
// TODO: Replace with actual API calls when backend is ready
import RegionsData from "./regions.json";

// Philippine regions
export const REGIONS = RegionsData.regions;

export const sentimentStats = {};
export const sentimentTrendsData = [];
export const sentimentCategories = [];
export const topHealthTopics = [];
export const regionalSentimentData = {};

// Mobile surveys data
export const mobileSurveys = [
  {
    id: 1,
    title: "COVID-19 Vaccination Awareness",
    status: "Active",
    subtitle: "Understanding public perception on vaccine safety and effectiveness",
    responses: 2340,
    target: 2500,
    sentimentBreakdown: { concerned: 18, proactive: 46, misinformed: 14, neutral: 22 },
    dominantSentiment: "Proactive",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  },
  {
    id: 2,
    title: "Mental Health Support Services",
    status: "Active",
    subtitle: "Assessing accessibility and awareness of mental health resources",
    responses: 1856,
    target: 2000,
    sentimentBreakdown: { concerned: 22, proactive: 42, misinformed: 16, neutral: 20 },
    dominantSentiment: "Proactive",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
  },
  {
    id: 3,
    title: "Healthcare Access in Rural Areas",
    status: "Active",
    subtitle: "Evaluating barriers to healthcare services in underserved communities",
    responses: 1234,
    target: 1500,
    sentimentBreakdown: { concerned: 28, proactive: 38, misinformed: 19, neutral: 15 },
    dominantSentiment: "Concerned",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
  },
  {
    id: 4,
    title: "Nutrition and Diet Awareness",
    status: "Active",
    subtitle: "Gathering insights on public knowledge about balanced nutrition",
    responses: 945,
    target: 1000,
    sentimentBreakdown: { concerned: 16, proactive: 44, misinformed: 22, neutral: 18 },
    dominantSentiment: "Proactive",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
  {
    id: 5,
    title: "Antibiotic Resistance Knowledge",
    status: "Inactive",
    subtitle: "Survey on public understanding of antibiotic resistance risks",
    responses: 623,
    target: 800,
    sentimentBreakdown: { concerned: 25, proactive: 35, misinformed: 26, neutral: 14 },
    dominantSentiment: "Misinformed",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
  },
  {
    id: 6,
    title: "Maternal Health Support",
    status: "Active",
    subtitle: "Understanding maternal health concerns and support needs",
    responses: 534,
    target: 600,
    sentimentBreakdown: { concerned: 20, proactive: 45, misinformed: 12, neutral: 23 },
    dominantSentiment: "Proactive",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  },
];

// Sentiment color mapping
export const sentimentColors = {
  Concerned: "#EF4444", // red
  Proactive: "#22C55E", // green
  Misinformed: "#F97316", // orange
  Neutral: "#9CA3AF", // gray
};

// Helper function to get trend arrow and color
export const getTrendIndicator = (percentage) => {
  if (!Number.isFinite(Number(percentage))) {
    return { arrow: "", color: "text-gray-500" };
  }

  if (percentage > 0) {
    return { arrow: "↑", color: "text-green-600" };
  } else if (percentage < 0) {
    return { arrow: "↓", color: "text-red-600" };
  }
  return { arrow: "→", color: "text-gray-500" };
};

// Helper function to format percentage
export const formatPercentage = (value) => {
  if (!Number.isFinite(Number(value))) {
    return "";
  }

  return Math.abs(value).toFixed(1);
};

// Helper function to format numbers
export const formatNumber = (value) => {
  if (!Number.isFinite(Number(value))) {
    return "";
  }

  return value.toLocaleString();
};

// Helper function to get time difference
export const getTimeDifference = (timestamp) => {
  if (!Number.isFinite(Number(timestamp))) {
    return "";
  }

  const now = Date.now();
  const diff = timestamp - now;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
};

export default {
  REGIONS,
  sentimentStats,
  sentimentTrendsData,
  sentimentCategories,
  topHealthTopics,
  regionalSentimentData,
  mobileSurveys,
  sentimentColors,
  getTrendIndicator,
  formatPercentage,
  formatNumber,
  getTimeDifference,
};
