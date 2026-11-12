import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";

let queryResult;
let queryArgs;
let retries;
const refetch = () => { retries++; };
const mutation = () => [() => Promise.resolve(), { isLoading: false }];
const filename = fileURLToPath(new URL("../src/pages/admin/healthLiteracyHub/content/ContentTab.jsx", import.meta.url));
const result = buildSync({
  entryPoints: [filename], bundle: true, write: false, platform: "node", format: "cjs",
  jsx: "automatic", packages: "external", loader: { ".css": "empty", ".svg": "empty" },
  define: { "import.meta.env.VITE_API_URL": '"https://api.example.test/api"' },
  external: ["*/features/api/healthLiteracyHubSlice", "*/Icon", "./CommentModeration",
    "./ContentFormBody", "*/admin/ModalWithBody", "*/health-literacy/MediaViewers", "*/about-us/ArticleMedia"],
});
const compiled = new Module(filename);
compiled.filename = filename;
const require = createRequire(filename);
compiled.require = (name) => {
  if (name.endsWith("healthLiteracyHubSlice")) return {
    useFetchHealthLiteracyContentQuery: (...args) => { queryArgs = args; return { ...queryResult, refetch }; },
    useCreateHealthLiteracyContentMutation: mutation,
    useUpdateHealthLiteracyContentMutation: mutation,
    useDeleteHealthLiteracyContentMutation: mutation,
    useCreateHealthLiteracyAnalyticsEventMutation: mutation,
  };
  if (name === "react-redux") return { useSelector: (selector) => selector({ auth: { user: { id: "admin" } } }) };
  if (name.endsWith("Icon") || name === "./CommentModeration") return () => null;
  if (name === "./ContentFormBody") return { ContentFormBody: () => null };
  if (name.endsWith("ArticleMedia")) return { ArticleMediaProvider: ({ children }) => children };
  if (name.endsWith("ModalWithBody") || name.endsWith("MediaViewers")) return () => null;
  return require(name);
};
compiled._compile(result.outputFiles[0].text, filename);
const ContentTab = compiled.exports.default;

// Follow the existing publicArticleMedia harness: execute the real component tree
// with isolated hooks, without a DOM or new dependencies. Record element ancestry
// (types and keys) to check React's reconciliation identity, including media refs.
// Browser DOM identity, layout and actual playback still need a browser check.
const render = (label) => {
  const hooks = new Map();
  const dispatcher = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  let nodes;
  let tree;
  const resolve = (element, ancestry = []) => {
    if (Array.isArray(element)) return element.map((child, index) => resolve(child, [...ancestry, child?.key ?? index]));
    if (element == null || typeof element === "boolean") return null;
    if (typeof element !== "object") return element;
    const { type, key, props } = element;
    const identity = [...ancestry, type, key];
    if (typeof type === "function") {
      const path = identity.map((part) => typeof part === "function" ? part.name : part).join("/");
      const values = hooks.get(path) ?? [];
      hooks.set(path, values);
      let index = 0;
      dispatcher.current = {
        useState: (initial) => {
          const slot = index++;
          if (!(slot in values)) values[slot] = typeof initial === "function" ? initial() : initial;
          return [values[slot], (value) => { values[slot] = typeof value === "function" ? value(values[slot]) : value; }];
        },
        useRef: (initial) => { const slot = index++; return values[slot] ??= { current: initial }; },
        useEffect: () => {},
      };
      return resolve(type(props), identity);
    }
    const node = { type, props, ref: element.ref, identity };
    nodes.push(node);
    node.children = resolve(props.children, identity);
    return node;
  };
  const update = () => {
    nodes = [];
    const previous = dispatcher.current;
    try { tree = resolve(React.createElement(ContentTab, { contentTypeLabel: label })); }
    finally { dispatcher.current = previous; }
  };
  const text = (node) => Array.isArray(node) ? node.map(text).join("")
    : node && typeof node === "object" ? text(node.children) : String(node ?? "");
  update();
  return {
    update, nodes: () => nodes,
    text: () => text(tree).replace(/\s+/g, " "),
    find: (predicate) => nodes.find(predicate),
    media: () => nodes.filter((node) => ["img", "video"].includes(node.type)),
    button: (label) => nodes.find((node) => node.type === "button" && text(node).trim() === label),
    switchType: (next) => { label = next; update(); },
  };
};

const fixture = (label, title = "Saved content") => ({
  id: "same-id", title, description: "Useful health information", contentType: label.toLowerCase(),
  media: { url: label === "Videos" ? "https://media.example.test/clip.mp4" : "https://media.example.test/image.png",
    contentType: label === "Videos" ? "video/mp4" : "image/png" },
  thumbnail: { url: "https://media.example.test/poster.png" },
});
const setup = (currentData, extra = {}) => {
  queryResult = { currentData, data: currentData, isLoading: false, isFetching: false, ...extra };
  retries = 0;
};
const assertSameMedia = (before, after) => {
  assert.equal(after.length, before.length);
  before.forEach((node, index) => {
    assert.deepEqual(after[index].identity, node.identity, "media keeps its element type/key ancestry");
    assert.equal(after[index].props.src, node.props.src);
    assert.equal(after[index].ref, node.ref, "video retains its ref across refresh renders");
  });
};

for (const label of ["Articles", "Videos", "Infographics"]) {
  test(`${label}: first load shows loading UI until a result is available`, () => {
    setup(undefined, { isLoading: true, isFetching: true });
    const view = render(label);
    assert.match(view.text(), new RegExp(`Loading ${label.toLowerCase()}`));
    assert.doesNotMatch(view.text(), /No .* found|Refreshing/);
    assert.equal(view.media().length, 0);
    setup([fixture(label)]);
    view.update();
    assert.match(view.text(), /Saved content/);
    assert.ok(view.media().length);
    assert.doesNotMatch(view.text(), /Loading/);
    assert.equal(queryArgs[0], label.toLowerCase());
    assert.equal(queryArgs[1].pollingInterval, 300000);
    assert.equal(queryArgs[1].refetchOnMountOrArgChange, true);
  });

  test(`${label}: refresh, failure, retry and success retain unchanged media identities`, () => {
    const saved = [fixture(label)];
    setup(saved);
    const view = render(label);
    const media = view.media();
    setup(saved, { isFetching: true });
    view.update();
    assert.match(view.text(), /Saved content/);
    assert.doesNotMatch(view.text(), /Loading/);
    const status = view.find((node) => node.props.role === "status");
    assert.equal(status.children, "Refreshing…");
    assert.equal(status.props["aria-live"], "polite");
    assertSameMedia(media, view.media());
    assert.ok(view.button("Edit"));
    assert.ok(view.button(label === "Articles" ? "Read Article" : label === "Videos" ? "Watch Video" : "Download"));

    setup(saved, { error: { status: 503 } });
    view.update();
    assert.match(view.text(), /Saved content/);
    assert.match(view.text(), /Unable to refresh.*last successful result/);
    assertSameMedia(media, view.media());
    view.button("Retry").props.onClick();
    assert.equal(retries, 1);

    setup(saved, { isFetching: true });
    view.update();
    assertSameMedia(media, view.media());
    setup([fixture(label, "Updated content")]);
    view.update();
    assert.match(view.text(), /Updated content/);
    assert.doesNotMatch(view.text(), /Saved content|Refreshing|Unable to refresh/);
    assertSameMedia(media, view.media());
    setup([]);
    view.update();
    assert.match(view.text(), new RegExp(`No ${label.toLowerCase()} found`));
    assert.equal(view.media().length, 0);
  });

  test(`${label}: empty successful results remain loaded during refresh and failure`, () => {
    setup([]);
    const view = render(label);
    for (const extra of [{}, { isFetching: true }, { error: { status: 503 } }]) {
      setup([], extra);
      view.update();
      assert.match(view.text(), new RegExp(`No ${label.toLowerCase()} found`));
      assert.doesNotMatch(view.text(), /Loading/);
    }
    assert.match(view.text(), /last successful result/);
  });

  test(`${label}: initial errors offer retry without a misleading empty result`, () => {
    setup(undefined, { error: { status: 503 } });
    const view = render(label);
    assert.match(view.text(), /Unable to load shared content/);
    assert.doesNotMatch(view.text(), /No .* found|last successful result|Loading/);
    view.button("Retry").props.onClick();
    assert.equal(retries, 1);
    setup(undefined, { isLoading: true, isFetching: true });
    view.update();
    assert.match(view.text(), new RegExp(`Loading ${label.toLowerCase()}`));
    assert.doesNotMatch(view.text(), /Unable to load/);
  });

  test(`${label}: search-empty results stay visible during refresh and can be cleared`, () => {
    const saved = [fixture(label)];
    setup(saved);
    const view = render(label);
    const search = () => view.find((node) => node.type === "input");
    search().props.onChange({ target: { value: "no-match" } });
    view.update();
    setup(saved, { isFetching: true });
    view.update();
    assert.match(view.text(), new RegExp(`No ${label.toLowerCase()} found`));
    assert.match(view.text(), /Refreshing/);
    assert.doesNotMatch(view.text(), /Loading/);
    search().props.onChange({ target: { value: "" } });
    view.update();
    assert.match(view.text(), /Saved content/);
    assert.ok(view.media().length);
  });
}

test("switching types never displays the previous argument's data while loading or on initial error", () => {
  setup([fixture("Articles", "Previous article")]);
  const view = render("Articles");
  for (const label of ["Videos", "Infographics", "Articles"]) {
    setup(undefined, { data: [fixture("Articles", "Wrong cached content")], isFetching: true });
    view.switchType(label);
    assert.match(view.text(), new RegExp(`Loading ${label.toLowerCase()}`));
    assert.doesNotMatch(view.text(), /Wrong cached content|Previous article|Refreshing/);
    setup(undefined, { data: [fixture("Articles", "Wrong cached content")], error: { status: 503 } });
    view.update();
    assert.match(view.text(), /Unable to load shared content/);
    assert.doesNotMatch(view.text(), /Wrong cached content|No .* found/);
    setup([fixture(label)], { isFetching: true });
    view.update();
    assert.match(view.text(), /Saved content/);
    assert.match(view.text(), /Refreshing/);
    assert.doesNotMatch(view.text(), /Loading/);
  }
});
