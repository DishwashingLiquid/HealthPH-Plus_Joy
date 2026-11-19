import { useEffect, useRef } from "react";
import { publicContentIdentity, trackPublicContentEvent } from "../../utils/publicHealthLiteracyAnalytics";

export default function usePublicContentView(article, enabled = true, visitKey = "") {
  const lastView = useRef(null);
  const identity = publicContentIdentity(article);
  const key = enabled && identity ? JSON.stringify([identity.contentType, identity.contentId, visitKey]) : null;
  useEffect(() => {
    if (!key) { lastView.current = null; return; }
    if (lastView.current === key) return;
    // Retain through StrictMode's effect replay. A real close/unmount starts a
    // fresh visit; rerenders or a refreshed content object do not.
    lastView.current = key;
    void trackPublicContentEvent("content_opened", article);
  }, [key, article]);
}
