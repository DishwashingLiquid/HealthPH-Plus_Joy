import { ANALYTICS_REGIONS } from "./sharedConfig";

export const formatNumber = (value) => {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
};

export const formatPercent = (value) => {
  return `${Math.round(value ?? 0)}%`;
};

export const formatVideoDuration = (durationInSeconds) => {
  const totalSeconds = Math.floor(Number(durationInSeconds));

  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = hours > 0 ? String(minutes).padStart(2, "0") : minutes;
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
};

export const getAnalyticsCellText = (value) => {
  if (value && typeof value === "object") {
    return value.csvValue ?? value.label ?? value.title ?? "";
  }

  return value ?? "";
};

export const escapeCsvValue = (value) => {
  const text = String(getAnalyticsCellText(value) ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const slugify = (value) => {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export const getFilterLabel = (options, value) => {
  return options.find((option) => option.value === value)?.label ?? value;
};

export const getRegionLabel = (value) => {
  if (value === "all") return "All regions";
  return ANALYTICS_REGIONS.find((region) => region.value === value)?.label ?? value;
};

export const downloadCsv = ({ filename, title, filters, columns, rows }) => {
  const headerRows = [
    [title],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Time Range: ${filters.timeRange}`],
    [`Content Type: ${filters.contentType}`],
    [`Region: ${filters.region}`],
    [],
    columns,
  ];

  const csvContent = [...headerRows, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");

  const element = document.createElement("a");
  element.setAttribute(
    "href",
    `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};
