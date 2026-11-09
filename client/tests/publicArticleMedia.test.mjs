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
      export * from './utils/healthLiteracyWebsiteContent.js';`,
    resolveDir: fileURLToPath(new URL("../src", import.meta.url)),
  },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  packages: "external", loader: { ".css": "empty", ".svg": "empty" },
  external: ["*/Icon", "*/HomeNavbar", "*/HomeFooter", "*/PublicFullscreenModal",
    "*/features/api/healthLiteracyHubSlice"],
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
  if (name.endsWith("PublicFullscreenModal")) return ({ children, onClose }) =>
    React.createElement("section", { role: "dialog" },
      React.createElement("button", { onClick: onClose }, "Close modal"), children);
  return require(name);
};
compiled._compile(result.outputFiles[0].text, import.meta.filename);
const website = compiled.exports;

// Isolated React hook renderer: runs the actual public components and state updates.
// Media events are injected explicitly; no network, database, DOM, or new test dependency.
const render = (Component) => {
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
        useMemo: (fn) => fn(), useEffect: () => {}, useContext: (context) => contexts.get(context),
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
    const previous = internal.current;
    try { tree = resolve(React.createElement(Component, { embedded: true }), "root"); }
    finally { internal.current = previous; }
  };
  const nodes = (node = tree) => Array.isArray(node) ? node.flatMap(nodes)
    : node && typeof node === "object" ? [node, ...nodes(node.children)] : [];
  const text = (node = tree) => Array.isArray(node) ? node.map(text).join(" ")
    : node && typeof node === "object" ? text(node.children) : String(node ?? "");
  update();
  return {
    nodes: () => nodes(), text,
    find: (predicate) => nodes().find(predicate),
    act: (fn) => { fn(); update(); },
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
  assert.equal(media(view, videoUrl).props.poster, posterUrl);
  assert.equal(button(view, "Watch Video").props.disabled, false);
  view.act(() => button(view, "View Infographic").props.onClick());
  assert.equal(view.find((n) => n.props.download)?.props.href, imageUrl);
  assert.doesNotMatch(view.text(), /Media temporarily unavailable|Showing saved articles/);
});

test("an image failing in the modal disables only its preview/download; retry recovers", () => {
  setup([fixture("image", "infographics", imageUrl), fixture("video", "videos", videoUrl)]);
  const view = render(website.Articles);
  view.act(() => button(view, "View Infographic").props.onClick());
  const images = view.nodes().filter((n) => n.type === "img" && n.props.src === imageUrl);
  const staleError = images.at(-1).props.onError;
  view.act(staleError);
  assert.match(view.text(), /Media temporarily unavailable/);
  assert.match(view.text(), /Readable text image/);
  assert.equal(button(view, "View Infographic").props.disabled, true);
  assert.equal(button(view, "Download").props.disabled, true);
  assert.equal(button(view, "Watch Video").props.disabled, false);
  assert.doesNotMatch(view.text(), /Showing saved articles/);
  view.act(() => button(view, "Retry media").props.onClick());
  view.act(staleError); // Errors from a previous mount cannot poison the new attempt.
  assert.ok(media(view, imageUrl));
  assert.equal(button(view, "View Infographic").props.disabled, false);
  assert.equal(view.find((n) => n.props.download)?.props.href, imageUrl);
});

test("video and poster failures are independent, with bounded manual retries", () => {
  setup([fixture("video", "videos", videoUrl, { thumbnail: { url: posterUrl } })]);
  const view = render(website.Articles);
  view.act(() => media(view, posterUrl).props.onError());
  assert.match(view.text(), /You can still play the video/);
  assert.equal(media(view, videoUrl).props.poster, undefined);
  assert.equal(button(view, "Watch Video").props.disabled, false);
  view.act(() => button(view, "Watch Video").props.onClick());
  assert.ok(view.find((n) => n.type === "video" && n.props.controls));
  view.act(() => button(view, "Retry poster").props.onClick());
  assert.equal(media(view, videoUrl).props.poster, posterUrl);
  for (let i = 0; i < 3; i++) {
    view.act(() => media(view, videoUrl).props.onError());
    assert.equal(button(view, "Watch Video").props.disabled, true);
    if (i < 2) view.act(() => button(view, "Retry media").props.onClick());
  }
  assert.equal(button(view, "Retry media"), undefined);
  assert.match(view.text(), /refresh the page/);
  view.act(() => button(view, "Close modal").props.onClick());
  assert.equal(button(view, "Watch Video").props.disabled, true);
  assert.equal(button(view, "Retry media"), undefined);
});

test("missing media keeps article text/navigation and other cards available", () => {
  setup([fixture("article", "articles", null), fixture("image", "infographics", null), fixture("video", "videos", videoUrl)]);
  const view = render(website.Articles);
  assert.match(view.text(), /Media temporarily unavailable/);
  assert.match(view.text(), /Readable text article/);
  assert.ok(view.find((n) => n.type === "a" && n.props.href === "/articles/articles-article-article"));
  assert.equal(button(view, "View Infographic").props.disabled, true);
  assert.equal(button(view, "Watch Video").props.disabled, false);
  assert.equal(button(view, "Retry media"), undefined);
});

test("article hero failure preserves body, metadata, back/latest links and can recover", () => {
  const article = fixture("hero", "articles", imageUrl, { tags: ["Prevention"] });
  setup([article]);
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

test("only API failure invokes the existing saved-articles notice and static fallback", () => {
  queryResult = { data: undefined, isError: true, isLoading: false, isFetching: false };
  const view = render(website.Articles);
  assert.match(view.text(), /Dashboard resources could not be loaded. Showing saved articles/);
  assert.ok(view.nodes().some((n) => n.type === "a" && n.props.href?.startsWith("/articles/")));
  assert.ok(view.nodes().some((n) => n.type === "img" && n.props.src?.startsWith("/assets/articles/preview/")));
});

test("bundled gallery previews share failure/retry state without losing captions or article text", () => {
  const article = require("../src/assets/data/articles.json").find((item) => item.galleryImages?.length);
  setup([]);
  slug = article.articleSlug;
  const view = render(website.ArticlePage);
  const source = `/assets/articles/gallery/${article.galleryFolder}/${article.galleryImages[0].filename}`;
  const preview = () => view.find((n) => n.props["aria-label"] === `Preview: ${article.galleryImages[0].caption}`);
  view.act(() => preview().props.onClick());
  const images = view.nodes().filter((n) => n.type === "img" && n.props.src === source);
  assert.equal(images.length, 2);
  view.act(() => images.at(-1).props.onError());
  assert.equal(preview(), undefined);
  assert.match(view.text(), /Media temporarily unavailable/);
  assert.ok(view.text().includes(article.galleryImages[0].caption));
  assert.ok(view.text().includes(article.articleBody.split("\n")[0]));
  view.act(() => button(view, "Retry media").props.onClick());
  assert.ok(preview());
  assert.ok(media(view, source));
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
