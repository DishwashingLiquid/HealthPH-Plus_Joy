// Only the three health dashboards import this adapter. The existing region
// options used by other pages remain untouched.
import RegionsData from "../../assets/data/regions.json";

export const DASHBOARD_REGIONS = RegionsData.regions;
export const DASHBOARD_REGION_CODES = DASHBOARD_REGIONS.map(({ value }) => value);
export const getDashboardRegionLabel = (code) =>
  DASHBOARD_REGIONS.find(({ value }) => value === code)?.label ?? "Unknown region";
