import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import PosterCanvas from "./components/PosterCanvas";
import FloorplanFineTune, { DEFAULT_FLOORPLAN_VIEW } from "./components/FloorplanFineTune";
import AssetPicker from "./components/AssetPicker";
import LotHighlightEditor from "./components/LotHighlightEditor";
import FocusDeck from "./components/FocusDeck";
import { assetLibrary } from "./data/assetLibrary";
import {
  amenityCatalog,
  badgeCatalog,
  findCatalogAsset,
  houseCatalog,
  logoCatalog,
  pinAssets,
} from "./data/assetCatalog";
import { brandFont, buildBrandFontCss } from "./data/brandConfig";
import { getMemoryProfile } from "./runtime/memoryProfile";
import {
  attachMatchToPageRender,
  buildFloorplanIndex,
  calculateCropRect,
  FLOORPLAN_FRAME_ASPECT,
  normalizeUnitCode,
  openVectorPdf,
  releasePreparedDetailRaster,
  renderPdfPageBase,
  renderPdfRegion,
  resolvePdfSourceUrl,
  resolveUnitsAgainstIndex,
} from "./floorplan/pdfLocator";

const MEMORY_PROFILE = getMemoryProfile();
const PREVIEW_CACHE_LIMIT = Math.max(1, Number(MEMORY_PROFILE.previewCacheTarget) || 2);
const PAGE_CACHE_LIMIT = Math.max(1, Number(MEMORY_PROFILE.pageCacheTarget) || (MEMORY_PROFILE.lowMemory ? 2 : 4));
const DEFAULT_MASTER_PDF_URL = "/masterplan/masterplan.pdf";
const DEFAULT_MASTER_PDF_LABEL = "Masterplan mặc định";
const SHEET_HISTORY_KEY = "plotflow-sheet-history-r1";

const EMPTY_PREVIEW_UNIT = {
  unitCode: "",
  type: "",
  floors: "",
  handover: "",
  landArea: "",
  constructionArea: "",
  roadWidth: "",
  priceEarly: "",
  price18: "",
  price24: "",
  price30: "",
  price36: "",
  houseModel: "",
  floorplan: "",
  amenity1: "",
  amenity2: "",
  architectureLabel: "",
  logoVariant: "",
  showHotDeal: "",
  showEarlyMoveIn: "",
};

const EMPTY_ASSIGNMENT = {
  houseId: null,
  amenity1Id: null,
  amenity2Id: null,
  logoId: null,
  badges: [],
  pin3DVisible: false,
};

function normalizeRow(row) {
  return {
    unitCode: String(row.unitCode ?? "").trim(),
    type: String(row.type ?? "").trim(),
    floors: row.floors ?? "",
    handover: String(row.handover ?? "").trim(),
    landArea: row.landArea ?? "",
    constructionArea: row.constructionArea ?? "",
    roadWidth: row.roadWidth ?? "",
    priceEarly: row.priceEarly ?? "",
    price18: row.price18 ?? "",
    price24: row.price24 ?? "",
    price30: row.price30 ?? row.price36 ?? row["Giá 36TH"] ?? row["GIÁ 36TH"] ?? "",
    price36: row.price36 ?? row.price30 ?? row["Giá 36TH"] ?? row["GIÁ 36TH"] ?? "",
    houseModel: String(row.houseModel ?? row.houseName ?? row["Mẫu nhà"] ?? row["Tên mẫu nhà"] ?? "").trim(),
    floorplan: String(row.floorplan ?? "").trim(),
    amenity1: String(row.amenity1 ?? "").trim(),
    amenity2: String(row.amenity2 ?? "").trim(),
    architectureLabel: String(
      row.architectureLabel ??
      row.houseLabel ??
      row.tenMauNha ??
      row["Tên mẫu nhà"] ??
      row["TÊN MẪU NHÀ"] ??
      row.architecture ??
      ""
    ).trim(),
    logoVariant: String(row.logoVariant ?? row.logo ?? "").trim(),
    showHotDeal: String(row.showHotDeal ?? row.hotDeal ?? "").trim(),
    showEarlyMoveIn: String(row.showEarlyMoveIn ?? row.earlyMoveIn ?? row.veOSom ?? "").trim(),
  };
}

async function parseCSV(text) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(text, { type: "string" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map(normalizeRow).filter((unit) => unit.unitCode);
}

function getGoogleSheetCSVUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Bạn chưa nhập link Google Sheet.");
  if (trimmed.includes("output=csv") || trimmed.includes("format=csv")) return trimmed;
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("Link Google Sheet không hợp lệ.");
  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gidMatch ? gidMatch[1] : "0"}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function loadLocalJson(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function truthy(value) {
  return ["1", "TRUE", "YES", "Y", "X", "ON"].includes(String(value || "").trim().toUpperCase());
}

function resolveDesignAssignment(unit, designAssignments) {
  if (!unit?.unitCode) return EMPTY_ASSIGNMENT;
  const code = normalizeUnitCode(unit.unitCode);
  const saved = designAssignments[code] || {};
  const houseFromSheet = findCatalogAsset(houseCatalog, unit?.houseModel);
  const amenity1FromSheet = findCatalogAsset(amenityCatalog, unit?.amenity1);
  const amenity2FromSheet = findCatalogAsset(amenityCatalog, unit?.amenity2);
  const logoFromSheet = findCatalogAsset(logoCatalog, unit?.logoVariant);
  const sheetBadges = [
    truthy(unit?.showHotDeal) ? "BADGE_HOT_DEAL" : null,
    truthy(unit?.showEarlyMoveIn) ? "BADGE_VE_O_SOM" : null,
  ].filter(Boolean);

  return {
    houseId: Object.prototype.hasOwnProperty.call(saved, "houseId") ? saved.houseId : (houseFromSheet?.id ?? null),
    amenity1Id: Object.prototype.hasOwnProperty.call(saved, "amenity1Id") ? saved.amenity1Id : (amenity1FromSheet?.id ?? null),
    amenity2Id: Object.prototype.hasOwnProperty.call(saved, "amenity2Id") ? saved.amenity2Id : (amenity2FromSheet?.id ?? null),
    logoId: Object.prototype.hasOwnProperty.call(saved, "logoId") ? saved.logoId : (logoFromSheet?.id ?? null),
    badges: Object.prototype.hasOwnProperty.call(saved, "badges") ? saved.badges : sheetBadges,
    pin3DVisible: saved.pin3DVisible ?? false,
  };
}

function getAssetsForUnit(unit, floorplanImages = {}, assignment = EMPTY_ASSIGNMENT) {
  if (!unit?.unitCode) {
    return { houseImage: null, floorplanImage: null, amenity1Image: null, amenity2Image: null, logoImage: null, badges: [], pin3D: null, pin2D: pinAssets.pin2D };
  }
  const code = normalizeUnitCode(unit.unitCode);
  const house = houseCatalog.find((item) => item.id === assignment.houseId);
  const amenity1 = amenityCatalog.find((item) => item.id === assignment.amenity1Id);
  const amenity2 = amenityCatalog.find((item) => item.id === assignment.amenity2Id);
  const logo = logoCatalog.find((item) => item.id === assignment.logoId);
  const badges = (assignment.badges || []).map((id) => badgeCatalog.find((item) => item.id === id)).filter(Boolean);
  return {
    houseImage: house?.src ?? (unit.houseModel ? assetLibrary.houses[unit.houseModel] : null) ?? null,
    floorplanImage: floorplanImages[code] ?? (unit.floorplan ? assetLibrary.floorplans[unit.floorplan] : null) ?? null,
    amenity1Image: amenity1?.src ?? (unit.amenity1 ? assetLibrary.amenities[unit.amenity1] : null) ?? null,
    amenity2Image: amenity2?.src ?? (unit.amenity2 ? assetLibrary.amenities[unit.amenity2] : null) ?? null,
    logoImage: logo?.src ?? null,
    badges,
    pin3D: assignment.pin3DVisible ? pinAssets.pin3D : null,
    pin2D: pinAssets.pin2D,
  };
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function waitTwoFrames() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function waitForImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }));
}

async function renderUnitToPngBlob(unit, floorplanImages, assignment, lotOverlay, exportScale = 1) {
  const { toBlob } = await import("html-to-image");
  const exportHost = document.createElement("div");
  Object.assign(exportHost.style, {
    position: "fixed", left: "-100000px", top: "0", width: "1080px", height: "1920px",
    overflow: "visible", pointerEvents: "none", opacity: "1", zIndex: "-9999",
  });
  document.body.appendChild(exportHost);
  const root = createRoot(exportHost);

  try {
    root.render(
      <PosterCanvas
        unit={unit}
        assets={getAssetsForUnit(unit, floorplanImages, assignment)}
        lotOverlay={lotOverlay?.stale ? null : lotOverlay}
        isEditing={false}
        previewZoom={1}
      />
    );
    await waitTwoFrames();
    await waitForImages(exportHost);
    if (document.fonts?.ready) await document.fonts.ready;
    await waitTwoFrames();
    const posterNode = exportHost.querySelector(".poster-canvas");
    if (!posterNode) throw new Error(`Không tìm thấy PosterCanvas của ${unit.unitCode}.`);
    const scale = Math.max(1, Math.min(5, Number(exportScale) || 1));
    const blob = await toBlob(posterNode, {
      width: 1080,
      height: 1920,
      canvasWidth: 1080 * scale,
      canvasHeight: 1920 * scale,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: "#087665",
      style: { transform: "none", margin: "0", boxShadow: "none" },
    });
    if (!blob) throw new Error(`Không tạo được PNG cho ${unit.unitCode}.`);
    return blob;
  } finally {
    root.unmount();
    exportHost.remove();
  }
}

function statusLabel(status, overridden) {
  if (overridden) return { icon: "✎", text: "Ready", className: "ready" };
  if (status === "ready") return { icon: "✓", text: "Ready", className: "ready" };
  if (status === "review") return { icon: "△", text: "Review", className: "review" };
  if (status === "not_found") return { icon: "✕", text: "Not Found", className: "not-found" };
  return { icon: "·", text: "Unindexed", className: "unindexed" };
}

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem("plotflow-floorplan-overrides-v6") || "{}");
  } catch {
    return {};
  }
}

function loadSheetHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(SHEET_HISTORY_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === "string") return { url: item, name: "", lastUsed: 0 };
        if (item && typeof item === "object") return item;
        return null;
      })
      .filter((item) => item?.url && /^https?:\/\//i.test(String(item.url)))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function extractSheetId(url = "") {
  return String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || "";
}

function fallbackSheetName(url = "") {
  const id = extractSheetId(url);
  return id ? `Google Sheet · ${id.slice(-6)}` : "Google Sheet";
}

function extractFilenameFromDisposition(value = "") {
  const utf = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basic = value.match(/filename=\"?([^\";]+)\"?/i)?.[1];
  const raw = utf || basic || "";
  try { return decodeURIComponent(raw).replace(/\.csv$/i, "").trim(); } catch { return raw.replace(/\.csv$/i, "").trim(); }
}

function App() {
  const [units, setUnits] = useState([]);
  const [selectedUnitCode, setSelectedUnitCode] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetHistory, setSheetHistory] = useState(loadSheetHistory);
  const [connectedSheetUrl, setConnectedSheetUrl] = useState("");
  const [connectionState, setConnectionState] = useState("idle");
  const [message, setMessage] = useState("Chưa kết nối dữ liệu. Hãy chọn Google Sheet hoặc Excel khi cần.");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.38);
  const [exportScale, setExportScale] = useState(3);
  const [designAssignments, setDesignAssignments] = useState(() => loadLocalJson("plotflow-design-assignments-r1", {}));
  const [lotOverlays, setLotOverlays] = useState(() => loadLocalJson("plotflow-lot-overlays-r1-v9", {}));
  const [assetPickerType, setAssetPickerType] = useState(null);
  const [lotEditorCode, setLotEditorCode] = useState(null);
  const [lotEditorData, setLotEditorData] = useState(null);
  const componentCanvasRef = useRef(null);

  const pdfDocRef = useRef(null);
  const pageCacheRef = useRef(new Map());
  const previewCacheRef = useRef(new Map());
  const previewInFlightRef = useRef(new Map());
  const previewGenerationRef = useRef(0);
  const [locatorFileName, setLocatorFileName] = useState("");
  const [locatorSourceMode, setLocatorSourceMode] = useState("link");
  const [locatorUrl, setLocatorUrl] = useState("");
  const [connectedLocatorUrl, setConnectedLocatorUrl] = useState("");
  const [locatorState, setLocatorState] = useState("idle");
  const [locatorMessage, setLocatorMessage] = useState("Chưa kết nối masterplan. Chỉ index PDF khi bạn chủ động chọn.");
  const [locatorProgress, setLocatorProgress] = useState({ current: 0, total: 0, codes: 0 });
  const [floorplanIndex, setFloorplanIndex] = useState({});
  const [locatorResults, setLocatorResults] = useState({});
  const [floorplanImages, setFloorplanImages] = useState({});
  const [overrides, setOverrides] = useState(loadOverrides);
  const [fineTuneUnitCode, setFineTuneUnitCode] = useState(null);
  const [fineTunePageRender, setFineTunePageRender] = useState(null);
  const [fineTuneLoading, setFineTuneLoading] = useState(false);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.unitCode === selectedUnitCode) ?? units[0] ?? null,
    [units, selectedUnitCode]
  );
  const selectedCode = normalizeUnitCode(selectedUnit?.unitCode);
  const selectedLocator = selectedCode ? locatorResults[selectedCode] || null : null;
  const selectedAssignment = useMemo(
    () => selectedUnit ? resolveDesignAssignment(selectedUnit, designAssignments) : EMPTY_ASSIGNMENT,
    [selectedUnit, designAssignments]
  );
  const selectedAssets = useMemo(
    () => selectedUnit ? getAssetsForUnit(selectedUnit, floorplanImages, selectedAssignment) : getAssetsForUnit(null),
    [selectedUnit, floorplanImages, selectedAssignment]
  );
  const selectedLotOverlay = selectedCode ? lotOverlays[selectedCode] || null : null;
  const previewUnit = selectedUnit || EMPTY_PREVIEW_UNIT;

  const locatorSummary = useMemo(() => {
    const values = units.map((unit) => locatorResults[normalizeUnitCode(unit.unitCode)]).filter(Boolean);
    return {
      ready: values.filter((item) => item.status === "ready" || overrides[item.unitCode]).length,
      review: values.filter((item) => item.status === "review" && !overrides[item.unitCode]).length,
      notFound: values.filter((item) => item.status === "not_found").length,
    };
  }, [units, locatorResults, overrides]);

  useEffect(() => {
    if (!brandFont.regular && !brandFont.medium && !brandFont.semibold && !brandFont.bold) return;
    const style = document.createElement("style");
    style.dataset.plotflowBrandFont = "true";
    style.textContent = `${buildBrandFontCss()}\n:root{--plotflow-brand-font:'${brandFont.family}',Arial,sans-serif;}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  function fitPreview() {
    const host = componentCanvasRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const availableW = Math.max(360, rect.width - 390);
    const availableH = Math.max(420, window.innerHeight - rect.top - 40);
    const next = Math.min(1, availableW / 1080, availableH / 1920);
    setPreviewZoom(Math.max(0.2, Number(next.toFixed(3))));
  }

  useEffect(() => {
    if (isLayoutEditing || fineTuneUnitCode || lotEditorCode) return;
    const timer = setTimeout(fitPreview, 30);
    window.addEventListener("resize", fitPreview);
    return () => { clearTimeout(timer); window.removeEventListener("resize", fitPreview); };
  }, [isLayoutEditing, fineTuneUnitCode, lotEditorCode]);

  useEffect(() => {
    function keydown(event) {
      if (event.shiftKey && event.key === "1") { event.preventDefault(); fitPreview(); }
      if ((event.metaKey || event.ctrlKey) && event.key === "0") { event.preventDefault(); setPreviewZoom(1); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  function saveDesignAssignments(next) {
    setDesignAssignments(next);
    localStorage.setItem("plotflow-design-assignments-r1", JSON.stringify(next));
  }

  function patchSelectedAssignment(patch) {
    if (!selectedUnit) return;
    const code = normalizeUnitCode(selectedUnit.unitCode);
    const current = resolveDesignAssignment(selectedUnit, designAssignments);
    saveDesignAssignments({ ...designAssignments, [code]: { ...current, ...patch } });
  }

  function toggleBadge(id) {
    const current = selectedAssignment.badges || [];
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-2);
    patchSelectedAssignment({ badges: next });
  }

  function viewSignature(view) {
    const v = { ...DEFAULT_FLOORPLAN_VIEW, ...(view || {}) };
    return JSON.stringify({ zoom: v.zoom, offsetX: v.offsetX, offsetY: v.offsetY });
  }

  async function openLotEditor(code = selectedCode) {
    const result = locatorResults[code];
    if (!result?.matches?.length || !pdfDocRef.current) return;
    setIsLayoutEditing(false);
    const override = overrides[code];
    const index = Math.min(override?.selectedMatchIndex ?? result.selectedMatchIndex ?? 0, result.matches.length - 1);
    const pageRender = await getPageRender(result.matches[index]);
    const view = { ...DEFAULT_FLOORPLAN_VIEW, ...(override?.view || {}) };
    const crop = calculateCropRect(pageRender, view);
    const anchor = {
      x: Math.max(0, Math.min(1, (pageRender.anchorX - crop.x) / crop.w)),
      y: Math.max(0, Math.min(1, (pageRender.anchorY - crop.y) / crop.h)),
    };
    const clean = await renderPdfRegion(pdfDocRef.current, pageRender, view, {
      outputWidth: MEMORY_PROFILE.lotEditorWidth,
      aspect: FLOORPLAN_FRAME_ASPECT,
      includeHighlight: false,
      maxRenderScale: 128,
    });
    const imageSrc = clean.dataUrl;
    const existing = lotOverlays[code];
    const sig = viewSignature(view);
    setLotEditorData({ imageSrc, autoAnchor: anchor, viewSignature: sig, initialOverlay: existing?.stale ? null : existing });
    setLotEditorCode(code);
  }

  function closeLotEditor() {
    setLotEditorCode(null);
    setLotEditorData(null);
    releasePreparedDetailRaster();
  }

  function saveLotOverlay(overlay) {
    const next = { ...lotOverlays, [lotEditorCode]: { ...overlay, stale: false } };
    setLotOverlays(next);
    localStorage.setItem("plotflow-lot-overlays-r1-v9", JSON.stringify(next));
    closeLotEditor();
  }

  function saveSheetHistoryEntry(url, suggestedName) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return;
    const current = loadSheetHistory();
    const previous = current.find((item) => item.url === cleanUrl);
    const entry = {
      url: cleanUrl,
      name: previous?.name || suggestedName || fallbackSheetName(cleanUrl),
      lastUsed: Date.now(),
    };
    const next = [entry, ...current.filter((item) => item.url !== cleanUrl)]
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 10);
    setSheetHistory(next);
    localStorage.setItem(SHEET_HISTORY_KEY, JSON.stringify(next));
  }

  function renameSheetHistory(url) {
    const current = loadSheetHistory();
    const item = current.find((entry) => entry.url === url);
    const nextName = window.prompt("Tên hiển thị của Google Sheet", item?.name || fallbackSheetName(url));
    if (!nextName?.trim()) return;
    const next = current.map((entry) => entry.url === url ? { ...entry, name: nextName.trim() } : entry);
    setSheetHistory(next);
    localStorage.setItem(SHEET_HISTORY_KEY, JSON.stringify(next));
  }

  function removeSheetHistory(url) {
    const next = loadSheetHistory().filter((entry) => entry.url !== url);
    setSheetHistory(next);
    localStorage.setItem(SHEET_HISTORY_KEY, JSON.stringify(next));
  }

  async function fetchSheetData(sourceUrl) {
    const response = await fetch(getGoogleSheetCSVUrl(sourceUrl), { cache: "no-store" });
    if (!response.ok) throw new Error(`Không tải được Google Sheet (${response.status}).`);
    const importedUnits = await parseCSV(await response.text());
    if (!importedUnits.length) throw new Error("Không tìm thấy căn hợp lệ trong Google Sheet.");
    const disposition = response.headers?.get?.("content-disposition") || "";
    const displayName = extractFilenameFromDisposition(disposition) || fallbackSheetName(sourceUrl);
    return { units: importedUnits, displayName };
  }

  async function connectGoogleSheet(sourceUrl) {
    const candidateUrl = typeof sourceUrl === "string" ? sourceUrl : sheetUrl;
    const targetUrl = String(candidateUrl || "").trim();
    if (!targetUrl) return;
    try {
      setSheetUrl(targetUrl);
      setConnectionState("loading"); setMessage("Đang kết nối Google Sheet...");
      const { units: importedUnits, displayName } = await fetchSheetData(targetUrl);
      setUnits(importedUnits); setSelectedUnitCode(importedUnits[0].unitCode); setConnectedSheetUrl(targetUrl);
      saveSheetHistoryEntry(targetUrl, displayName);
      setConnectionState("connected"); setLastUpdated(new Date()); setMessage(`${displayName} · ${importedUnits.length} căn`);
    } catch (error) {
      setConnectionState("error"); setMessage(error.message || "Không kết nối được Google Sheet.");
    }
  }

  async function refreshGoogleSheet() {
    if (!connectedSheetUrl) return;
    try {
      setConnectionState("loading"); setMessage("Đang refresh dữ liệu...");
      const { units: importedUnits, displayName } = await fetchSheetData(connectedSheetUrl);
      setUnits(importedUnits);
      setSelectedUnitCode(importedUnits.some((u) => u.unitCode === selectedUnitCode) ? selectedUnitCode : importedUnits[0].unitCode);
      saveSheetHistoryEntry(connectedSheetUrl, displayName);
      setConnectionState("connected"); setLastUpdated(new Date()); setMessage(`Đã refresh · ${displayName} · ${importedUnits.length} căn`);
    } catch (error) {
      setConnectionState("error"); setMessage(error.message || "Refresh thất bại.");
    }
  }

  async function handleExcelImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setConnectionState("loading"); setMessage("Đang đọc Excel...");
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const importedUnits = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }).map(normalizeRow).filter((u) => u.unitCode);
      if (!importedUnits.length) throw new Error("Không có căn hợp lệ trong Excel.");
      setUnits(importedUnits); setSelectedUnitCode(importedUnits[0].unitCode); setConnectedSheetUrl("");
      setConnectionState("excel"); setLastUpdated(new Date()); setMessage(`Excel loaded · ${importedUnits.length} căn`);
    } catch (error) {
      setConnectionState("error"); setMessage(error.message || "Không đọc được Excel.");
    }
    event.target.value = "";
  }

  async function getPageRender(match) {
    const key = `${match.pageNumber}`;
    if (pageCacheRef.current.has(key)) {
      const cached = pageCacheRef.current.get(key);
      pageCacheRef.current.delete(key);
      pageCacheRef.current.set(key, cached);
      return attachMatchToPageRender(await cached, match);
    }
    while (pageCacheRef.current.size >= PAGE_CACHE_LIMIT) {
      const oldest = pageCacheRef.current.keys().next().value;
      pageCacheRef.current.delete(oldest);
    }
    const task = renderPdfPageBase(pdfDocRef.current, match.pageNumber);
    pageCacheRef.current.set(key, task);
    return attachMatchToPageRender(await task, match);
  }

  function floorplanPreviewSignature(code, result) {
    if (!result?.matches?.length) return "";
    const override = overrides[code];
    const matchIndex = Math.min(override?.selectedMatchIndex ?? result.selectedMatchIndex ?? 0, result.matches.length - 1);
    const match = result.matches[matchIndex];
    const view = { ...DEFAULT_FLOORPLAN_VIEW, ...(override?.view || {}) };
    return `${match.pageNumber}:${matchIndex}:${match.x}:${match.y}:${viewSignature(view)}`;
  }

  function commitFloorplanPreview(code, signature, dataUrl) {
    const cache = previewCacheRef.current;
    cache.delete(code);
    cache.set(code, { signature, dataUrl });
    while (cache.size > PREVIEW_CACHE_LIMIT) {
      const oldest = Array.from(cache.keys()).find((key) => key !== selectedCode) || cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
    setFloorplanImages(Object.fromEntries(Array.from(cache.entries()).map(([key, value]) => [key, value.dataUrl])));
  }

  async function renderFloorplanPreview(code, results = locatorResults) {
    if (!code || !pdfDocRef.current) return null;
    const result = results[code];
    if (!result?.matches?.length) return null;
    const signature = floorplanPreviewSignature(code, result);
    const cached = previewCacheRef.current.get(code);
    if (cached?.signature === signature) {
      previewCacheRef.current.delete(code);
      previewCacheRef.current.set(code, cached);
      return cached.dataUrl;
    }

    const generation = previewGenerationRef.current;
    const inFlightKey = `${generation}:${code}:${signature}`;
    if (previewInFlightRef.current.has(inFlightKey)) return previewInFlightRef.current.get(inFlightKey);

    const task = (async () => {
      const override = overrides[code];
      const matchIndex = Math.min(override?.selectedMatchIndex ?? result.selectedMatchIndex ?? 0, result.matches.length - 1);
      const match = result.matches[matchIndex];
      const pageRender = await getPageRender(match);
      const view = { ...DEFAULT_FLOORPLAN_VIEW, ...(override?.view || {}) };
      const preview = await renderPdfRegion(pdfDocRef.current, pageRender, view, {
        outputWidth: 1084,
        aspect: FLOORPLAN_FRAME_ASPECT,
        includeHighlight: false,
      });
      if (generation === previewGenerationRef.current) commitFloorplanPreview(code, signature, preview.dataUrl);
      return preview.dataUrl;
    })().finally(() => previewInFlightRef.current.delete(inFlightKey));

    previewInFlightRef.current.set(inFlightKey, task);
    return task;
  }

  useEffect(() => {
    if (!pdfDocRef.current || !Object.keys(floorplanIndex).length || !units.length) {
      if (!units.length) setLocatorResults({});
      return;
    }
    const nextResults = resolveUnitsAgainstIndex(units, floorplanIndex);
    previewGenerationRef.current += 1;
    previewCacheRef.current.clear();
    previewInFlightRef.current.clear();
    setFloorplanImages({});
    setLocatorResults(nextResults);
  }, [units, floorplanIndex]);

  useEffect(() => {
    if (!selectedCode || !pdfDocRef.current || !locatorResults[selectedCode]?.matches?.length) return undefined;
    let cancelled = false;
    let idleId = null;
    let timerId = null;

    renderFloorplanPreview(selectedCode, locatorResults)
      .then(() => {
        if (cancelled || !MEMORY_PROFILE.preloadNextUnit) return;
        const selectedIndex = units.findIndex((unit) => normalizeUnitCode(unit.unitCode) === selectedCode);
        if (selectedIndex < 0) return;
        const nextUnit = units[selectedIndex + 1];
        if (!nextUnit) return;
        const preloadCode = normalizeUnitCode(nextUnit.unitCode);
        const preload = async () => {
          if (cancelled) return;
          try { await renderFloorplanPreview(preloadCode, locatorResults); } catch (error) { console.debug("Preview preload skipped", error); }
        };

        if (typeof requestIdleCallback === "function") {
          idleId = requestIdleCallback(() => preload());
        } else {
          timerId = setTimeout(preload, 500);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLocatorMessage("Đã index nhưng có lỗi khi render crop preview.");
      });

    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
      if (timerId != null) clearTimeout(timerId);
    };
  }, [selectedCode, locatorResults, overrides, units]);

  async function indexMasterPdf(source, sourceLabel, sourceType = "upload") {
    try {
      setLocatorState("indexing");
      setLocatorFileName(sourceLabel);
      setLocatorMessage(sourceType === "link" ? "Đang kết nối PDF từ link..." : sourceType === "local" ? "Đang mở masterplan mặc định..." : "Đang đọc text vector trong PDF...");
      pageCacheRef.current.clear();
      previewGenerationRef.current += 1;
      previewCacheRef.current.clear();
      previewInFlightRef.current.clear();
      setFloorplanImages({});
      setLocatorResults({});
      setFloorplanIndex({});

      const pdfDoc = await openVectorPdf(source);
      pdfDocRef.current = pdfDoc;
      setLocatorProgress({ current: 0, total: pdfDoc.numPages, codes: 0 });
      setLocatorMessage(`PDF connected · ${pdfDoc.numPages} pages · đang index text...`);

      const index = await buildFloorplanIndex(pdfDoc, (progress) => {
        setLocatorProgress({ current: progress.pageNumber, total: progress.totalPages, codes: progress.codes });
        setLocatorMessage(`Indexing page ${progress.pageNumber}/${progress.totalPages} · ${progress.codes.toLocaleString()} mã`);
      });

      setFloorplanIndex(index);
      setLocatorState("ready");
      setLocatorMessage(`Indexed · ${pdfDoc.numPages} pages · ${Object.keys(index).length.toLocaleString()} unit codes found`);
      return true;
    } catch (error) {
      console.error(error);
      pdfDocRef.current = null;
      setLocatorState("error");
      const rawMessage = String(error?.message || "");
      const linkHint = sourceType === "link"
        ? " Link có thể bị giới hạn quyền truy cập/CORS. Hãy thử link public/direct PDF hoặc Upload PDF."
        : "";
      setLocatorMessage(`${rawMessage || "Không đọc được PDF vector."}${linkHint}`);
      return false;
    }
  }

  async function connectBundledMasterplan() {
    if (locatorState === "indexing") return;
    const ok = await indexMasterPdf(DEFAULT_MASTER_PDF_URL, DEFAULT_MASTER_PDF_LABEL, "local");
    if (ok) {
      setConnectedLocatorUrl(DEFAULT_MASTER_PDF_URL);
      setLocatorFileName(DEFAULT_MASTER_PDF_LABEL);
    }
  }

  async function connectMasterPdfLink() {
    if (!locatorUrl.trim() || locatorState === "indexing") return;
    try {
      const resolved = resolvePdfSourceUrl(locatorUrl);
      const label = (() => {
        try {
          const url = new URL(locatorUrl);
          return url.pathname.split("/").filter(Boolean).pop() || url.hostname;
        } catch {
          return "Linked Master PDF";
        }
      })();
      const ok = await indexMasterPdf(resolved, label, "link");
      if (ok) {
        setConnectedLocatorUrl(locatorUrl.trim());
        setLocatorFileName(label);
      }
    } catch (error) {
      setLocatorState("error");
      setLocatorMessage(error.message || "Link PDF không hợp lệ.");
    }
  }

  async function handleMasterPdf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setConnectedLocatorUrl("");
    await indexMasterPdf(file, file.name, "upload");
    event.target.value = "";
  }

  async function openFineTune(code = selectedCode) {
    const result = locatorResults[code];
    if (!result?.matches?.length) return;
    try {
      setFineTuneLoading(true); setIsLayoutEditing(false); setFineTuneUnitCode(code);
      const override = overrides[code];
      const index = Math.min(override?.selectedMatchIndex ?? result.selectedMatchIndex ?? 0, result.matches.length - 1);
      const pageRender = await getPageRender(result.matches[index]);
      setFineTunePageRender(pageRender);
    } finally {
      setFineTuneLoading(false);
    }
  }

  async function changeFineTuneCandidate(index) {
    const result = locatorResults[fineTuneUnitCode];
    if (!result?.matches?.[index]) return;
    setLocatorResults((prev) => ({ ...prev, [fineTuneUnitCode]: { ...prev[fineTuneUnitCode], selectedMatchIndex: index } }));
    setFineTuneLoading(true);
    setFineTunePageRender(await getPageRender(result.matches[index]));
    setFineTuneLoading(false);
  }

  async function saveFineTune(view) {
    const code = fineTuneUnitCode;
    const result = locatorResults[code];
    if (!result || !fineTunePageRender) return;
    const selectedMatchIndex = result.selectedMatchIndex ?? 0;
    const nextOverride = { selectedMatchIndex, view };
    const nextOverrides = { ...overrides, [code]: nextOverride };
    setOverrides(nextOverrides);
    localStorage.setItem("plotflow-floorplan-overrides-v6", JSON.stringify(nextOverrides));
    if (lotOverlays[code]) {
      const nextLots = { ...lotOverlays, [code]: { ...lotOverlays[code], stale: true } };
      setLotOverlays(nextLots);
      localStorage.setItem("plotflow-lot-overlays-r1-v9", JSON.stringify(nextLots));
    }
    const hq = await renderPdfRegion(pdfDocRef.current, fineTunePageRender, view, { outputWidth: 1084, aspect: FLOORPLAN_FRAME_ASPECT, includeHighlight: false });
    const match = result.matches[selectedMatchIndex];
    const signature = `${match.pageNumber}:${selectedMatchIndex}:${match.x}:${match.y}:${viewSignature(view)}`;
    commitFloorplanPreview(code, signature, hq.dataUrl);
    setLocatorResults((prev) => ({ ...prev, [code]: { ...prev[code], status: "ready" } }));
    setFineTuneUnitCode(null); setFineTunePageRender(null);
  }

  async function renderFineTuneVectorPreview(view) {
    if (!pdfDocRef.current || !fineTunePageRender) return null;
    return renderPdfRegion(pdfDocRef.current, fineTunePageRender, view, {
      outputWidth: 1640,
      aspect: FLOORPLAN_FRAME_ASPECT,
      includeHighlight: false,
      maxRenderScale: 128,
    });
  }

  async function floorplanImagesForExport(unit, scale) {
    if (!pdfDocRef.current) return floorplanImages;
    const code = normalizeUnitCode(unit?.unitCode);
    const result = locatorResults[code];
    if (!result?.matches?.length) return floorplanImages;
    const override = overrides[code];
    const index = Math.min(override?.selectedMatchIndex ?? result.selectedMatchIndex ?? 0, result.matches.length - 1);
    const match = result.matches[index];
    const pageRender = await getPageRender(match);
    const view = { ...DEFAULT_FLOORPLAN_VIEW, ...(override?.view || {}) };
    const vector = await renderPdfRegion(pdfDocRef.current, pageRender, view, {
      outputWidth: Math.max(1084, Math.round(506 * Math.max(1, scale))),
      aspect: FLOORPLAN_FRAME_ASPECT,
      includeHighlight: false,
      maxRenderScale: 128,
    });
    return { ...floorplanImages, [code]: vector.dataUrl };
  }

  function reviewIssues() {
    const issue = units.find((unit) => {
      const result = locatorResults[normalizeUnitCode(unit.unitCode)];
      return result && result.status !== "ready" && !overrides[normalizeUnitCode(unit.unitCode)];
    });
    if (!issue) return;
    setSelectedUnitCode(issue.unitCode);
    const code = normalizeUnitCode(issue.unitCode);
    if (locatorResults[code]?.matches?.length) openFineTune(code);
  }

  async function exportCurrentPng() {
    if (!selectedUnit || isExporting) return;
    try {
      setIsExporting(true); setIsLayoutEditing(false); setExportProgress({ current: 1, total: 1 });
      setExportMessage(`Đang xuất ${selectedUnit.unitCode}...`);
      const exportFloorplans = await floorplanImagesForExport(selectedUnit, exportScale);
      const blob = await renderUnitToPngBlob(selectedUnit, exportFloorplans, selectedAssignment, selectedLotOverlay, exportScale);
      downloadBlob(blob, `${selectedUnit.unitCode}.png`);
      setExportMessage(`Đã xuất ${selectedUnit.unitCode}.png`);
    } catch (error) { setExportMessage(error.message || "Xuất PNG thất bại."); }
    finally { setIsExporting(false); }
  }

  async function exportAllPng() {
    if (!units.length || isExporting) return;
    try {
      setIsExporting(true); setIsLayoutEditing(false); setExportProgress({ current: 0, total: units.length });
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let index = 0; index < units.length; index += 1) {
        const unit = units[index];
        setExportProgress({ current: index + 1, total: units.length });
        setExportMessage(`Đang xuất ${index + 1}/${units.length} · ${unit.unitCode}`);
        const code = normalizeUnitCode(unit.unitCode);
        const assignment = resolveDesignAssignment(unit, designAssignments);
        const exportFloorplans = await floorplanImagesForExport(unit, exportScale);
        zip.file(`${unit.unitCode}.png`, await renderUnitToPngBlob(unit, exportFloorplans, assignment, lotOverlays[code], exportScale));
      }
      setExportMessage("Đang đóng gói ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(zipBlob, `PlotFlow_Export_${units.length}_Units.zip`);
      setExportMessage(`Hoàn tất · ${units.length} PNG`);
    } catch (error) { setExportMessage(error.message || "Batch export thất bại."); }
    finally { setIsExporting(false); }
  }

  const fineTuneUnit = fineTuneUnitCode ? units.find((unit) => normalizeUnitCode(unit.unitCode) === fineTuneUnitCode) : null;
  const fineTuneResult = fineTuneUnitCode ? locatorResults[fineTuneUnitCode] : null;
  const fineTuneInitialView = fineTuneUnitCode ? overrides[fineTuneUnitCode]?.view || DEFAULT_FLOORPLAN_VIEW : DEFAULT_FLOORPLAN_VIEW;
  const connectionLabel = connectionState === "connected" ? "Connected" : connectionState === "loading" ? "Loading" : connectionState === "error" ? "Error" : connectionState === "excel" ? "Excel" : "Waiting";

  return (
    <div className="plotflow-shell">
      <aside className="unit-sidebar">
        <div><h1>PlotFlow</h1><p>Đời lắm Phong Trần · Plot smarter.</p></div>

        <div className="sheet-connect">
          <span>GOOGLE SHEETS</span>
          <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="Paste Google Sheet link..." />
          {sheetHistory.length > 0 && (
            <div className="sheet-history">
              <div className="sheet-history-title"><span>RECENT SHEETS</span><em>{sheetHistory.length}/10</em></div>
              {sheetHistory.slice(0, 10).map((item) => (
                <div className={`sheet-history-row ${connectedSheetUrl === item.url ? "active" : ""}`} key={item.url}>
                  <button type="button" className="sheet-history-open" title={item.url} onClick={() => connectGoogleSheet(item.url)}>
                    <strong>{item.name || fallbackSheetName(item.url)}</strong>
                    <small>{extractSheetId(item.url).slice(-8) || "saved link"}</small>
                  </button>
                  <button type="button" className="sheet-history-icon" title="Đổi tên" onClick={() => renameSheetHistory(item.url)}>✎</button>
                  <button type="button" className="sheet-history-icon danger" title="Xóa khỏi recent" onClick={() => removeSheetHistory(item.url)}>×</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => connectGoogleSheet()} disabled={connectionState === "loading" || isExporting}>{connectionState === "loading" ? "Loading..." : "Connect Sheet"}</button>
          <button type="button" className="refresh-button" onClick={refreshGoogleSheet} disabled={connectionState === "loading" || !connectedSheetUrl || isExporting}>↻ Refresh Data</button>
          <div className={`connection-status ${connectionState}`}>
            <div className="status-line"><span className="status-dot" /><strong>{connectionLabel}</strong></div>
            <p>{message}</p>{lastUpdated && <small>Last updated: {formatTime(lastUpdated)}</small>}
          </div>
        </div>

        <div className="source-divider"><span>OR</span></div>
        <label className={`excel-import-button ${isExporting ? "disabled" : ""}`}>Import Excel<input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} disabled={isExporting} hidden /></label>

        <div className="locator-card">
          <div className="unit-list-header"><span>FLOORPLAN LOCATOR</span><strong>ON DEMAND</strong></div>
          <button type="button" className="review-issues-button" onClick={connectBundledMasterplan} disabled={locatorState === "indexing"}>{locatorState === "indexing" ? "Indexing..." : "Use Bundled Masterplan"}</button>

          <div className="pdf-source-tabs">
            <button type="button" className={locatorSourceMode === "link" ? "active" : ""} onClick={() => setLocatorSourceMode("link")} disabled={locatorState === "indexing"}>Link</button>
            <button type="button" className={locatorSourceMode === "upload" ? "active" : ""} onClick={() => setLocatorSourceMode("upload")} disabled={locatorState === "indexing"}>Upload</button>
          </div>

          {locatorSourceMode === "link" ? (
            <div className="pdf-link-connect">
              <input type="url" value={locatorUrl} onChange={(e) => setLocatorUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") connectMasterPdfLink(); }} placeholder="Paste direct/public PDF link..." disabled={locatorState === "indexing"} />
              <button type="button" onClick={connectMasterPdfLink} disabled={!locatorUrl.trim() || locatorState === "indexing"}>{locatorState === "indexing" ? "Indexing..." : connectedLocatorUrl && connectedLocatorUrl !== DEFAULT_MASTER_PDF_URL ? "Reconnect & Index" : "Connect & Index"}</button>
              <small>Không tự tải PDF khi mở app để giữ startup nhẹ.</small>
            </div>
          ) : (
            <label className={`master-pdf-button ${locatorState === "indexing" ? "disabled" : ""}`}>
              {locatorFileName && !connectedLocatorUrl ? "Replace Master PDF" : "Upload Master PDF"}
              <input type="file" accept="application/pdf,.pdf" onChange={handleMasterPdf} disabled={locatorState === "indexing"} hidden />
            </label>
          )}

          {locatorFileName && (
            <div className="locator-file">
              <div><strong>{locatorFileName}</strong><span>{connectedLocatorUrl === DEFAULT_MASTER_PDF_URL ? "Bundled PDF · On demand" : connectedLocatorUrl ? "Linked PDF · Text Anchor Mode" : "Uploaded PDF · Text Anchor Mode"}</span></div>
              <em>{connectedLocatorUrl === DEFAULT_MASTER_PDF_URL ? "LOCAL" : connectedLocatorUrl ? "LINK" : "FILE"}</em>
            </div>
          )}

          <div className={`locator-status ${locatorState}`}>
            <span>{locatorMessage}</span>
            {locatorState === "indexing" && <div className="locator-progress"><i style={{ width: `${locatorProgress.total ? (locatorProgress.current / locatorProgress.total) * 100 : 0}%` }} /></div>}
          </div>

          {locatorState === "ready" && (
            <div className="locator-summary">
              <div><strong>{locatorSummary.ready}</strong><span>Ready</span></div>
              <div><strong>{locatorSummary.review}</strong><span>Review</span></div>
              <div><strong>{locatorSummary.notFound}</strong><span>Not Found</span></div>
            </div>
          )}
          <button className="review-issues-button" onClick={reviewIssues} disabled={!locatorSummary.review && !locatorSummary.notFound}>Review Issues</button>
        </div>

        <div className="export-panel">
          <div className="unit-list-header"><span>EXPORT</span><strong>{1080 * exportScale}×{1920 * exportScale}</strong></div>
          <div className="export-scale-picker">
            {[1,2,3,4,5].map((scale) => <button key={scale} type="button" className={exportScale === scale ? "active" : ""} onClick={() => setExportScale(scale)}>{scale}×</button>)}
          </div>
          <small className="export-scale-note">3× là preset cân bằng. 5× dùng cho zoom sâu / gửi dạng file.</small>
          <button type="button" className="export-current-button" onClick={exportCurrentPng} disabled={!selectedUnit || isExporting}>Export Current PNG</button>
          <button type="button" className="export-all-button" onClick={exportAllPng} disabled={!units.length || isExporting}>Export All · {units.length} Units</button>
          {exportMessage && <div className="export-status"><span>{exportMessage}</span>{isExporting && exportProgress.total > 0 && <div className="export-progress-track"><div className="export-progress-bar" style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }} /></div>}</div>}
        </div>

        <div className="unit-list-header"><span>UNITS</span><strong>{units.length}</strong></div>
        <div className="unit-selector">
          {!units.length && <div className="locator-status idle"><span>Chưa có unit · Connect Sheet hoặc Import Excel.</span></div>}
          {units.map((unit) => {
            const code = normalizeUnitCode(unit.unitCode);
            const result = locatorResults[code];
            const badge = statusLabel(result?.status, overrides[code]);
            return (
              <button key={unit.unitCode} className={`unit-select ${selectedUnit?.unitCode === unit.unitCode ? "active" : ""}`} onClick={() => { setSelectedUnitCode(unit.unitCode); setFineTuneUnitCode(null); }} disabled={isExporting}>
                <span className="unit-main"><strong>{unit.unitCode}</strong><em className={`floorplan-badge ${badge.className}`}>{badge.icon} {badge.text}</em></span>
                <span>{unit.priceEarly ? `${unit.priceEarly} tỷ` : "—"}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className={`component-stage ${isLayoutEditing ? "layout-studio-mode" : ""} ${fineTuneUnitCode ? "finetune-mode" : ""}`}>
        {lotEditorCode ? (
          <LotHighlightEditor unit={units.find((item) => normalizeUnitCode(item.unitCode) === lotEditorCode)} imageSrc={lotEditorData?.imageSrc} initialOverlay={lotEditorData?.initialOverlay} autoAnchor={lotEditorData?.autoAnchor} viewSignature={lotEditorData?.viewSignature} pinSrc={pinAssets.pin2D} onCancel={closeLotEditor} onSave={saveLotOverlay} />
        ) : fineTuneUnitCode ? (
          fineTuneLoading ? <div className="finetune-loading">Rendering PDF page…</div> : (
            <FloorplanFineTune key={`${fineTuneUnitCode}-${fineTuneResult?.selectedMatchIndex || 0}`} unit={fineTuneUnit} locatorResult={fineTuneResult} pageRender={fineTunePageRender} initialView={fineTuneInitialView} onCancel={() => { setFineTuneUnitCode(null); setFineTunePageRender(null); }} onSave={saveFineTune} onCandidateChange={changeFineTuneCandidate} onRenderVectorPreview={renderFineTuneVectorPreview} />
          )
        ) : (
          <>
            <header className="stage-header">
              <div><span>{isLayoutEditing ? "LAYOUT CALIBRATION" : "COMPONENT PREVIEW"}</span><h2>{isLayoutEditing ? "Edit Layout" : "PlotFlow Preview"}</h2></div>
              <div className="stage-actions">
                <strong>{selectedUnit?.unitCode || "NO DATA"}</strong>
                {!isLayoutEditing && (
                  <div className="preview-zoom-controls">
                    <button type="button" onClick={fitPreview}>Fit</button>
                    <button type="button" onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.05))}>−</button>
                    <strong>{Math.round(previewZoom * 100)}%</strong>
                    <button type="button" onClick={() => setPreviewZoom((z) => Math.min(1, z + 0.05))}>+</button>
                    <button type="button" onClick={() => setPreviewZoom(1)}>100%</button>
                  </div>
                )}
                {selectedLocator?.matches?.length > 0 && !isLayoutEditing && <button className="edit-floorplan-top" onClick={() => openFineTune()}>⌖ Edit Floorplan View</button>}
                {selectedLocator?.matches?.length > 0 && !isLayoutEditing && <button className="edit-floorplan-top lot-button" onClick={() => openLotEditor()}>✦ Lot Highlight</button>}
                <button type="button" className={isLayoutEditing ? "edit-layout-button active" : "edit-layout-button"} onClick={() => setIsLayoutEditing((current) => !current)} disabled={isExporting}>{isLayoutEditing ? "✓ Done" : "⌘ Edit Layout"}</button>
              </div>
            </header>
            <div ref={componentCanvasRef} className="component-canvas round1-canvas">
              <PosterCanvas
                unit={previewUnit}
                assets={selectedAssets}
                isEditing={isLayoutEditing}
                placeholderMode={!selectedUnit}
                floorplanStatus={selectedLocator?.status}
                onEditFloorplan={selectedLocator?.matches?.length ? () => openFineTune() : null}
                onEditLot={selectedLocator?.matches?.length ? () => openLotEditor() : null}
                onChooseAsset={selectedUnit ? (type) => setAssetPickerType(type) : null}
                lotOverlay={selectedLotOverlay?.stale ? null : selectedLotOverlay}
                previewZoom={previewZoom}
              />

              {selectedUnit && !isLayoutEditing && (
                <aside className="design-assignment-dock">
                  <div className="dock-heading"><span>DESIGN ASSIGNMENT</span><strong>{selectedUnit.unitCode}</strong></div>
                  <AssetChip label="House" asset={houseCatalog.find((item) => item.id === selectedAssignment.houseId)} onClick={() => setAssetPickerType("house")} emptyLabel="Choose house" />
                  <AssetChip label="Amenity 01" asset={amenityCatalog.find((item) => item.id === selectedAssignment.amenity1Id)} onClick={() => setAssetPickerType("amenity1")} emptyLabel="Choose amenity" />
                  <AssetChip label="Amenity 02" asset={amenityCatalog.find((item) => item.id === selectedAssignment.amenity2Id)} onClick={() => setAssetPickerType("amenity2")} emptyLabel="Choose amenity" />
                  <AssetChip label="Logo" asset={logoCatalog.find((item) => item.id === selectedAssignment.logoId)} onClick={() => setAssetPickerType("logo")} emptyLabel="No logo" />
                  <div className="dock-badges">
                    <span>BADGES</span>
                    <button type="button" className={selectedAssignment.badges.includes("BADGE_HOT_DEAL") ? "active" : ""} onClick={() => toggleBadge("BADGE_HOT_DEAL")}>Hot Deal</button>
                    <button type="button" className={selectedAssignment.badges.includes("BADGE_VE_O_SOM") ? "active" : ""} onClick={() => toggleBadge("BADGE_VE_O_SOM")}>Về ở sớm</button>
                  </div>
                  <label className="pin-toggle"><input type="checkbox" checked={selectedAssignment.pin3DVisible} onChange={(e) => patchSelectedAssignment({ pin3DVisible: e.target.checked })} /><span>Show 3D Pin</span></label>
                  <button type="button" className="dock-layout-button" onClick={() => setIsLayoutEditing(true)}>⌘ Position in Edit Layout</button>
                  {selectedLotOverlay?.stale && <div className="dock-warning">△ Floorplan view đã đổi · highlight cần review lại.</div>}
                </aside>
              )}
            </div>
          </>
        )}
      </main>

      <FocusDeck />

      <AssetPicker open={assetPickerType === "house"} title="Choose House Model" subtitle="Chọn bằng thumbnail; Sheet vẫn có thể preset bằng tên mẫu nhà." catalog={houseCatalog} value={selectedAssignment.houseId} onSelect={(id) => { patchSelectedAssignment({ houseId: id }); setAssetPickerType(null); }} onClose={() => setAssetPickerType(null)} />
      <AssetPicker open={assetPickerType === "amenity1" || assetPickerType === "amenity2"} title={assetPickerType === "amenity1" ? "Choose Amenity 01" : "Choose Amenity 02"} subtitle="Featured amenities only." catalog={amenityCatalog} value={assetPickerType === "amenity1" ? selectedAssignment.amenity1Id : selectedAssignment.amenity2Id} onSelect={(id) => { patchSelectedAssignment(assetPickerType === "amenity1" ? { amenity1Id: id } : { amenity2Id: id }); setAssetPickerType(null); }} onClose={() => setAssetPickerType(null)} />
      <AssetPicker open={assetPickerType === "logo"} title="Choose Project Logo" subtitle="Logo là layer động; có thể hide hoặc đổi variant." catalog={logoCatalog} value={selectedAssignment.logoId} allowNone onSelect={(id) => { patchSelectedAssignment({ logoId: id }); setAssetPickerType(null); }} onClose={() => setAssetPickerType(null)} />
    </div>
  );
}

function AssetChip({ label, asset, onClick, emptyLabel = "Choose" }) {
  return (
    <button type="button" className="design-asset-chip" onClick={onClick}>
      <span>{label}</span>
      <div>{asset ? <img src={asset.thumbnailSrc || asset.src} alt="" /> : <i>＋</i>}<strong>{asset?.name || emptyLabel}</strong></div>
      <b>›</b>
    </button>
  );
}

export default App;