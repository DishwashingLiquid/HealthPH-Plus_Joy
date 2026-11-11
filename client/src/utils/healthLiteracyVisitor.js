export const HEALTH_LITERACY_VISITOR_ID_KEY = "healthLiteracyVisitorId";
let memoryVisitorId;

export const getHealthLiteracyVisitorId = (userId) => {
  if (userId) return String(userId);
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = window.localStorage.getItem(HEALTH_LITERACY_VISITOR_ID_KEY);
    if (existing) return existing;
  } catch { /* Storage may be blocked; retain an ID for this page session. */ }
  memoryVisitorId ??= window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  try { window.localStorage.setItem(HEALTH_LITERACY_VISITOR_ID_KEY, memoryVisitorId); }
  catch { /* Reading and tracking must work without local storage. */ }
  return memoryVisitorId;
};
