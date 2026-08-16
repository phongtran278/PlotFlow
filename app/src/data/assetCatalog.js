import { generatedHouseCatalog } from "./generatedHouseCatalog.js";

const A = "/assets";
const DESIGN_ASSIGNMENT_KEY = "plotflow-design-assignments-r1";
const HOUSE_CATALOG_MIGRATION_KEY = "plotflow-house-catalog-generated-only-v1";

function migrateLegacyHouseAssignments() {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (window.localStorage.getItem(HOUSE_CATALOG_MIGRATION_KEY) === "1") return;

  try {
    const raw = JSON.parse(window.localStorage.getItem(DESIGN_ASSIGNMENT_KEY) || "{}");
    const cleaned = {};
    Object.entries(raw || {}).forEach(([unitCode, assignment]) => {
      if (!assignment || typeof assignment !== "object") return;
      const { houseId, ...rest } = assignment;
      cleaned[unitCode] = rest;
    });
    window.localStorage.setItem(DESIGN_ASSIGNMENT_KEY, JSON.stringify(cleaned));
  } catch {
    // Bad legacy storage should never block app boot.
  }

  window.localStorage.setItem(HOUSE_CATALOG_MIGRATION_KEY, "1");
}

function installGoogleSheetFetchFallback() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (window.__plotflowGoogleSheetFetchPatched) return;

  const nativeFetch = window.fetch.bind(window);
  const sheetExportPattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/export(?:\?|$)/i;

  async function looksLikeCsv(response) {
    if (!response?.ok) return false;
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
    if (contentType.includes("text/csv") || contentType.includes("text/plain") || contentType.includes("application/csv")) return true;
    try {
      const sample = (await response.clone().text()).slice(0, 500).trim().toLowerCase();
      if (!sample) return false;
      if (sample.startsWith("<!doctype html") || sample.startsWith("<html") || sample.includes("accounts.google.com")) return false;
      return sample.includes(",") || sample.includes("\n");
    } catch {
      return false;
    }
  }

  window.fetch = async function plotFlowFetch(input, init) {
    const rawUrl = typeof input === "string" ? input : input?.url;
    const match = String(rawUrl || "").match(sheetExportPattern);
    if (!match) return nativeFetch(input, init);

    let primaryResponse;
    try {
      primaryResponse = await nativeFetch(input, init);
      if (await looksLikeCsv(primaryResponse)) return primaryResponse;
    } catch {
      primaryResponse = null;
    }

    const sheetId = match[1];
    let gid = "0";
    try {
      const parsed = new URL(String(rawUrl));
      gid = parsed.searchParams.get("gid") || "0";
    } catch {
      // Keep default first-tab gid.
    }

    const fallbackUrls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=UNITS`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
    ];

    for (const fallbackUrl of fallbackUrls) {
      try {
        const response = await nativeFetch(fallbackUrl, init);
        if (await looksLikeCsv(response)) return response;
        primaryResponse = response;
      } catch {
        // Try the next Google Sheets endpoint.
      }
    }

    if (primaryResponse) return primaryResponse;
    return nativeFetch(input, init);
  };

  window.__plotflowGoogleSheetFetchPatched = true;
}

migrateLegacyHouseAssignments();
installGoogleSheetFetchFallback();

// Single source of truth: app/tools/sync-assets.mjs scans assets/houses/
// and regenerates generatedHouseCatalog.js. Do not append legacy/static houses.
export const houseCatalog = generatedHouseCatalog;

export const amenityCatalog = [
  { id: "AMENITY_VINWONDERS", name: "VinWonders", fileName: "vinwonders.jpg", src: `${A}/amenities/vinwonders.jpg`, group: "Lifestyle" },
  { id: "AMENITY_BROCHURE_19", name: "Tiện ích Brochure 19", fileName: "Brochure Vinhomes Saigon Park_Page_19_Image_0001.jpg", src: `${A}/amenities/Brochure Vinhomes Saigon Park_Page_19_Image_0001.jpg`, group: "Featured" },
  { id: "AMENITY_HONGKONG", name: "Hong Kong", fileName: "hongkong.jpg", src: `${A}/amenities/hongkong.jpg`, group: "Lifestyle" },
  { id: "AMENITY_VINCOM", name: "Vincom", fileName: "vincom.jpg", src: `${A}/amenities/vincom.jpg`, group: "Retail" },
  { id: "AMENITY_BROCHURE_25", name: "Tiện ích Brochure 25", fileName: "Brochure Vinhomes Saigon Park_Page_25_Image_0001.jpg", src: `${A}/amenities/Brochure Vinhomes Saigon Park_Page_25_Image_0001.jpg`, group: "Featured" },
  { id: "AMENITY_GOLF", name: "Golf", fileName: "golf.jpg", src: `${A}/amenities/golf.jpg`, group: "Lifestyle" },
  { id: "AMENITY_UNIVERSITY", name: "University", fileName: "uni.jpg", src: `${A}/amenities/uni.jpg`, group: "Education" },
  { id: "AMENITY_SCHOOL", name: "School", fileName: "school.jpg", src: `${A}/amenities/school.jpg`, group: "Education" },
  { id: "AMENITY_CULTURE", name: "Culture", fileName: "culture.jpg", src: `${A}/amenities/culture.jpg`, group: "Culture" },
];

export const logoCatalog = [
  { id: "LOGO_GOLD", name: "Saigon Park · Gold", src: "/assets/ui/logo_gold.png", group: "Logo" },
  { id: "LOGO_BLACK", name: "Saigon Park · Black", src: "/assets/ui/logo_black.png", group: "Logo" },
  { id: "LOGO_BLUE", name: "Saigon Park · Blue", src: "/assets/ui/logo_blue.png", group: "Logo" },
  { id: "LOGO_RED", name: "Saigon Park · Red", src: "/assets/ui/logo_red.png", group: "Logo" },
  { id: "LOGO_WHITE", name: "Saigon Park · White", src: "/assets/ui/logo_white.png", group: "Logo" },
  { id: "LOGO_ROSE_GOLD", name: "Saigon Park · Rose Gold", src: "/assets/ui/logo_rose_gold.png", group: "Logo" },
];

export const badgeCatalog = [
  { id: "BADGE_HOT_DEAL", name: "Hot Deal", src: "/assets/ui/badge_hotdeal.png", group: "Primary" },
  { id: "BADGE_VE_O_SOM", name: "Về ở sớm", src: "/assets/ui/badge_veosom.png", group: "Primary" },
];

export const pinAssets = {
  pin3D: "/assets/ui/pin_3d.png",
  pin2D: "/assets/ui/pin_2d.png",
};

export const templateAsset = `${A}/template/template.png`;

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function normalizeAssetKey(value) {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/\.[A-Z0-9]+$/i, "")
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

export function findCatalogAsset(catalog, value) {
  if (!value) return null;
  const wanted = normalizeAssetKey(value);
  return (
    catalog.find((item) => normalizeAssetKey(item.id) === wanted) ||
    catalog.find((item) => normalizeAssetKey(item.name) === wanted) ||
    catalog.find((item) => normalizeAssetKey(item.fileName) === wanted) ||
    catalog.find((item) => normalizeAssetKey(item.name).includes(wanted) || wanted.includes(normalizeAssetKey(item.name))) ||
    null
  );
}
