import { createContext, useContext } from "react";

export const ArticleMediaContext = createContext(null);
export const MAX_MEDIA_RETRIES = 2;

// State belongs to this public Articles view, never to the content API cache.
export const articleMediaReducer = (resources, { type, source, attempt }) => {
  if (!source) return resources;
  const current = resources[source] ?? { failed: false, attempt: 0 };
  if (attempt !== current.attempt) return resources;
  if (type === "fail" && !current.failed) {
    return { ...resources, [source]: { ...current, failed: true } };
  }
  if (type === "loaded" && !current.loaded) {
    return { ...resources, [source]: { ...current, loaded: true } };
  }
  if (type === "retry" && current.failed && current.attempt < MAX_MEDIA_RETRIES) {
    return {
      ...resources,
      [source]: { failed: false, attempt: current.attempt + 1 },
    };
  }
  return resources;
};

export const useArticleMediaResource = (source) => {
  const [resources, dispatch] = useContext(ArticleMediaContext);
  const { failed = false, attempt = 0, loaded = false } = resources[source] ?? {};
  return {
    missing: !source,
    loading: Boolean(source) && !loaded && !failed,
    failed,
    attempt,
    canRetry: Boolean(source) && failed && attempt < MAX_MEDIA_RETRIES,
    onError: () => dispatch({ type: "fail", source, attempt }),
    onLoad: () => dispatch({ type: "loaded", source, attempt }),
    retry: () => dispatch({ type: "retry", source, attempt }),
  };
};
