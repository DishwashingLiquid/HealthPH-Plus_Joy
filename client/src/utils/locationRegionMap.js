const normalizeLocation = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/\s+/g, " ");

const LOCATION_TO_REGION = {
    "ncr": "NCR",
    "national capital region": "NCR",
    "metro manila": "NCR",
    "manila": "NCR",
    "quezon city": "NCR",
    "caloocan": "NCR",
    "las pinas": "NCR",
    "makati": "NCR",
    "malabon": "NCR",
    "mandaluyong": "NCR",
    "marikina": "NCR",
    "muntinlupa": "NCR",
    "navotas": "NCR",
    "paranaque": "NCR",
    "pasay": "NCR",
    "pasig": "NCR",
    "san juan": "NCR",
    "taguig": "NCR",
    "valenzuela": "NCR",

    "ilocos norte": "I",
    "ilocos sur": "I",
    "la union": "I",
    "pangasinan": "I",

    "batanes": "II",
    "cagayan": "II",
    "isabela": "II",
    "nueva vizcaya": "II",
    "quirino": "II",

    "aurora": "III",
    "bataan": "III",
    "bulacan": "III",
    "nueva ecija": "III",
    "pampanga": "III",
    "tarlac": "III",
    "zambales": "III",

    "cavite": "IVA",
    "laguna": "IVA",
    "batangas": "IVA",
    "rizal": "IVA",
    "quezon": "IVA",

    "marinduque": "IVB",
    "occidental mindoro": "IVB",
    "oriental mindoro": "IVB",
    "palawan": "IVB",
    "romblon": "IVB",

    "cebu": "VII",
    "bohol": "VII",
    "negros oriental": "VII",
    "siquijor": "VII",
};

export const getRegionFromLocation = (location) => {
    const normalizedLocation = normalizeLocation(location);

    return LOCATION_TO_REGION[normalizedLocation] || "UNMAPPED";
};