import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "../../src/features/store";
import SentimentPulseTool from "../../src/pages/admin/sentimentPulseTool/SentimentPulseTool";
import "../../src/App.css";
import { counts, makeReport, results, summary, surveys } from "./sentimentPulseData.mjs";

const scenario = new URLSearchParams(location.search).get("scenario");
let processCalls = 0;
let processingReads = 0;
const requests = [];
const fixtures = structuredClone(surveys);
const report = (url) => {
  const empty = { eligibleAnswers: 0, predictedAnswers: 0, answersWithoutResults: 0, calm: 0, worried: 0, worriedShare: null, satisfiedAnswers: 0, satisfactionAnswers: 0, satisfactionShare: null };
  const totals = scenario === "empty" || scenario === "unconfigured" ? empty : scenario === "unprocessed" ? { ...empty, eligibleAnswers: 8, answersWithoutResults: 8 } : processCalls && processingReads > 1 ? { ...counts, predictedAnswers: 8, answersWithoutResults: 0, calm: 5, worriedShare: 37.5 } : counts;
  return makeReport({ totals, sentimentStatus: scenario === "unconfigured" ? "not_configured" : "configured",
    satisfactionStatus: scenario === "unconfigured" ? "not_configured" : "configured",
    ...(url ? { filters: { timeRange: url.searchParams.get("timeRange"), startDate: url.searchParams.get("startDate") || "2026-09-29", endDate: url.searchParams.get("endDate") || "2026-10-28", regions: url.searchParams.get("regions")?.split(",") || [], surveyId: url.searchParams.get("surveyId"), unknownRegionIncluded: !url.searchParams.has("regions") } } : {}) });
};

// Every fetch is intercepted. Never forward to the configured backend or database.
window.fetch = async (request, options) => {
  const url = new URL(typeof request === "string" ? request : request.url, location.origin);
  const method = options?.method || request.method || "GET";
  const path = url.pathname.slice(url.pathname.indexOf("/sentiment-pulse"));
  requests.push(`${method} ${path}${url.search}`);
  document.getElementById("fixture-requests").textContent = requests.join("\n");
  const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  if (scenario === "error" && (path.endsWith("/trends") || path.endsWith("/processing"))) return respond({ detail: "Fixture service unavailable" }, 503);
  if (path.endsWith("/process")) { processCalls += 1; processingReads = 0; return respond({ surveyId: "SUR00001", accepted: true, job: { jobId: "fixture-job", state: "scheduled", stored: 0, skipped: 0, failedBatches: 0, failedWrites: 0, error: null } }, 202); }
  if (path.endsWith("/processing")) {
    processingReads += 1;
    return respond({ surveyId: "SUR00001", state: scenario === "unconfigured" ? "not_configured" : "configured", progressDurable: false,
      job: processCalls ? { jobId: "fixture-job", state: processingReads < 2 ? "running" : "completed", stored: processingReads < 2 ? 0 : 2, skipped: 6, failedBatches: 0, failedWrites: 0, error: null } : null,
      summary: report() });
  }
  if (path.endsWith("/results")) return respond(results);
  if (path.endsWith("/trends")) return respond(report(url));
  if (path.endsWith("/summary")) return respond(summary);
  if (path.endsWith("/regional-analysis")) return respond({ regions: [{ region: "NCR", surveyRespondents: 8, totalSubmissions: 14 }], unknownRegion: { region: null, surveyRespondents: 0, totalSubmissions: 0 }, filteredTotals: { surveyRespondents: 8, totalSubmissions: 14, unlinkedSubmissions: 1 }, totals: { surveyRespondents: 8, totalSubmissions: 14, unknownRegionRespondents: 0, unknownRegionSubmissions: 0 } });
  if (path.endsWith("/surveys") && method === "GET") return respond(fixtures);
  if (path.endsWith("/end")) { const id = path.split("/").at(-2); fixtures.find((s) => s.id === id).status = "Ended"; return respond({ message: "Fixture ended", analyticsEntryCount: 2 }); }
  return respond({ detail: "Unimplemented fixture request; no network request was sent." }, 400);
};

createRoot(document.getElementById("root")).render(<Provider store={store}>
  <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
    <aside className="mb-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-900">Isolated fixture — all fetch requests are mocked. No backend or MongoDB access.
      <a className="ml-3 underline" href="?scenario=unconfigured">Not configured</a><a className="ml-3 underline" href="?scenario=unprocessed">Not processed</a><a className="ml-3 underline" href="?scenario=empty">Empty</a><a className="ml-3 underline" href="?scenario=error">Error</a>
      <button className="ml-3 underline" type="button" onClick={() => window.open(location.href, "sentiment-phone-preview", "width=420,height=880")}>Open narrow preview</button>
    </aside>
    <SentimentPulseTool />
    <details className="mt-6 text-xs"><summary>Intercepted fixture requests</summary><pre id="fixture-requests" className="whitespace-pre-wrap" /></details>
  </div>
</Provider>);
