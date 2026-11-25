import { getDashboardRegionLabel } from "../../dashboardRegions";
import {
  downloadCsvText,
  escapeCsvValue as escapeCsvCell,
} from "../../../../utils/fileExportHelpers";
import { formatPhDateTime } from "../../../../utils/dateTimeHelpers";

export const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(value ?? 0);

export const formatPercent = (value) =>
  `${Math.round(value ?? 0)}%`;

export const getAnalyticsCellText = (value) => {
  if (value && typeof value === "object") {
    return value.csvValue ?? value.label ?? value.title ?? "";
  }

  return value ?? "";
};

export const escapeCsvValue = (value) =>
  escapeCsvCell(getAnalyticsCellText(value));

export const getFilterLabel = (options, value) =>
  options.find((option) => option.value === value)?.label ?? value;

export const getRegionLabel = (value) => {
  if (value === "all") return "All regions";
  return getDashboardRegionLabel(value);
};

export const downloadCsv = ({ filename, title, filters, columns, rows }) => {
  const headerRows = [
    [title],
    [`Generated: ${formatPhDateTime(new Date())} PHT`],
    [`Time Range: ${filters.timeRange}`],
    [`Content Type: ${filters.contentType}`],
    [`Region: ${filters.region}`],
    [],
    columns,
  ];

  const csvContent = [...headerRows, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");

  downloadCsvText(csvContent, filename);
};