import RegionsData from "../../../../assets/data/regions.json";

export const TAB_CONTENT_TYPES = {
  Articles: "articles",
  Videos: "videos",
  Infographics: "infographics",
};

export const UPLOAD_RULES = {
  Articles: {
    label: "Article Asset Upload",
    accept: "image/*,video/*,application/pdf",
    helperText: "JPG, PNG, WEBP, MP4, MOV, WEBM, PDF",
    allowedTypes: ["image/", "video/", "application/pdf"],
  },
  Infographics: {
    label: "Image Upload",
    accept: "image/*",
    helperText: "JPG, PNG, GIF, WEBP",
    allowedTypes: ["image/"],
  },
  Videos: {
    label: "Video Upload",
    accept: "video/*",
    helperText: "MP4, MOV, WEBM",
    allowedTypes: ["video/"],
  },
};

export const INITIAL_FORM_DATA = {
  title: "",
  description: "",
  tags: "",
  topics: "",
  diseases: "",
  language: "en",
  source: "",
  author: "",
  publishedDate: "",
  externalUrl: "",
  imageUrl: "",
  mediaUrl: "",
  media: null,
  mediaPreview: null,
  existingMedia: null,
  duration: "",
  removeMedia: false,
  publishToMobile: false,
  publishToWebsite: false,
  isFactCheck: false,
  claim: "",
  claimStatus: "Needs Expert Review",
  verifiedBy: "Project Researcher",
};

export const FACT_CHECK_CLAIM_STATUS_OPTIONS = [
  { value: "False", label: "False" },
  { value: "Misleading", label: "Misleading" },
  { value: "Verified", label: "Verified" },
  { value: "Needs Expert Review", label: "Needs Expert Review" },
];

export const FACT_CHECK_VERIFIED_BY_OPTIONS = [
  { value: "DOH", label: "DOH" },
  { value: "Medical Expert", label: "Medical Expert" },
  { value: "Project Researcher", label: "Project Researcher" },
];

export const HEALTH_LITERACY_LANGUAGE_LIMIT = 5;

export const HEALTH_LITERACY_LANGUAGE_OPTIONS = [
  ["en", "English"],
  ["fil", "Filipino"],
  ["ceb", "Cebuano"],
  ["ilo", "Ilocano"],
  ["hil", "Hiligaynon"],
].map(([value, label], index) => ({
  value,
  label,
  order: index,
}));

export const ANALYTICS_TIME_RANGES = [
  { value: "last-7-days", label: "Last 7 days", days: 7 },
  { value: "last-30-days", label: "Last 30 days", days: 30 },
  { value: "last-90-days", label: "Last 90 days", days: 90 },
  { value: "all-time", label: "All time", days: null },
];

export const ANALYTICS_CONTENT_FILTERS = [
  { value: "all", label: "All content" },
  { value: "Articles", label: "Articles" },
  { value: "Videos", label: "Videos" },
  { value: "Infographics", label: "Infographics" },
];

export const ANALYTICS_REGIONS = RegionsData.regions;

export const HEALTH_LITERACY_VISITOR_ID_KEY = "healthLiteracyVisitorId";

export const ILLUSTRATIONS = [
  {
    id: 1,
    title: "Educational Content",
    icon: "Heart",
    iconColor: "#EF4444",
    description: "Verified health information in easy-to-understand formats",
  },
  {
    id: 2,
    title: "Multilingual Resources",
    icon: "Languages",
    iconColor: "#22C55E",
    description: "Content translated into major Philippine languages",
  },
  {
    id: 3,
    title: "Community Q&A",
    icon: "MessageSquare",
    iconColor: "#3B82F6",
    description: "Expert responses to common health questions",
  },
];

export const DEFAULT_ANALYTICS_OVERVIEW = {
  totalContentInteractions: 0,
  contentPieces: 0,
  engagementRate: 0,
  interactedUsers: 0,
  totalRegisteredUsers: 0,
  topPerformingContent: [],
};
