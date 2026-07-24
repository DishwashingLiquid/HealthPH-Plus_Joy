import RegionsData from "../../../assets/data/regions.json";

export const TAB_CONTENT_TYPES = {
  Articles: "articles",
  Videos: "videos",
  Infographics: "infographics",
};

export const UPLOAD_RULES = {
  Articles: {
    label: "Article Content",
    accept: "",
    helperText: "Text only",
    allowedTypes: [],
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
  tags: [],
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
  "English",
  "Filipino",
  "Cebuano",
  "Ilocano",
  "Hiligaynon",
].map((tag, index) => ({
  value: tag,
  label: tag,
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
    icon: "BookOpen",
    description: "Access curated health education materials",
  },
  {
    id: 2,
    title: "Multilingual Resources",
    icon: "Globe",
    description: "Content available in multiple languages",
  },
  {
    id: 3,
    title: "Community Q&A",
    icon: "MessageCircle",
    description: "Ask and answer health-related questions",
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
