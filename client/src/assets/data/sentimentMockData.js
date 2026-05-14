// Mock data for Sentiment Pulse Tool
// TODO: Replace with actual API calls when backend is ready
import RegionsData from "./regions.json";

// Philippine regions
export const REGIONS = RegionsData.regions;

// Current sentiment score and stats
export const sentimentStats = {
  currentScore: 68,
  previousScore: 64,
  comparisonRate: 6.25, // (68-64)/64 * 100
  
  surveyResponses: 12847,
  previousResponses: 12341,
  responsesComparisonRate: 4.1,
  
  activeRegions: 15,
  totalRegions: 17,
  regionsComparisonRate: 8.3, // 2 more regions active than previous
  
  lastUpdateTime: "2 hours ago",
  nextUpdateTime: "4 hours",
  nextUpdateTimestamp: Date.now() + 4 * 60 * 60 * 1000, // 4 hours from now
};

// Sentiment trends data for line chart (last 30 days)
export const sentimentTrendsData = [
  { date: "May 1", concerned: 15, proactive: 42, misinformed: 18, neutral: 25 },
  { date: "May 2", concerned: 14, proactive: 44, misinformed: 17, neutral: 25 },
  { date: "May 3", concerned: 16, proactive: 41, misinformed: 19, neutral: 24 },
  { date: "May 4", concerned: 13, proactive: 45, misinformed: 16, neutral: 26 },
  { date: "May 5", concerned: 15, proactive: 43, misinformed: 18, neutral: 24 },
  { date: "May 6", concerned: 17, proactive: 40, misinformed: 20, neutral: 23 },
  { date: "May 7", concerned: 14, proactive: 46, misinformed: 15, neutral: 25 },
  { date: "May 8", concerned: 16, proactive: 42, misinformed: 19, neutral: 23 },
  { date: "May 9", concerned: 15, proactive: 43, misinformed: 18, neutral: 24 },
  { date: "May 10", concerned: 14, proactive: 44, misinformed: 17, neutral: 25 },
  { date: "May 11", concerned: 18, proactive: 39, misinformed: 22, neutral: 21 },
  { date: "May 12", concerned: 16, proactive: 42, misinformed: 19, neutral: 23 },
  { date: "May 13", concerned: 15, proactive: 44, misinformed: 17, neutral: 24 },
  { date: "May 14", concerned: 14, proactive: 45, misinformed: 16, neutral: 25 },
];

// Sentiment categories breakdown (current)
export const sentimentCategories = [
  { name: "Concerned", value: 15, color: "#EF4444", percentage: 15 },
  { name: "Proactive", value: 45, color: "#22C55E", percentage: 45 },
  { name: "Misinformed", value: 16, color: "#F97316", percentage: 16 },
  { name: "Neutral", value: 24, color: "#9CA3AF", percentage: 24 },
];

// Top health topics with concerns count
export const topHealthTopics = [
  { topic: "COVID-19 Variants", concerns: 1823 },
  { topic: "Mental Health Support", concerns: 1645 },
  { topic: "Vaccination Safety", concerns: 1432 },
  { topic: "Nutrition & Diet", concerns: 1287 },
  { topic: "Healthcare Access", concerns: 1156 },
  { topic: "Antibiotics Resistance", concerns: 945 },
  { topic: "Maternal Health", concerns: 823 },
];

// Regional sentiment data
export const regionalSentimentData = {
  NCR: {
    region: "NCR",
    responses: 2156,
    previousResponses: 2045,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 14, proactive: 47, misinformed: 15, neutral: 24 },
    trend: 5.4,
  },
  I: {
    region: "I",
    responses: 567,
    previousResponses: 545,
    dominantSentiment: "Neutral",
    sentimentBreakdown: { concerned: 13, proactive: 40, misinformed: 17, neutral: 30 },
    trend: 4.0,
  },
  II: {
    region: "II",
    responses: 456,
    previousResponses: 421,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 16, proactive: 42, misinformed: 18, neutral: 24 },
    trend: 8.3,
  },
  III: {
    region: "III",
    responses: 1234,
    previousResponses: 1156,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 14, proactive: 46, misinformed: 16, neutral: 24 },
    trend: 6.7,
  },
  IVA: {
    region: "IVA",
    responses: 892,
    previousResponses: 845,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 12, proactive: 48, misinformed: 14, neutral: 26 },
    trend: 5.6,
  },
  IVB: {
    region: "IVB",
    responses: 389,
    previousResponses: 401,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 17, proactive: 41, misinformed: 21, neutral: 21 },
    trend: -3.0,
  },
  V: {
    region: "V",
    responses: 0,
    previousResponses: 312,
    dominantSentiment: "Neutral",
    sentimentBreakdown: { concerned: 0, proactive: 0, misinformed: 0, neutral: 0 },
    trend: -100,
  },
  CAR: {
    region: "CAR",
    responses: 334,
    previousResponses: 0,
    dominantSentiment: "Neutral",
    sentimentBreakdown: { concerned: 12, proactive: 42, misinformed: 17, neutral: 29 },
    trend: 100,
  },
  VI: {
    region: "VI",
    responses: 445,
    previousResponses: 456,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 13, proactive: 45, misinformed: 16, neutral: 26 },
    trend: -2.4,
  },
  VII: {
    region: "VII",
    responses: 876,
    previousResponses: 834,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 15, proactive: 44, misinformed: 18, neutral: 23 },
    trend: 5.0,
  },
  VIII: {
    region: "VIII",
    responses: 678,
    previousResponses: 689,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 15, proactive: 43, misinformed: 19, neutral: 23 },
    trend: -1.6,
  },
  IX: {
    region: "IX",
    responses: 421,
    previousResponses: 398,
    dominantSentiment: "Concerned",
    sentimentBreakdown: { concerned: 19, proactive: 39, misinformed: 21, neutral: 21 },
    trend: 5.8,
  },
  X: {
    region: "X",
    responses: 623,
    previousResponses: 598,
    dominantSentiment: "Concerned",
    sentimentBreakdown: { concerned: 22, proactive: 38, misinformed: 22, neutral: 18 },
    trend: 4.2,
  },
  XI: {
    region: "XI",
    responses: 1045,
    previousResponses: 998,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 18, proactive: 44, misinformed: 20, neutral: 18 },
    trend: 4.7,
  },
  XII: {
    region: "XII",
    responses: 534,
    previousResponses: 512,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 15, proactive: 44, misinformed: 18, neutral: 23 },
    trend: 4.3,
  },
  XIII: {
    region: "XIII",
    responses: 389,
    previousResponses: 0,
    dominantSentiment: "Proactive",
    sentimentBreakdown: { concerned: 16, proactive: 43, misinformed: 19, neutral: 22 },
    trend: 100,
  },
  BARMM: {
    region: "BARMM",
    responses: 512,
    previousResponses: 489,
    dominantSentiment: "Neutral",
    sentimentBreakdown: { concerned: 14, proactive: 41, misinformed: 19, neutral: 26 },
    trend: 4.7,
  },
};

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
  if (percentage > 0) {
    return { arrow: "↑", color: "text-green-600" };
  } else if (percentage < 0) {
    return { arrow: "↓", color: "text-red-600" };
  }
  return { arrow: "→", color: "text-gray-500" };
};

// Helper function to format percentage
export const formatPercentage = (value) => {
  return Math.abs(value).toFixed(1);
};

// Helper function to format numbers
export const formatNumber = (value) => {
  return value.toLocaleString();
};

// Helper function to get time difference
export const getTimeDifference = (timestamp) => {
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
