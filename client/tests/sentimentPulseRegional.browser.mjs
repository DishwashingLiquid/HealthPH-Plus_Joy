// Dependency-free browser integration checks against the existing mocked preview.
// Start Vite, launch an isolated Chromium with --remote-debugging-port=9223,
// then: node tests/sentimentPulseRegional.browser.mjs
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const debugUrl = process.env.REGIONAL_CDP_URL || "http://127.0.0.1:9223";
const previewUrl = process.env.REGIONAL_PREVIEW_URL || "http://127.0.0.1:5173/tests/sentimentPulse.preview.html";
const targets = await (await fetch(`${debugUrl}/json/list`)).json();
const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) return;
  const callback = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) callback.reject(new Error(message.error.message));
  else callback.resolve(message.result);
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${expression}`);
};
const clickButton = (label) => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const cardText = `[...document.querySelectorAll('article')].map(c => c.innerText).join(' ')`;

const press = async (key, code, windowsVirtualKeyCode) => {
  await command("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, ...(key === "Enter" ? { text: "\r" } : {}) });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
};
const comparisonSummary = `[...document.querySelectorAll('summary')].find(s => s.textContent === 'Compare analyzed survey responses')`;
const goRegional = async (scenario = "") => {
  const url = new URL(previewUrl);
  if (scenario) url.searchParams.set("scenario", scenario);
  await command("Page.navigate", { url: url.href });
  await until(`document.querySelector('[aria-label="Reporting time range"]')`);
  await clickButton("Regional Analysis");
};

try {
  await command("Page.enable");
  await command("Page.bringToFront");
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Page.navigate", { url: previewUrl });
  await until(`document.querySelector('option[value="SUR00001"]')`);
  await evaluate(`(() => { const select = document.querySelector('option[value="SUR00001"]').parentElement; select.value = 'SUR00001'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await clickButton("Regional Analysis");
  await until(`document.querySelector('article')?.innerText.includes('50.0% each')`);
  assert.match(await evaluate(cardText), /3\s+Survey responses analyzed/);
  assert.equal(await evaluate(`document.querySelectorAll('#regional-overview').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 1);
  assert.doesNotMatch(await evaluate(`document.body.innerText`), /Current Trends filters|Published surveys:/);
  await evaluate(`[...document.querySelectorAll('label')].find(l => l.textContent.includes('Show regions with no data')).querySelector('input').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 17);
  await evaluate(`[...document.querySelectorAll('label')].find(l => l.textContent.includes('Show regions with no data')).querySelector('input').click()`);
  const requests = await evaluate(`document.querySelector('#fixture-requests').textContent`);
  assert.match(requests, /GET \/sentiment-pulse\/regional-analytics\?timeRange=last-30-days(?:\n|$)/);
  assert.doesNotMatch(requests.split('\n').filter(r => r.includes('/regional-analytics')).join(' '), /surveyId/);
  assert.doesNotMatch(requests, /POST/);

  const layouts = [];
  for (const [width, columns] of [[375, 1], [768, 2], [1440, 4]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const layout = await evaluate(`(() => { const card = document.querySelector('article'); return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      columns: getComputedStyle(card.parentElement).gridTemplateColumns.split(' ').length,
      primarySize: getComputedStyle([...card.querySelectorAll('p')].find(p => p.textContent === '3')).fontSize,
      clipped: [...card.querySelectorAll('p,h4')].some(p => p.scrollWidth > p.clientWidth + 1),
    }; })()`);
    assert.equal(layout.overflow, false, `Page overflow at ${width}px`);
    assert.equal(layout.clipped, false, `Card clipping at ${width}px`);
    assert.equal(layout.columns, columns);
    assert.equal(layout.primarySize, "28px");
    layouts.push({ width, ...layout });
  }
  // Native disclosure is keyboard operable and the comparison bar matches the count.
  await evaluate(`${comparisonSummary}.focus()`);
  await press("Enter", "Enter", 13);
  await until(`${comparisonSummary}.parentElement.open`);
  assert.equal(await evaluate(`${comparisonSummary}.parentElement.querySelector('[aria-hidden="true"]').style.width`), "100%");
  assert.match(await evaluate(`${comparisonSummary}.parentElement.innerText`), /Region NCR\s+3/);
  const accessibility = await command("Accessibility.getFullAXTree");
  const headings = accessibility.nodes.filter(n => n.role?.value === "heading").map(n => n.name?.value);
  assert.ok(headings.includes("Survey Responses Analyzed by Region"));
  assert.ok(headings.includes("Region NCR"));
  await press("Enter", "Enter", 13);
  await evaluate(`document.querySelector('[aria-label="Select reporting regions"]').focus()`);
  await press("Enter", "Enter", 13);
  await until(`document.querySelector('[aria-label="Select reporting regions"]').getAttribute('aria-expanded') === 'true'`);

  // Delay a new region request and verify cached old-filter values disappear.
  await evaluate(`window.regionalFixtureFetch = window.fetch; window.fetch = async (...args) => {
    const request = args[0]; const url = typeof request === 'string' ? request : request.url;
    if (url.includes('/regional-analytics') && url.includes('regions=III')) await new Promise(resolve => setTimeout(resolve, 1200));
    return window.regionalFixtureFetch(...args);
  }`);
  await evaluate(`[...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Region III').querySelector('input').click()`);
  await until(`${cardText}.includes('Loading...')`);
  assert.doesNotMatch(await evaluate(cardText), /50\.0%|6 of 8|3\s+Survey responses analyzed/);
  assert.ok(await evaluate(`Boolean(${comparisonSummary})`));
  await until(`${cardText}.includes('No feedback to analyze')`);
  assert.match(await evaluate(cardText), /0\s+Survey responses analyzed/);
  await press("Escape", "Escape", 27);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), "Select reporting regions");

  // On request failure the comparison stays available with a clear state.
  await evaluate(`(() => { window.fetch = async (...args) => {
    const request = args[0]; const url = typeof request === 'string' ? request : request.url;
    return url.includes('/regional-analytics') ? new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }) : window.regionalFixtureFetch(...args);
  }; const select = document.querySelector('[aria-label="Reporting time range"]'); select.value = 'last-7-days'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Regional analytics could not be loaded')`);
  assert.match(await evaluate(cardText), /Unavailable\s+Survey responses analyzed/);
  assert.doesNotMatch(await evaluate(cardText), /0\.0%|6 of 8/);
  assert.ok(await evaluate(`Boolean(${comparisonSummary})`));
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Export as CSV').disabled`), true);
  await evaluate(`window.fetch = window.regionalFixtureFetch`);
  await clickButton("Refresh Results");
  await until(`${cardText}.includes('No feedback to analyze')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Export as CSV').disabled`), false);
  await evaluate(`HTMLAnchorElement.prototype.click = function () { window.regionalExport = decodeURIComponent(this.href.split(',').slice(1).join(',')); }`);
  await clickButton("Export as CSV");
  assert.match(await evaluate(`window.regionalExport`), /Region III,0,0,exact,No feedback to analyze/);

  await goRegional("missing-fields");
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Some regional analytics fields are unavailable')`);
  assert.ok(await evaluate(`Boolean(${comparisonSummary})`));
  await evaluate(`${comparisonSummary}.click()`);
  assert.match(await evaluate(`${comparisonSummary}.parentElement.innerText`), /Comparison data unavailable/);

  await goRegional("unlinked");
  await until(`document.querySelector('[role="note"]')?.textContent.includes('Exact submission counts are unavailable')`);
  assert.match(await evaluate(cardText), /Unavailable\s+Survey responses analyzed/);
  assert.match(await evaluate(cardText), /50\.0% each/);
  await evaluate(`${comparisonSummary}.focus()`);
  await press("Enter", "Enter", 13);
  await until(`${comparisonSummary}.parentElement.open`);
  assert.match(await evaluate(`${comparisonSummary}.parentElement.innerText`), /Exact regional comparison unavailable/);
  await evaluate(`[...document.querySelectorAll('summary')].find(s => s.textContent === 'How to read these numbers').focus()`);
  await press("Enter", "Enter", 13);
  await until(`[...document.querySelectorAll('details')].find(d => d.querySelector('summary').textContent === 'How to read these numbers').open`);

  for (const [scenario, expected] of [["unconfigured", "Not set up"], ["unprocessed", "No results yet"], ["empty", "No eligible survey answers"]]) {
    await goRegional(scenario);
    await until(`document.body.innerText.includes(${JSON.stringify(expected)})`);
    assert.ok(await evaluate(`Boolean(${comparisonSummary})`));
  }
  await goRegional();
  await until(`document.querySelector('article')?.innerText.includes('50.0% each')`);
  // Date transitions use currentData too; prior-filter counts disappear while pending.
  await evaluate(`window.regionalFixtureFetch = window.fetch; window.fetch = async (...args) => {
    const request = args[0]; const url = typeof request === 'string' ? request : request.url;
    if (url.includes('/regional-analytics') && url.includes('timeRange=custom')) await new Promise(resolve => setTimeout(resolve, 1200));
    return window.regionalFixtureFetch(...args);
  }; const select = document.querySelector('[aria-label="Reporting time range"]'); select.value = 'custom'; select.dispatchEvent(new Event('change', { bubbles: true }));`);
  await until(`document.body.innerText.includes('Loading regional analytics...')`);
  assert.doesNotMatch(await evaluate(`document.querySelector('#regional-overview').innerText`), /50\.0%|6 of 8/);
  await until(`document.querySelector('article')?.innerText.includes('50.0% each')`);
  if (process.env.REGIONAL_SCREENSHOT) {
    await command("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.querySelector('article').scrollIntoView()`);
    const shot = await command("Page.captureScreenshot", { format: "png" });
    await writeFile(process.env.REGIONAL_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }
  assert.doesNotMatch(await evaluate(`document.querySelector('#fixture-requests').textContent`), /POST/);
  console.log(JSON.stringify({ layouts, checks: "Cards, all-survey analytics request, comparison bars and keyboard disclosure, region/date filter transitions, failure recovery, missing fields, unresolved links, CSV and empty states passed" }, null, 2));
} finally {
  socket.close();
}
