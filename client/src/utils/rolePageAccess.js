export const ROLE_PAGES = {
  AI_SURVEILLANCE: "AI Surveillance",
  NLP_INSIGHTS: "NLP Insights",
  MISINFORMATION_TRACKER: "Misinformation Tracker",
  USER_MANAGEMENT: "User Management",
  MODEL_ACCESS_TOOLKIT: "Model Access and Toolkit",
  DISEASE_WATCH_FEED: "Disease Watch Feed",
  HEALTH_LITERACY_HUB: "Health Literacy Hub",
  SENTIMENT_PULSE_TOOL: "Sentiment Pulse Tool",
};

export const hasRolePageAccess = (user, pageName) => {
  if (!user) return false;
  if (user.user_type === "SUPERADMIN") return true;

  // Older cached sessions do not have this field. Preserve their existing
  // behavior until authentication refreshes the user payload.
  if (!Array.isArray(user.accessible_pages)) return true;

  return user.accessible_pages.includes(pageName);
};
