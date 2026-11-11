import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const require = createRequire(import.meta.url);
const React = require("react");
let queryResult;
let slug;
const result = buildSync({
  stdin: {
    contents: `export { default as Articles } from './pages/Articles.jsx';
      export { default as ArticlePage } from './pages/ArticlePage.jsx';
      export * from './utils/healthLiteracyWebsiteContent.js';
      export * from './utils/publicCommentSession.js';
      export { default as CommentSection } from './components/health-literacy/CommentSection.jsx';`,
    resolveDir: fileURLToPath(new URL("../src", import.meta.url)),
  },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  define: { "import.meta.env.VITE_API_URL": '"https://api.example.test/api"' },
  packages: "external", loader: { ".css": "empty", ".svg": "empty" },
  external: ["*/Icon", "*/HomeNavbar", "*/HomeFooter", "*/PublicFullscreenModal",
    "*/features/api/healthLiteracyHubSlice", "*/FeatureDialog"],
});
const compiled = new Module(import.meta.filename);
compiled.filename = import.meta.filename;
compiled.require = (name) => {
  if (name.endsWith("healthLiteracyHubSlice")) return {
    useFetchWebsiteHealthLiteracyContentQuery: () => queryResult,
  };
  if (name === "react-router-dom") return {
    useLocation: () => ({}), useParams: () => ({ slug }),
    Link: ({ to, children, ...props }) => React.createElement("a", { ...props, href: to }, children),
  };
  if (/\/(Icon|HomeNavbar|HomeFooter)$/.test(name)) return () => null;
  if (name.endsWith("PublicFullscreenModal") || name.endsWith("FeatureDialog")) return ({ children, onClose }) =>
    React.createElement("section", { role: "dialog" },
      React.createElement("button", { onClick: onClose }, "Close modal"), children);
  return require(name);
};
compiled._compile(result.outputFiles[0].text, import.meta.filename);
const website = compiled.exports;

test("migrated articles keep their existing discussion identity", () => {
  assert.deepEqual(website.commentResource({ contentOrigin: "api", contentType: "articles", id: "static-article-1", legacyStaticArticleId: "1" }),
    { contentOrigin: "static", contentType: "articles", contentId: "1" });
});

// Isolated React hook renderer: runs the actual public components and state updates.
// Media events are injected explicitly; no network, database, DOM, or new test dependency.
const render = (Component, runEffects = false) => {
  let pendingEffects = [];
  let visited;
  const states = new Map();
  const contexts = new Map();
  const internal = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  let tree;
  const resolve = (element, path) => {
    if (element == null || typeof element === "boolean") return null;
    if (Array.isArray(element)) return element.map((child, i) => resolve(child, `${path}.${i}`));
    if (typeof element !== "object") return element;
    const { type, props } = element;
    if (typeof type === "function") {
      visited.add(path);
      let index = 0;
      const hooks = states.get(path) ?? [];
      states.set(path, hooks);
      const useReducer = (reducer, initial) => {
        const i = index++;
        if (!(i in hooks)) hooks[i] = initial;
        return [hooks[i], (action) => { hooks[i] = reducer(hooks[i], action); }];
      };
      internal.current = {
        useReducer,
        useState: (initial) => useReducer((old, value) => typeof value === "function" ? value(old) : value,
          typeof initial === "function" ? initial() : initial),
        useMemo: (fn) => fn(), useContext: (context) => contexts.get(context),
        useEffect: (fn, deps) => {
          const i = index++;
          if (!runEffects) return;
          const old = hooks[i];
          if (!old || !deps || deps.some((dep, n) => !Object.is(dep, old.deps?.[n]))) {
            const next = { deps };
            hooks[i] = next;
            pendingEffects.push(() => { old?.cleanup?.(); next.cleanup = fn(); });
          }
        },
        useRef: (initial) => useReducer((old) => old, { current: initial })[0],
        useId: () => `${path}-${index++}`,
      };
      return resolve(type(props), `${path}.render`);
    }
    if (type?._context) {
      const previous = contexts.get(type._context);
      contexts.set(type._context, props.value);
      const children = resolve(props.children, `${path}.provider`);
      contexts.set(type._context, previous);
      return children;
    }
    if (typeof type === "symbol") return resolve(props.children, `${path}.fragment`);
    return { type, props, children: resolve(props.children, `${path}.children`) };
  };
  const update = () => {
    visited = new Set();
    const previous = internal.current;
    try { tree = resolve(React.createElement(Component, { embedded: true }), "root"); }
    finally { internal.current = previous; }
    if (runEffects) {
      for (const [path, hooks] of states) if (!visited.has(path)) {
        hooks.forEach((hook) => hook?.cleanup?.()); states.delete(path);
      }
      const effects = pendingEffects; pendingEffects = []; effects.forEach((fn) => fn());
    }
  };
  const nodes = (node = tree) => Array.isArray(node) ? node.flatMap(nodes)
    : node && typeof node === "object" ? [node, ...nodes(node.children)] : [];
  const text = (node = tree) => Array.isArray(node) ? node.map(text).join(" ")
    : node && typeof node === "object" ? text(node.children) : String(node ?? "");
  update();
  return {
    nodes: () => nodes(), text,
    find: (predicate) => nodes().find(predicate),
    act: (fn) => { const result = fn(); update(); return result; },
    flush: async () => { for (let i = 0; i < 6; i++) { await new Promise((done) => setTimeout(done, 0)); update(); } },
    unmount: () => { for (const hooks of states.values()) hooks.forEach((hook) => hook?.cleanup?.()); },
  };
};

const imageUrl = "https://media.example.test/api/health-literacy-hub/media/image";
const videoUrl = "https://media.example.test/api/health-literacy-hub/media/video";
const posterUrl = "https://editorial.example.test/poster.png";
const fixture = (id, contentType, url, extra = {}) => ({
  id, contentType, title: `${contentType} ${id}`, description: `Readable text ${id}`,
  publishedDate: "2026-11-01", media: url ? { url, contentType: contentType === "videos" ? "video/mp4" : "image/png" } : null,
  ...extra,
});
const setup = (data) => { queryResult = { data, isFetching: false, isLoading: false, isError: false }; };
const button = (view, label) => view.find((n) => n.type === "button" && view.text(n).trim() === label);
const media = (view, source) => view.find((n) => ["img", "video"].includes(n.type) && n.props.src === source);

test("successful API media uses the supplied URLs and enables preview/download", () => {
  setup([fixture("image", "infographics", imageUrl), fixture("video", "videos", videoUrl, { imageUrl: posterUrl })]);
  const view = render(website.Articles);
  assert.equal(media(view, imageUrl).type, "img");
  assert.ok(media(view, posterUrl));
  assert.equal(media(view, videoUrl), undefined); // Card video has no source until deliberate hover.
  assert.equal(Boolean(button(view, "Watch Video").props.disabled), false);
  view.act(() => button(view, "View Infographic").props.onClick());
  assert.equal(view.find((n) => n.props.download)?.props.href, imageUrl);
  assert.doesNotMatch(view.text(), /Media temporarily unavailable|Showing saved articles/);
});

test("uploaded galleries render plain captions, separate alt text, empty-caption omission, and matching viewer captions", () => {
  const article = fixture("gallery", "articles", null, { galleryImages: [
    { id: "second", media: { url: `${imageUrl}2`, filename: "same.png", contentType: "image/png" }, caption: "<b>Second caption</b>", alt: "Second description" },
    { id: "first", media: { url: imageUrl, filename: "same.png", contentType: "image/png" }, caption: "", alt: "" },
  ] });
  setup([article]); slug = website.getDashboardContentSlug(article);
  const view = render(website.ArticlePage);
  const figures = view.nodes().filter((n) => n.type === "figure");
  assert.equal(figures.length, 2);
  const captions = view.nodes().filter((n) => n.type === "figcaption");
  assert.equal(captions.length, 1);
  assert.equal(view.text(captions[0]), "<b>Second caption</b>");
  assert.equal(view.find((n) => n.type === "b"), undefined);
  assert.equal(media(view, `${imageUrl}2`).props.alt, "Second description");
  assert.equal(media(view, imageUrl).props.alt, "");
  view.act(() => view.find((n) => n.type === "button" && n.props["aria-label"] === "Preview: Second description").props.onClick());
  assert.equal(view.nodes().filter((n) => n.props.className === "hl-description").at(-1).children, "<b>Second caption</b>");
  view.act(() => view.find((n) => n.props["aria-label"] === "Next image").props.onClick());
  assert.equal(view.nodes().filter((n) => n.type === "img" && n.props.src === imageUrl).at(-1).props.alt, "");
  assert.equal(view.nodes().filter((n) => n.props.className === "hl-description").length, 1); // Article description only.
  assert.match(view.text(), /Comments/);
});

test("image failure preserves opening, description and comments; local retry ignores stale errors", () => {
  setup([fixture("image", "infographics", imageUrl), fixture("video", "videos", videoUrl)]);
  const view = render(website.Articles);
  view.act(() => button(view, "View Infographic").props.onClick());
  const staleError = view.nodes().filter((n) => n.type === "img" && n.props.src === imageUrl).at(-1).props.onError;
  view.act(staleError);
  assert.match(view.text(), /Media temporarily unavailable/);
  assert.match(view.text(), /Readable text image/);
  assert.match(view.text(), /Comments/);
  assert.equal(button(view, "View Infographic").props.disabled, false);
  assert.equal(Boolean(button(view, "Watch Video").props.disabled), false);
  view.act(() => button(view, "Retry media").props.onClick());
  view.act(staleError);
  assert.ok(media(view, imageUrl));
  assert.doesNotMatch(view.text(), /Media temporarily unavailable/);
});

test("a failed video poster never prevents opening the playable video", () => {
  setup([fixture("video", "videos", videoUrl, { thumbnail: { url: posterUrl } })]);
  const view = render(website.Articles);
  view.act(() => media(view, posterUrl).props.onError());
  assert.equal(Boolean(button(view, "Watch Video").props.disabled), false);
  view.act(() => button(view, "Watch Video").props.onClick());
  assert.ok(view.find((n) => n.type === "video" && n.props.controls && n.props.src === videoUrl));
  assert.match(view.text(), /Readable text video/);
  assert.match(view.text(), /Comments/);
});

test("missing attachment uses a generic thumbnail and preserves article navigation", () => {
  const article = fixture("article", "articles", null);
  setup([article]);
  const view = render(website.Articles);
  assert.doesNotMatch(view.text(), /Media temporarily unavailable|refresh the page/);
  assert.ok(media(view, "/assets/articles/generic-article.png"));
  const links = view.nodes().filter((n) => n.type === "a" && n.props.href === "/articles/articles-article-article");
  assert.equal(links.length, 2); // Thumbnail and Read More.
  slug = website.getDashboardContentSlug(article);
  const detail = render(website.ArticlePage);
  assert.doesNotMatch(detail.text(), /Media temporarily unavailable|refresh the page|No attachment/);
  assert.match(detail.text(), /Readable text article/);
  assert.match(detail.text(), /Comments/);
});

test("article hero failure preserves body, metadata, back/latest links and can recover", () => {
  const article = fixture("hero", "articles", imageUrl, { tags: ["Prevention"] });
  setup([article, fixture("latest", "articles", null)]);
  slug = website.getDashboardContentSlug(article);
  const view = render(website.ArticlePage);
  view.act(() => media(view, imageUrl).props.onError());
  assert.match(view.text(), /articles hero/);
  assert.match(view.text(), /Readable text hero/);
  assert.match(view.text(), /Prevention/);
  assert.ok(view.find((n) => n.type === "a" && view.text(n).includes("Back to Article List")));
  assert.ok(view.find((n) => n.type === "a" && view.text(n).includes("Read More")));
  view.act(() => button(view, "Retry media").props.onClick());
  assert.ok(media(view, imageUrl));
  assert.doesNotMatch(view.text(), /Media temporarily unavailable/);
});

test("API failure shows an error without restoring static articles", () => {
  queryResult = { data: undefined, isError: true, isLoading: false, isFetching: false };
  const view = render(website.Articles);
  assert.match(view.text(), /Articles could not be loaded/);
  assert.equal(view.nodes().some((n) => n.type === "a" && n.props.href?.startsWith("/articles/")), false);
  assert.equal(view.nodes().some((n) => n.type === "img" && n.props.src?.startsWith("/assets/articles/preview/")), false);
});

test("migrated gallery previews share failure/retry state and retain the original link, captions and text", () => {
  const article = fixture("static-article-1", "articles", null, { legacyArticleSlug: "original-story-link",
    description: "Original full body", shortPreview: "Original preview", galleryImages: [
      { id: "cover", media: { url: imageUrl, contentType: "image/png" }, caption: "Original caption", alt: "Original caption" },
    ] });
  setup([article]);
  slug = "original-story-link";
  const view = render(website.ArticlePage);
  const source = imageUrl;
  const preview = () => view.find((n) => n.props["aria-label"] === `Preview: ${article.galleryImages[0].caption}`);
  view.act(() => preview().props.onClick());
  const images = view.nodes().filter((n) => n.type === "img" && n.props.src === source);
  assert.equal(images.length, 2);
  view.act(() => images.at(-1).props.onError());
  assert.equal(preview(), undefined);
  assert.match(view.text(), /Media temporarily unavailable/);
  assert.ok(view.text().includes(article.galleryImages[0].caption));
  assert.ok(view.text().includes(article.description));
  view.act(() => button(view, "Retry media").props.onClick());
  assert.ok(preview());
  assert.ok(media(view, source));
});

test("empty managed content hides static lists and direct static article links", () => {
  setup([]);
  assert.match(render(website.Articles).text(), /No published articles/);
  slug = "healthph-partnership-meeting-with-doh";
  assert.match(render(website.ArticlePage).text(), /Article not found/);
});

test("uploaded URL precedence, external editorial URLs and bundled static paths are preserved", () => {
  assert.equal(website.getContentMediaSource({ url: imageUrl, previewUrl: "private" }), imageUrl);
  assert.equal(website.getContentMediaSource({ url: "/unmodified/path?x=1" }), "/unmodified/path?x=1");
  assert.equal(website.getResourceImageSource(website.normalizeDashboardContent(fixture("image", "infographics", imageUrl, { imageUrl: posterUrl }))), imageUrl);
  const external = website.normalizeDashboardContent(fixture("external", "videos", null, { mediaUrl: videoUrl, imageUrl: posterUrl, externalUrl: "https://editorial.example.test/article" }));
  assert.equal(website.getResourceImageSource(external), videoUrl);
  assert.equal(website.getResourcePosterSource(external), posterUrl);
  assert.equal(external.externalUrl, "https://editorial.example.test/article");
  assert.equal(website.getResourceImageSource({ ...external, mediaUrl: "" }), "");
  assert.equal(website.getResourceImageSource(website.normalizeStaticArticle({ articleImage: "bundled.jpg" })), "/assets/articles/preview/bundled.jpg");
});


test("thumbnail and action open the same viewer; PDF and external providers avoid image/video misuse", () => {
  setup([fixture("video", "videos", null, { mediaUrl: "https://www.youtube.com/watch?v=fixture" })]);
  const view = render(website.Articles);
  view.act(() => view.find((n) => n.props["aria-label"] === "Watch Video: videos video").props.onClick());
  assert.ok(view.find((n) => n.type === "a" && n.props.href === "https://www.youtube.com/watch?v=fixture"));
  assert.equal(view.find((n) => n.type === "video" && n.props.src), undefined);
  const pdf = fixture("pdf", "articles", imageUrl, { media: { url: imageUrl, contentType: "application/pdf" } });
  setup([pdf]); slug = website.getDashboardContentSlug(pdf);
  const detail = render(website.ArticlePage);
  assert.ok(detail.find((n) => n.type === "a" && n.props.href === imageUrl));
  assert.equal(media(detail, imageUrl), undefined);
});

test("anonymous comments load publicly; login cancellation/failure/expiry preserve the draft and require deliberate posting", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalFrame = globalThis.requestAnimationFrame;
  const originalFormData = globalThis.FormData;
  const storage = new Map();
  globalThis.sessionStorage = { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  globalThis.requestAnimationFrame = (fn) => fn();
  globalThis.FormData = class { constructor(form) { this.form = form; } get(key) { return this.form[key]; } };
  const calls = [];
  let loginStatus = 401;
  let postStatus = 401;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const respond = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (url.endsWith("/session")) return loginStatus === 200 ? respond({ access_token: "comment-only-token", userId: "mu_test" }) : respond({ detail: "Invalid email or password" }, loginStatus);
    if (options.method === "POST") return postStatus === 201 ? respond({ id: "new", body: "Draft survives", status: "pending" }, 201) : respond({ detail: "Session expired" }, postStatus);
    if (url.includes("/mine")) return respond({ items: [], nextCursor: null });
    return respond({ items: [{ id: "approved", body: "Public comment", author: "Community member", createdAt: "2026-01-01T00:00:00Z" }], nextCursor: null });
  };
  const article = website.normalizeDashboardContent(fixture("discussion", "articles", null));
  const Component = () => React.createElement(website.CommentSection, { article });
  website.setCommentSession(null);
  const view = render(Component, true);
  try {
    await view.flush();
    assert.match(view.text(), /Public comment/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers.Authorization, undefined);
    assert.equal(calls[0].credentials, "omit");
    view.act(() => view.find((n) => n.type === "textarea").props.onChange({ target: { value: "Draft survives" } }));
    view.act(() => button(view, "Sign in to write").props.onClick());
    view.act(() => button(view, "Cancel").props.onClick());
    assert.equal(view.find((n) => n.type === "textarea").props.value, "Draft survives");
    view.act(() => view.find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }));
    const loginForm = () => view.find((n) => n.type === "form" && n.props["aria-label"] === "Sign in to comment");
    await view.act(() => loginForm().props.onSubmit({ preventDefault() {}, currentTarget: { email: "reader@example.test", password: "test-password" } }));
    await view.flush();
    assert.match(view.text(), /Invalid email or password/);
    assert.equal(calls.filter((c) => c.method === "POST" && !c.url.endsWith("/session")).length, 0);
    loginStatus = 200;
    await view.act(() => loginForm().props.onSubmit({ preventDefault() {}, currentTarget: { email: "reader@example.test", password: "test-password" } }));
    await view.flush();
    assert.equal(view.find((n) => n.type === "textarea").props.value, "Draft survives");
    assert.equal(calls.filter((c) => c.method === "POST" && !c.url.endsWith("/session")).length, 0);
    view.act(() => view.find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }));
    await view.flush();
    assert.ok(loginForm()); // Expired write opens inline login without clearing the draft.
    assert.equal(website.getCommentSession(), null);
    view.act(() => button(view, "Cancel").props.onClick());
    assert.equal(view.find((n) => n.type === "textarea").props.value, "Draft survives");
    website.setCommentSession({ access_token: "renewed-comment-token" }); await view.flush();
    postStatus = 201;
    view.act(() => view.find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }));
    await view.flush();
    assert.match(view.text(), /Submitted for approval/);
    assert.equal(view.find((n) => n.type === "textarea").props.value, "");
    const post = calls.filter((c) => c.method === "POST" && !c.url.endsWith("/session")).at(-1);
    assert.equal(post.headers.Authorization, "Bearer renewed-comment-token");
    assert.equal(post.credentials, "omit");
    assert.deepEqual(JSON.parse(post.body), { contentId: "discussion", contentType: "articles", contentOrigin: "api", body: "Draft survives" });
    assert.equal([...storage.keys()].some((key) => /token|password/.test(key)), false);
  } finally {
    view.unmount(); website.setCommentSession(null);
    globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage;
    globalThis.requestAnimationFrame = originalFrame; globalThis.FormData = originalFormData;
  }
});
