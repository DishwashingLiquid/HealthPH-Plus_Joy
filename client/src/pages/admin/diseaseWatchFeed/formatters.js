export const REGIONAL_COVERAGE_PALETTE = [
  "#32418C",
  "#2572A5",
  "#4D8FC4",
  "#9BCC33",
  "#FBD117",
];

export const RECENT_ALERT_ENTITY_STYLES = {
  disease: {
    backgroundColor: "#32418C30",
    color: "#32418C",
  },
  symptom: {
    backgroundColor: "#2572A530",
    color: "#2572A5",
  },
  location: {
    backgroundColor: "#FBD11730",
    color: "#FBD117",
  },
};

export const formatCompactNumber = (value) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const getRegionAccentColor = (regionName, regionUserData) =>
  REGIONAL_COVERAGE_PALETTE[
    regionUserData.findIndex((region) => region.region === regionName) %
      REGIONAL_COVERAGE_PALETTE.length
  ];
