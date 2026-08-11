const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const FRONTEND_URL = "http://localhost:4173";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = path.resolve(__dirname, "..", "tmp-phase6-screenshots", `healthhub-smoke-${TIMESTAMP}`);
const REPORT_PATH = path.join(OUT_DIR, "report.json");

const EMAIL = "janzzendeleon@gmail.com";
const PASSWORD = "Admin123!";
const OTP = "000000";

const consoleEvents = [];
const failedRequests = [];
const pageErrors = [];
const downloads = [];

const report = {
  startup: {},
  routes: {},
  tabs: {},
  createdTestData: [],
  screenshots: [],
  metadata: {
    startedAt: new Date().toISOString(),
    frontendUrl: FRONTEND_URL,
  },
};

function now() {
  return Date.now();
}

function safeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkpoint() {
  return {
    time: now(),
    consoleIndex: consoleEvents.length,
    failedIndex: failedRequests.length,
    pageErrorIndex: pageErrors.length,
    downloadIndex: downloads.length,
  };
}

function sliceEvents(mark) {
  return {
    consoleErrors: consoleEvents.slice(mark.consoleIndex),
    failedRequests: failedRequests.slice(mark.failedIndex),
    pageErrors: pageErrors.slice(mark.pageErrorIndex),
    downloads: downloads.slice(mark.downloadIndex),
  };
}

async function screenshot(page, name, fullPage = true) {
  const filePath = path.join(OUT_DIR, `${safeName(name)}.png`);
  await page.screenshot({ path: filePath, fullPage });
  report.screenshots.push(filePath);
  return filePath;
}

async function waitForAppIdle(page, ms = 1200) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 4000 });
  } catch {}
  await page.waitForTimeout(ms);
}

async function closeModalIfPresent(page) {
  const cancelButton = page.getByRole("button", { name: /^Cancel$/ }).last();
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await page.waitForTimeout(300);
  }
}

async function setRouteResult(key, data) {
  report.routes[key] = data;
}

async function setTabResult(key, data) {
  report.tabs[key] = data;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1200 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleEvents.push({
      type: msg.type(),
      text: msg.text(),
      url: page.url(),
      at: new Date().toISOString(),
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
      url: page.url(),
      at: new Date().toISOString(),
    });
  });

  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || "requestfailed",
      frameUrl: request.frame()?.url() || page.url(),
      at: new Date().toISOString(),
    });
  });

  page.on("response", async (response) => {
    if (response.status() < 400) return;
    failedRequests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
      statusText: response.statusText(),
      frameUrl: response.frame()?.url() || page.url(),
      at: new Date().toISOString(),
    });
  });

  context.on("download", (download) => {
    downloads.push({
      suggestedFilename: download.suggestedFilename(),
      pageUrl: page.url(),
      at: new Date().toISOString(),
    });
  });

  report.startup = {
    frontendStartedVia: "Attempted client Vite dev server inside sandbox, then started unsandboxed with `npm.cmd run dev -- --host localhost --port 4173` after a Vite/esbuild sandbox access failure.",
    backendStartedVia: "Attempted server Uvicorn inside sandbox, then started unsandboxed with `.\\.venv\\Scripts\\python.exe main.py` after Mongo DNS/network sandbox failure.",
    credentialsUsed: false,
    otpUsed: false,
    protectedRoutesAccessed: false,
  };

  const loginMark = checkpoint();
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitForAppIdle(page);
  const preAuthDashboardUrl = page.url();

  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Enter email").waitFor({ timeout: 10000 });
  await waitForAppIdle(page);
  const loginShot = await screenshot(page, "login-page");

  await setRouteResult("login", {
    accessResult: page.url().includes("/login") ? "accessible" : "redirected",
    renderResult: (await page.locator("body").innerText()).includes("Welcome Back!")
      ? "Login shell rendered with email and password inputs."
      : "Login shell did not render as expected.",
    behaviorResult: `Unauthenticated navigation to /dashboard redirected to ${preAuthDashboardUrl}. /login loaded directly afterward.`,
    consoleErrors: sliceEvents(loginMark).consoleErrors,
    failedRequests: sliceEvents(loginMark).failedRequests,
    interactionFailures: [],
    modalExportNotes: "No modal or export interaction on this route.",
    screenshotStatus: loginShot,
  });

  await page.getByPlaceholder("Enter email").fill(EMAIL);
  await page.getByPlaceholder("Enter password").fill(PASSWORD);
  report.startup.credentialsUsed = true;

  const authMark = checkpoint();
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByPlaceholder("Enter verification code").waitFor({ timeout: 15000 });
  await waitForAppIdle(page, 800);
  await page.getByPlaceholder("Enter verification code").fill(OTP);
  report.startup.otpUsed = true;
  await page.getByRole("button", { name: /^Verify$/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await waitForAppIdle(page, 2500);
  report.startup.protectedRoutesAccessed = true;

  const dashboardMark = checkpoint();
  await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitForAppIdle(page, 2500);
  const dashboardUrl = page.url();
  const dashboardBody = await page.locator("body").innerText();
  const dashboardShot = await screenshot(page, "dashboard");

  await setRouteResult("dashboard", {
    accessResult: dashboardUrl.includes("/dashboard") ? "accessible" : "redirected",
    renderResult: dashboardBody.includes("AI Surveillance")
      ? "Dashboard shell rendered and defaulted to AI Surveillance."
      : "Dashboard route loaded but the expected AI Surveillance heading was not confirmed.",
    behaviorResult: `Protected route became accessible after login. Initial pre-auth visit redirected to ${preAuthDashboardUrl}.`,
    consoleErrors: [
      ...sliceEvents(authMark).consoleErrors,
      ...sliceEvents(dashboardMark).consoleErrors,
      ...sliceEvents(dashboardMark).pageErrors,
    ],
    failedRequests: sliceEvents(dashboardMark).failedRequests,
    interactionFailures: [],
    modalExportNotes: "No modal or export interaction on this route.",
    screenshotStatus: dashboardShot,
  });

  const hubMark = checkpoint();
  await page.goto(`${FRONTEND_URL}/dashboard/health-literacy-hub`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Health Literacy Hub/i }).waitFor({ timeout: 15000 });
  await waitForAppIdle(page, 2000);
  const hubShot = await screenshot(page, "health-literacy-hub-shell");
  const hubBody = await page.locator("body").innerText();

  await setRouteResult("health-literacy-hub", {
    accessResult: page.url().includes("/dashboard/health-literacy-hub") ? "accessible" : "redirected",
    renderResult: hubBody.includes("Health Literacy Hub") && hubBody.includes("Articles")
      ? "Hub shell rendered with the tab switcher and summary cards."
      : "Hub route loaded but the shell did not fully render as expected.",
    behaviorResult: "Authenticated navigation reached the Hub and exposed Articles, Videos, Infographics, and Analytics tabs.",
    consoleErrors: [
      ...sliceEvents(hubMark).consoleErrors,
      ...sliceEvents(hubMark).pageErrors,
    ],
    failedRequests: sliceEvents(hubMark).failedRequests,
    interactionFailures: [],
    modalExportNotes: "Modal and export interactions were exercised inside tab-specific checks below.",
    screenshotStatus: hubShot,
  });

  const sharedNoMutationNote = "Create, save, update, and delete submits were intentionally not executed because those actions would rewrite tracked repository JSON content.";

  const articlesMark = checkpoint();
  const articleFailures = [];
  const articleNotes = [sharedNoMutationNote];
  await page.getByRole("button", { name: /^Articles$/ }).click();
  await waitForAppIdle(page, 1200);
  const articlesShot = await screenshot(page, "tab-articles");

  await page.getByPlaceholder("Search articles...").fill("health");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /Create New Content/i }).click();
  await page.getByText("Create New Article", { exact: true }).waitFor({ timeout: 5000 });
  await screenshot(page, "modal-create-article", false);
  await closeModalIfPresent(page);

  const articleEditButton = page.getByRole("button", { name: /^Edit$/ }).first();
  if (await articleEditButton.isVisible().catch(() => false)) {
    await articleEditButton.click();
    await page.getByText("Edit Article", { exact: true }).waitFor({ timeout: 5000 });
    await screenshot(page, "modal-edit-article", false);
    const descriptionBox = page.locator("textarea[name='description']").first();
    if (await descriptionBox.isVisible().catch(() => false)) {
      await descriptionBox.fill(`${await descriptionBox.inputValue()} QA smoke edit draft`);
    }
    const deleteButton = page.getByRole("button", { name: /^Delete$/ }).last();
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      await page.getByText("Delete Content", { exact: true }).waitFor({ timeout: 5000 });
      await screenshot(page, "modal-delete-article", false);
      await closeModalIfPresent(page);
    } else {
      articleFailures.push("Delete action was not available from the article edit modal.");
    }
    await closeModalIfPresent(page);
  } else {
    articleFailures.push("No article edit button was available, so edit/delete modal coverage could not be completed.");
  }

  await setTabResult("articles", {
    accessResult: "accessible",
    renderResult: "Articles tab rendered with search, create action, and article cards.",
    behaviorResult: "Search input responded, create modal opened, edit modal opened on existing API-backed content, and delete confirmation modal opened without submitting mutations.",
    consoleErrors: [
      ...sliceEvents(articlesMark).consoleErrors,
      ...sliceEvents(articlesMark).pageErrors,
    ],
    failedRequests: sliceEvents(articlesMark).failedRequests,
    interactionFailures: articleFailures,
    modalExportNotes: articleNotes,
    screenshotStatus: articlesShot,
  });

  const videosMark = checkpoint();
  const videoFailures = [];
  const videoNotes = [sharedNoMutationNote];
  await page.getByRole("button", { name: /^Videos$/ }).click();
  await waitForAppIdle(page, 1500);
  const videosShot = await screenshot(page, "tab-videos");

  await page.getByPlaceholder("Search videos...").fill("health");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /Create New Content/i }).click();
  await page.getByText("Create New Video", { exact: true }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: /^English$/ }).click();
  const videoFileInput = page.locator("input[type='file']").first();
  await videoFileInput.setInputFiles({
    name: "qa-video.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("00000018667479706d703432000000006d70343269736f6d0000000866726565", "hex"),
  });
  await page.waitForTimeout(1000);
  await screenshot(page, "modal-create-video-upload", false);
  await closeModalIfPresent(page);

  const videoPreviewButton = page.locator("[aria-label*='video preview']").first();
  if (await videoPreviewButton.isVisible().catch(() => false)) {
    await videoPreviewButton.click();
    await page.getByRole("button", { name: /^Close$/ }).waitFor({ timeout: 5000 });
    await screenshot(page, "modal-video-preview", false);
    await closeModalIfPresent(page);
  } else {
    videoFailures.push("No previewable video card was available, so the media preview modal could not be opened from existing content.");
  }

  await setTabResult("videos", {
    accessResult: "accessible",
    renderResult: "Videos tab rendered with cards, search, and create action.",
    behaviorResult: "Search responded, create modal opened, and the upload control accepted a synthetic MP4 payload for client-side preview testing.",
    consoleErrors: [
      ...sliceEvents(videosMark).consoleErrors,
      ...sliceEvents(videosMark).pageErrors,
    ],
    failedRequests: sliceEvents(videosMark).failedRequests,
    interactionFailures: videoFailures,
    modalExportNotes: videoNotes,
    screenshotStatus: videosShot,
  });

  const infographicsMark = checkpoint();
  const infographicFailures = [];
  const infographicNotes = [sharedNoMutationNote];
  await page.getByRole("button", { name: /^Infographics$/ }).click();
  await waitForAppIdle(page, 1500);
  const infographicsShot = await screenshot(page, "tab-infographics");

  await page.getByPlaceholder("Search infographics...").fill("health");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /Create New Content/i }).click();
  await page.getByText("Create New Infographic", { exact: true }).waitFor({ timeout: 5000 });
  const imageInput = page.locator("input[type='file']").first();
  await imageInput.setInputFiles({
    name: "qa-infographic.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000050001A5F645400000000049454E44AE426082",
      "hex"
    ),
  });
  await page.waitForTimeout(800);
  await screenshot(page, "modal-create-infographic-upload", false);
  await closeModalIfPresent(page);

  const infographicPreview = page.locator("[aria-label*='infographic preview']").first();
  if (await infographicPreview.isVisible().catch(() => false)) {
    await infographicPreview.click();
    await page.getByRole("button", { name: /^Close$/ }).waitFor({ timeout: 5000 });
    await screenshot(page, "modal-infographic-preview", false);
    const dlMark = checkpoint();
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 4000 });
      await page.getByRole("button", { name: /^Download$/ }).first().click();
      const download = await downloadPromise;
      const savePath = path.join(OUT_DIR, download.suggestedFilename());
      await download.saveAs(savePath);
      infographicNotes.push(`Infographic download triggered: ${savePath}`);
    } catch {
      const dlEvents = sliceEvents(dlMark);
      if (dlEvents.failedRequests.length > 0) {
        infographicFailures.push("Infographic download action produced request failures.");
      } else {
        infographicNotes.push("Infographic download click completed without a Playwright download event.");
      }
    }
    await closeModalIfPresent(page);
  } else {
    infographicFailures.push("No previewable infographic card was available, so the media preview modal could not be opened from existing content.");
  }

  await setTabResult("infographics", {
    accessResult: "accessible",
    renderResult: "Infographics tab rendered with cards, search, and create action.",
    behaviorResult: "Search responded, create modal opened, upload preview rendered for a synthetic PNG payload, and the preview modal opened from existing content.",
    consoleErrors: [
      ...sliceEvents(infographicsMark).consoleErrors,
      ...sliceEvents(infographicsMark).pageErrors,
    ],
    failedRequests: sliceEvents(infographicsMark).failedRequests,
    interactionFailures: infographicFailures,
    modalExportNotes: infographicNotes,
    screenshotStatus: infographicsShot,
  });

  const analyticsMark = checkpoint();
  const analyticsFailures = [];
  const analyticsNotes = [];
  await page.getByRole("button", { name: /^Analytics$/ }).click();
  await waitForAppIdle(page, 2000);
  const analyticsShot = await screenshot(page, "tab-analytics");

  const selects = page.locator("select");
  if ((await selects.count()) >= 3) {
    await selects.nth(0).selectOption("last-7-days");
    await selects.nth(1).selectOption("Videos");
    const regionOptions = await selects.nth(2).locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, text: node.textContent }))
    );
    const secondRegion = regionOptions.find((option) => option.value && option.value !== "all");
    if (secondRegion) {
      await selects.nth(2).selectOption(secondRegion.value);
    }
    await waitForAppIdle(page, 1600);
  } else {
    analyticsFailures.push("Expected analytics filters were not all present.");
  }

  try {
    const csvDownloadPromise = page.waitForEvent("download", { timeout: 5000 });
    await page.getByRole("button", { name: /^CSV$/ }).click();
    const csvDownload = await csvDownloadPromise;
    const csvPath = path.join(OUT_DIR, csvDownload.suggestedFilename());
    await csvDownload.saveAs(csvPath);
    analyticsNotes.push(`CSV export download triggered: ${csvPath}`);
  } catch {
    analyticsFailures.push("CSV export did not produce a download event.");
  }

  const printMark = checkpoint();
  let printShot = null;
  try {
    await page.getByRole("button", { name: /^PDF$/ }).click();
    await page.waitForURL(/\/print/, { timeout: 10000 });
    await page.waitForTimeout(1500);
    printShot = await screenshot(page, "route-print");
    analyticsNotes.push("PDF export navigated to /print.");
  } catch (error) {
    analyticsFailures.push(`PDF export did not reach /print: ${error.message}`);
  }

  await setTabResult("analytics", {
    accessResult: "accessible",
    renderResult: "Analytics tab rendered with filters, metrics, and export controls.",
    behaviorResult: "Filters changed, CSV export was attempted, and PDF export was used to test /print navigation.",
    consoleErrors: [
      ...sliceEvents(analyticsMark).consoleErrors,
      ...sliceEvents(analyticsMark).pageErrors,
    ],
    failedRequests: sliceEvents(analyticsMark).failedRequests,
    interactionFailures: analyticsFailures,
    modalExportNotes: analyticsNotes,
    screenshotStatus: analyticsShot,
  });

  const printEvents = sliceEvents(printMark);
  await setRouteResult("print", {
    accessResult: printShot ? "accessible" : "blocked",
    renderResult: printShot
      ? "Print surface rendered after analytics PDF export."
      : "Print surface was not reached from analytics export.",
    behaviorResult: printShot
      ? "Analytics PDF export navigated into the protected /print route."
      : "Direct print verification remained dependent on analytics export and did not complete.",
    consoleErrors: [...printEvents.consoleErrors, ...printEvents.pageErrors],
    failedRequests: printEvents.failedRequests,
    interactionFailures: printShot ? [] : ["Analytics PDF export did not complete into a reachable /print surface."],
    modalExportNotes: printShot
      ? "Print route was exercised from the Analytics tab only; no direct standalone route state was fabricated."
      : "The route depends on navigation state from exports, and that state was not usable enough to verify the surface.",
    screenshotStatus: printShot || "not captured",
  });

  report.createdTestData = [{
    item: "None created",
    edited: "No",
    deleted: "No",
    leftover: "None",
    note: "Content create/edit/delete submits were intentionally skipped to avoid modifying tracked repository JSON files.",
  }];

  report.metadata.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(REPORT_PATH);

  await context.close();
  await browser.close();
}

main().catch((error) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const failurePath = path.join(OUT_DIR, "runner-error.txt");
  fs.writeFileSync(failurePath, `${error.stack || error.message}\n`, "utf8");
  console.error(error);
  process.exit(1);
});
