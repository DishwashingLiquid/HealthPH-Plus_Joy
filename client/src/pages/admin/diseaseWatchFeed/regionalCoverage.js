import { DASHBOARD_REGION_CODES } from "../dashboardRegions";

export const buildRegionalCoverage = (reports) => {
  const regions = new Map();
  for (const report of reports) {
    // Region identity comes from the dashboard API, independent of map-pin
    // availability and the raw location text used as a pin's display name.
    const region = report.region;
    if (!DASHBOARD_REGION_CODES.includes(region)) continue;
    if (!regions.has(region)) {
      regions.set(region, { reportCount: 0, reporterIds: new Set() });
    }
    const entry = regions.get(region);
    entry.reportCount += 1;
    entry.reporterIds.add(report.mobileReporterId || report.id);
  }
  const totalReporters = [...regions.values()].reduce((sum, entry) => sum + entry.reporterIds.size, 0);
  return DASHBOARD_REGION_CODES.filter((region) => regions.has(region)).map((region) => {
    const { reportCount, reporterIds } = regions.get(region);
    return {
      region, users: reporterIds.size, reportCount, alertCount: reportCount,
      percentage: totalReporters ? Math.round((reporterIds.size / totalReporters) * 100) : 0,
    };
  });
};
