// Start Vite on 5185 and isolated headless Chromium/CDP on 9244.
// Every application fetch is mocked by healthLiteracyAnalyticsPreview.jsx.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const debug = process.env.HL_CDP_URL || "http://127.0.0.1:9244";
const preview = process.env.HL_PREVIEW_URL || "http://127.0.0.1:5185/tests/healthLiteracyAnalytics.preview.html";
const output = fileURLToPath(new URL("../../.hub-build-check/analytics/", import.meta.url));
await mkdir(output, { recursive: true });
const targets = await (await fetch(`${debug}/json/list`)).json();
const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((done) => socket.addEventListener("open", done, { once: true }));
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const result = JSON.parse(data);
  if (!result.id) return;
  const call = pending.get(result.id); pending.delete(result.id);
  if (result.error) call.reject(new Error(result.error.message)); else call.resolve(result.result);
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const until = async (expression) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out: ${expression}`);
};
const button = (label) => `[...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(label)} || e.getAttribute('aria-label') === ${JSON.stringify(label)})`;
const click = async (expression) => { await until(expression); await evaluate(`(${expression}).click()`); };
const events = (type) => evaluate(`__analyticsFixture.calls.filter(c=>c.path.endsWith('/analytics/events')${type ? ` && c.body.eventType === ${JSON.stringify(type)}` : ""}).map(c=>c.body)`);
const ready = () => until("window.__analyticsFixture && document.querySelector('#root').textContent.length > 0");
const open = async (query = "") => { await command("Page.navigate", { url: `${preview}${query}` }); await ready(); };
const navigate = (path) => evaluate(`history.pushState({},'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'));`);
const shot = async (name) => {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`${output}/${name}.png`, Buffer.from(result.data, "base64"));
};
const text = () => evaluate("document.body.textContent");
const exportsDisabled = () => evaluate("[...document.querySelectorAll('button')].filter(e=>['CSV','PDF'].includes(e.textContent.trim())).map(e=>e.disabled)");
const report = [];
try {
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await open("?scene=analytics");
  await until("document.querySelector('[role=alert]')");
  assert.deepEqual(await exportsDisabled(), [true, true]);
  assert.doesNotMatch(await text(), /Total Content Views|No content interactions/);
  await click(button("CSV"));
  await click(button("PDF"));
  assert.equal((await events()).length, 0);
  await shot("overview-error");
  await evaluate("__analyticsFixture.mode='pending'");
  await click(button("Retry analytics"));
  await until("__analyticsFixture.pending.length === 1");
  assert.deepEqual(await exportsDisabled(), [true, true]);
  assert.match(await text(), /Loading analytics data/);
  await evaluate("__analyticsFixture.mode='success';__analyticsFixture.release()");
  await until(`${button("CSV")} && !(${button("CSV")}).disabled`);
  assert.deepEqual(await exportsDisabled(), [false, false]);
  assert.match(await text(), /42/);
  await shot("overview-success");
  // Change each range while a request is pending; never expose the old 42.
  for (const range of ["last-7-days", "last-90-days", "all-time", "last-30-days"]) {
    await evaluate(`(() => {__analyticsFixture.mode='pending';const select=document.querySelector('select');select.value=${JSON.stringify(range)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await until("__analyticsFixture.pending.length === 1");
    assert.deepEqual(await exportsDisabled(), [true, true]);
    assert.doesNotMatch(await text(), /Total Content Views|42/);
    assert.ok((await evaluate("__analyticsFixture.calls.filter(c=>c.path.endsWith('/analytics/overview')).at(-1).search")).includes(range));
    if (range === "last-7-days") {
      await evaluate("__analyticsFixture.mode='error';__analyticsFixture.release(503)");
      await until("document.querySelector('[role=alert]')");
      assert.deepEqual(await exportsDisabled(), [true, true]);
      assert.doesNotMatch(await text(), /Total Content Views|42/);
      await evaluate("__analyticsFixture.mode='success'");
      await click(button("Retry analytics"));
    } else await evaluate("__analyticsFixture.mode='success';__analyticsFixture.release()");
    await until(`${button("CSV")} && !(${button("CSV")}).disabled`);
  }
  // Failed refresh of the same arguments must also hide cached results.
  await evaluate("__analyticsFixture.mode='error'");
  // Trigger tag invalidation using the normal report export event.
  await click(button("CSV"));
  await until("document.querySelector('[role=alert]')");
  assert.deepEqual(await exportsDisabled(), [true, true]);
  assert.doesNotMatch(await text(), /Total Content Views|42/);
  await evaluate("__analyticsFixture.mode='success'");
  await click(button("Retry analytics"));
  await until(`${button("PDF")} && !(${button("PDF")}).disabled`);
  await click(button("PDF"));
  await until("history.state?.usr?.data?.imageData?.startsWith('data:image/png')");
  assert.equal(await evaluate("history.state.usr.data.documentTitle"), "HealthPH - Health Literacy Hub - Analytics Dashboard");
  report.push("overview error, retry, four filter ranges, cached-refresh failure, export gating: passed");

  await open();
  await until(button("Read More"));
  assert.equal((await events("content_opened")).length, 0); // Cards/previews are not visits.
  await navigate("/articles/original-article");
  await until("document.querySelector('.hl-reading .hl-gallery')");
  await until("__analyticsFixture.calls.some(c=>c.body?.eventType==='content_opened')");
  let opened = await events("content_opened");
  assert.equal(opened.length, 1); // Actual React.StrictMode effect replay.
  assert.equal(opened[0].contentId, "static-article-1");
  assert.equal(opened[0].contentType, "article");
  const visitorId = opened[0].visitorId;
  assert.ok(visitorId);
  await evaluate("__analyticsFixture.refreshArticle()");
  await until("document.body.textContent.includes('Updated content object')");
  assert.equal((await events("content_opened")).length, 1);
  await click(button("Preview: Gallery photo"));
  await until("document.querySelector('dialog[open]')");
  assert.equal((await events("content_opened")).length, 1); // Gallery is the same content visit.
  await click(button("Download image"));
  await until("__analyticsFixture.calls.some(c=>c.body?.eventType==='content_downloaded')");
  assert.equal((await events("content_downloaded"))[0].contentId, "static-article-1");
  await click(button("Close photo viewer"));
  await click(button("Share content"));
  await until("__analyticsFixture.calls.some(c=>c.body?.eventType==='content_shared')");
  for (const mode of ["cancel", "failure"]) {
    await evaluate(`__analyticsFixture.shareMode=${JSON.stringify(mode)}`);
    await click(button("Share content"));
    await until(`!(${button("Share content")}).disabled`);
    assert.equal((await events("content_shared")).length, 1);
  }
  await evaluate("Object.defineProperty(navigator,'share',{configurable:true,value:undefined})");
  await click(button("Share content"));
  await until("__analyticsFixture.calls.filter(c=>c.body?.eventType==='content_shared').length===2");
  await evaluate("__analyticsFixture.clipboardMode='failure'");
  await click(button("Share content"));
  await until(`!(${button("Share content")}).disabled`);
  assert.equal((await events("content_shared")).length, 2);
  assert.match(await text(), /Readable public article text/);
  report.push("article view, StrictMode/rerender/gallery deduplication, share success/cancel/failure/clipboard, gallery download: passed");

  await navigate("/articles");
  await until(button("View Infographic"));
  await click(button("View Infographic"));
  await until("document.querySelector('dialog[open]')");
  await until("__analyticsFixture.calls.filter(c=>c.body?.eventType==='content_opened').length===2");
  assert.equal((await events("content_opened")).length, 2);
  await click(button("Zoom in"));
  assert.equal((await events("content_opened")).length, 2);
  await evaluate("__analyticsFixture.downloadFailure=true");
  await click(button("Download image"));
  await until("document.body.textContent.includes('Image could not be downloaded')");
  assert.ok(await evaluate("[...document.querySelectorAll('a')].some(a=>a.textContent==='Open image at source (new tab)' && a.href.includes('health-literacy-tall.svg'))"));
  assert.equal((await events("content_downloaded")).length, 1);
  await evaluate("__analyticsFixture.downloadFailure=false;__analyticsFixture.eventFailure=true");
  await click(button("Download image"));
  await until("__analyticsFixture.calls.filter(c=>c.body?.eventType==='content_downloaded').length===2");
  await until("!document.querySelector('[aria-label=\"Download image\"]').getAttribute('aria-disabled')");
  assert.ok(await evaluate("document.querySelector('dialog[open]') !== null"));
  await click(button("Close photo viewer"));
  await click(button("View Infographic"));
  await until("__analyticsFixture.calls.filter(c=>c.body?.eventType==='content_opened').length===3");
  await click(button("Close photo viewer"));
  await click(button("Watch Video"));
  await until("document.querySelector('.hl-video-viewer')");
  await until("__analyticsFixture.calls.filter(c=>c.body?.eventType==='content_opened').length===4");
  assert.equal((await events("content_opened")).at(-1).contentType, "video");
  assert.match(await text(), /Video description/);
  await click(button("Close"));
  await navigate("/articles?content=public-image&type=infographics");
  await until("document.querySelector('dialog[open]')");
  await until("__analyticsFixture.calls.filter(c=>c.body?.eventType==='content_opened').length===5");
  for (const payload of await events()) {
    assert.equal(payload.clientPlatform, "website");
    assert.equal(payload.visitorId, visitorId);
    assert.equal(payload.region, undefined);
  }
  const requests = await evaluate("__analyticsFixture.calls.filter(c=>c.path.endsWith('/analytics/events'))");
  assert.ok(requests.every((call) => call.credentials === "omit" && !call.headers.authorization));
  await shot("public-viewer");
  report.push("infographic/video views, intentional reopening, share deep links, failed downloads, failed analytics isolation, stable visitor/no region/no auth: passed");

  await open("?scene=admin");
  await until("document.querySelector('.hl-hub h3')");
  await click(button("View Infographic: Public infographic"));
  await until("document.querySelector('dialog[open]')");
  assert.equal((await events()).filter((payload) => payload.clientPlatform === "website").length, 0);
  assert.equal(await evaluate(`${button("Share content")} !== undefined`), false);
  await click(button("Download image"));
  assert.equal((await events("content_downloaded")).length, 0);
  report.push("actual admin preview and download exclude public tracking: passed");
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.join("\n"));
} finally { socket.close(); }
