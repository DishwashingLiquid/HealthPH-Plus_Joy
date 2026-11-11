// Deliberately independent of Redux baseAPI and the dashboard token cookie.
let session = null;
const listeners = new Set();
export const getCommentSession = () => session;
export const subscribeCommentSession = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const setCommentSession = (value) => { session = value; listeners.forEach((listener) => listener(value)); };
export const commentRequest = async (path, { method = "GET", body, authenticated = false, signal } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (authenticated && session) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(`${import.meta.env?.VITE_API_URL ?? "/api"}/health-literacy-hub/comments${path}`, {
    method, headers, credentials: "omit", signal, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (authenticated && response.status === 401) setCommentSession(null);
    const error = new Error(typeof data.detail === "string" ? data.detail : "Unable to complete this comment request.");
    error.status = response.status;
    throw error;
  }
  return data;
};
export const commentResource = (article) => ({
  contentId: String(article.legacyStaticArticleId ?? (article.contentOrigin === "static" ? article.articleID : article.id)),
  contentType: article.contentType,
  contentOrigin: article.legacyStaticArticleId ? "static" : article.contentOrigin,
});

export const draftKey = (resource) => `hl-comment-draft:${resource.contentOrigin}:${resource.contentType}:${resource.contentId}`;
export const readDraft = (key) => { try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; } };
export const saveDraft = (key, body) => { try { if (body) sessionStorage.setItem(key, body); else sessionStorage.removeItem(key); } catch { /* Draft remains in React state. */ } };
