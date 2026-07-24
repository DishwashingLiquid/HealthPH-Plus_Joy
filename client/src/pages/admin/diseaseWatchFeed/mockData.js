import {
  AlertDistribution,
  EarlyWarning,
  SymptomReporting,
} from "../../../assets/icons/icons";

export const diseaseWatchFeedTabs = [
  { id: "recent-alerts", label: "Recent Alerts" },
  { id: "regional-coverage", label: "Regional Coverage" },
  { id: "user-analytics", label: "User Analytics" },
];

export const topMetricCards = [
  {
    label: "Alert Distribution",
    value: "847",
    helper: "alerts this week",
    icon: AlertDistribution,
    iconColor: "#ef4444",
  },
  {
    label: "Early Warning",
    value: "23",
    helper: "potential outbreaks",
    icon: EarlyWarning,
    iconColor: "#f59e0b",
  },
  {
    label: "Symptom Report",
    value: "4,250",
    helper: "reports submitted",
    icon: SymptomReporting,
    iconColor: "#3b82f6",
  },
];

export const regionUserData = [
  { region: "NCR", users: 2450, percentage: 15 },
  { region: "Region I", users: 1200, percentage: 7 },
  { region: "Region II", users: 1800, percentage: 11 },
  { region: "Region III", users: 2100, percentage: 13 },
  { region: "Region IV-A", users: 1900, percentage: 11 },
  { region: "Region IV-B", users: 950, percentage: 6 },
  { region: "Region V", users: 1400, percentage: 8 },
  { region: "Region CAR", users: 1100, percentage: 7 },
  { region: "Region VI", users: 1550, percentage: 9 },
  { region: "Region VII", users: 1300, percentage: 8 },
  { region: "Region VIII", users: 980, percentage: 6 },
  { region: "Region IX", users: 1050, percentage: 6 },
  { region: "Region X", users: 1200, percentage: 7 },
  { region: "Region XI", users: 1450, percentage: 9 },
  { region: "Region XII", users: 1100, percentage: 7 },
  { region: "Region XIII (CARAGA)", users: 900, percentage: 5 },
  { region: "BARMM", users: 750, percentage: 4 },
];

export const recentAlerts = [
  {
    id: 1,
    disease: "Dengue Fever",
    region: "NCR",
    type: "Alert Distribution",
    timestamp: "2 hours ago",
    summary: "Significant spike in dengue cases detected in Manila area",
    summarySegments: [
      { type: "text", value: "Significant spike in " },
      { type: "entity", label: "dengue", tone: "disease" },
      { type: "text", value: " cases detected in " },
      { type: "entity", label: "Manila area", tone: "location" },
    ],
  },
  {
    id: 2,
    disease: "COVID-19",
    region: "Region IV-A",
    type: "Early Warning",
    timestamp: "4 hours ago",
    summary:
      "New variant mentions increasing across social media in Calabarzon",
    summarySegments: [
      {
        type: "text",
        value: "New variant mentions increasing across social media in ",
      },
      { type: "entity", label: "Calabarzon", tone: "location" },
    ],
  },
  {
    id: 3,
    disease: "Tuberculosis",
    region: "Region III",
    type: "Symptom Report",
    timestamp: "6 hours ago",
    summary: "Respiratory symptoms trending in Central Luzon region",
    summarySegments: [
      { type: "entity", label: "Respiratory symptoms", tone: "symptom" },
      { type: "text", value: " trending in " },
      {
        type: "entity",
        label: "Central Luzon region",
        tone: "location",
      },
    ],
  },
  {
    id: 4,
    disease: "Influenza",
    region: "NCR",
    type: "Alert Distribution",
    timestamp: "8 hours ago",
    summary: "Seasonal flu activity elevated in Metro Manila",
    summarySegments: [
      { type: "text", value: "Seasonal " },
      { type: "entity", label: "flu", tone: "disease" },
      { type: "text", value: " activity elevated in " },
      { type: "entity", label: "Metro Manila", tone: "location" },
    ],
  },
  {
    id: 5,
    disease: "Measles",
    region: "Region VII",
    type: "Early Warning",
    timestamp: "12 hours ago",
    summary:
      "Outbreak potential detected in Cebu area based on community reports",
    summarySegments: [
      { type: "text", value: "Outbreak potential detected in " },
      { type: "entity", label: "Cebu area", tone: "location" },
      { type: "text", value: " based on community reports" },
    ],
  },
];

export const userAnalytics = {
  totalUsers: {
    current: 16380,
    previous: 14920,
    change: 1460,
    percentage: 9.8,
    trend: "up",
  },
  alertOpenRate: {
    current: 68,
    previous: 61,
    change: 7,
    percentage: 11.5,
    trend: "up",
  },
  symptomReports: {
    current: 4250,
    previous: 3890,
    change: 360,
    percentage: 9.2,
    trend: "up",
  },
};
