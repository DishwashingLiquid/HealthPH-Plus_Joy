/* eslint-disable react/prop-types */
import { useState } from "react";
import { useSelector } from "react-redux";
import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import LoadingSkeleton, { ChartSkeleton } from "../LoadingSkeleton";
import { ToolbarButton } from "../ToolbarControls";
import EmptyState from "./EmptyState";
import {
    useFetchNlpSentimentSummaryQuery, useProcessNlpSentimentsMutation,
} from "../../features/api/analyticsEntriesSlice";

const COLORS = { calm: "#2572A5", worried: "#E59B20" };
const NAMES = { calm: "Calm", worried: "Worried" };
const shortDate = (value) => new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
}).format(new Date(`${value}T00:00:00+08:00`));

export default function NLPSentimentAnalysis({ printing }) {
    const user = useSelector((state) => state.auth.user);
    const [notice, setNotice] = useState("");
    const [processingError, setProcessingError] = useState("");
    const { currentData: summary, isFetching, isError, error, refetch } = useFetchNlpSentimentSummaryQuery(undefined, {
        pollingInterval: 5000, skipPollingIfUnfocused: true, refetchOnMountOrArgChange: true,
    });
    const [process, { isLoading: isStarting }] = useProcessNlpSentimentsMutation();
    const initialLoading = !summary && isFetching;
    const total = summary?.scored_reports ?? 0;
    const pending = (summary?.pending_reports ?? 0) + (summary?.failed_reports ?? 0);
    const rows = summary?.regions ?? [];
    const distribution = (summary?.distribution ?? []).map((item) => ({ name: NAMES[item.label], value: item.count, label: item.label }));

    const processReports = async () => {
        setNotice(""); setProcessingError("");
        try {
            const result = await process().unwrap();
            setNotice(`${result.queued_count} reports queued for sentiment analysis. Results refresh automatically.`);
        } catch (failure) {
            setProcessingError(typeof failure?.data?.detail === "string" ? failure.data.detail : "Unable to start sentiment processing. Please try again.");
        }
    };
    const print = () => {
        if (!summary || isError || !total) return;
        printing.startPrint({
            title: "NLP Insights — Sentiment Analysis", subtitle: "Calm and worried classifications of self-reports and social-media texts",
            generatedAt: new Date().toISOString(), generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
            totalLabel: "Reports with sentiment results", totalReports: total,
            filters: [{ label: "Sources", value: "Self-reports and social-media datasets" }, { label: "Period", value: "All recorded report dates" }],
            notes: ["Results use the model's calm/worried labels and are not clinical assessments.",
                `${pending} reports are awaiting sentiment analysis or retry; ${summary.processing_reports} are processing.`,
                "Trends use the report/post date in Philippine time, not the date sentiment processing was run.",
                ...(summary.undated_reports ? [`${summary.undated_reports} scored reports have no valid report/post date and are excluded from the trend.`] : []),
                ...(summary.ineligible_reports ? [`${summary.ineligible_reports} processed reports have missing or overly long text and are excluded from sentiment results.`] : [])],
            sections: [
                { title: "Sentiment Distribution", itemLabel: "Sentiment", shareLabel: "Percentage of Scored Reports", rows: distribution.map((item) => ({ label: item.name, count: item.value, share: (item.value / total * 100).toFixed(2) })) },
                { title: "Sentiment by Region", columns: [
                    { key: "region", label: "Region", width: 50 }, { key: "calm", label: "Calm", width: 25, align: "right" }, { key: "worried", label: "Worried", width: 25, align: "right" },
                ], rows: rows.map((row) => ({ ...row, region: row.region === "UNMAPPED" ? "Region unavailable" : row.region })) },
                { title: "Sentiment Trends", columns: [
                    { key: "date", label: "Report/Post Date", width: 50 }, { key: "calm", label: "Calm", width: 25, align: "right" }, { key: "worried", label: "Worried", width: 25, align: "right" },
                ], rows: summary.trends },
            ],
        });
    };
    const empty = <EmptyState iconName="Information" heading="No Sentiment Results Yet" content="Process self-reports or social-media datasets to display their calm/worried results." />;

    return (
        <div className="flex flex-col gap-[10px]">
            <div className="flex flex-col gap-[10px] rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
                <div className="flex flex-wrap items-center justify-between gap-[12px]">
                    <p className="text-sm text-gray-500">Calm and worried classifications from processed self-reports and social-media datasets.</p>
                    <div className="flex flex-wrap gap-[10px]">
                        {summary?.can_process && <ToolbarButton iconName="Analytics" onClick={processReports} disabled={isStarting || !pending || Boolean(summary.processing_reports)}>
                            {isStarting ? "Starting..." : summary.processing_reports ? "Processing..." : "Process Pending Sentiment"}
                        </ToolbarButton>}
                        <ToolbarButton onClick={refetch} disabled={isFetching}>Refresh</ToolbarButton>
                        <ToolbarButton iconName="Printer" variant="primary" onClick={print} disabled={!total || isError || printing.isPrinting}>
                            {printing.isPrinting ? "Preparing..." : "Print"}
                        </ToolbarButton>
                    </div>
                </div>
                {!isError && <p className="text-sm text-gray-600">
                    {initialLoading ? <LoadingSkeleton className="h-[14px] w-[36px]" /> : total.toLocaleString()} reports with sentiment results · {initialLoading ? <LoadingSkeleton className="h-[14px] w-[36px]" /> : pending.toLocaleString()} awaiting analysis or retry · {initialLoading ? <LoadingSkeleton className="h-[14px] w-[36px]" /> : (summary?.processing_reports ?? 0).toLocaleString()} processing
                </p>}
                {notice && <p role="status" className="text-sm text-[#2572A5]">{pending === 0 && !summary?.processing_reports && total > 0 ? "Sentiment analysis completed." : notice}</p>}
                {(processingError || printing.printError) && <p role="alert" className="text-sm text-[#B42318]">{processingError || printing.printError}</p>}
                {Boolean(summary?.failed_reports) && <p role="alert" className="text-sm text-[#B42318]">Some reports could not be analyzed. Check that the sentiment service is running, then use Process Pending Sentiment to retry.</p>}
                {Boolean(summary?.ineligible_reports) && <p className="text-sm text-gray-500">{summary.ineligible_reports} reports are excluded because their text is missing or too long for analysis.</p>}
            </div>
            {isError ? <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]"><EmptyState iconName="Error" heading="Unable to Load Sentiment Results" content={typeof error?.data?.detail === "string" ? error.data.detail : "Please try loading the results again."}>
                <ToolbarButton onClick={refetch}>Retry</ToolbarButton>
            </EmptyState></div> : <div className="grid grid-cols-1 gap-[10px] xl:grid-cols-2">
                <section className="min-h-[360px] rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">Sentiment Distribution</h2>
                    <p className="mb-[12px] text-sm text-gray-500">Number of reports classified as calm or worried.</p>
                    {initialLoading ? <ChartSkeleton variant="pie" /> : !total ? empty : <ResponsiveContainer width="100%" height={280}>
                        <PieChart><Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} isAnimationActive={false}>
                            {distribution.map((item) => <Cell key={item.label} fill={COLORS[item.label]} />)}
                        </Pie><Tooltip formatter={(value) => [`${value.toLocaleString()} reports`, "Reports"]} /><Legend iconType="circle" /></PieChart>
                    </ResponsiveContainer>}
                </section>
                <section className="min-h-[360px] rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
                    <h2 className="text-[18px] font-semibold text-gray-800">Sentiment by Region</h2>
                    <p className="mb-[12px] text-sm text-gray-500">Calm and worried report counts grouped by region.</p>
                    {initialLoading ? <ChartSkeleton /> : !rows.length ? empty : <div className="max-h-[320px] overflow-y-auto">
                        <ResponsiveContainer width="100%" height={Math.max(280, rows.length * 38 + 60)}>
                            <BarChart data={rows.map((row) => ({ ...row, region: row.region === "UNMAPPED" ? "Unknown" : row.region }))} layout="vertical" margin={{ left: 8, right: 16, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="region" width={88} />
                                <Tooltip /><Legend iconType="circle" /><Bar dataKey="calm" name="Calm" stackId="reports" fill={COLORS.calm} isAnimationActive={false} /><Bar dataKey="worried" name="Worried" stackId="reports" fill={COLORS.worried} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>}
                </section>
                <section className="min-h-[380px] rounded-[12px] border border-[#E5E5E5] bg-white p-[20px] xl:col-span-2">
                    <h2 className="text-[18px] font-semibold text-gray-800">Sentiment Trends Over Time</h2>
                    <p className="mb-[12px] text-sm text-gray-500">Daily sentiment counts by report/post date in Philippine time.</p>
                    {initialLoading ? <ChartSkeleton /> : !summary?.trends?.length ? <EmptyState iconName="Information" heading="No Dated Sentiment Results" content="This chart requires sentiment results with a valid report/post date." /> : <div className="overflow-x-auto">
                        <div style={{ minWidth: Math.max(300, summary.trends.length * 32) }}>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={summary.trends} margin={{ top: 12, right: 20, left: 0, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} /><YAxis allowDecimals={false} />
                                    <Tooltip labelFormatter={shortDate} /><Legend iconType="circle" />
                                    <Line type="linear" dataKey="calm" name="Calm" stroke={COLORS.calm} strokeWidth={2} isAnimationActive={false} /><Line type="linear" dataKey="worried" name="Worried" stroke={COLORS.worried} strokeWidth={2} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>}
                    {Boolean(summary?.undated_reports) && <p className="mt-[8px] text-xs text-gray-500">{summary.undated_reports} scored reports have no valid report/post date and are excluded from this trend.</p>}
                </section>
            </div>}
        </div>
    );
}
