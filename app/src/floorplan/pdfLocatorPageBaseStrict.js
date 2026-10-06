import { renderPdfPageBase as renderPreparedPdfPageBase } from "./pdfLocatorPrepared.js";

// Bundled masterplan pages are runtime coordinate surfaces, not images.
// Keeping the full-page prepared preview on pageRender.dataUrl lets editor DOM
// accidentally decode and compositor-scale that raster at 1000–2000% zoom.
// The strict raster runtime already renders the visible crop from 512px tiles,
// so strip the page-wide image for prepared pages and keep only geometry.
export async function renderPdfPageBase(pdfDoc, pageNumber, scale = 1) {
  const page = await renderPreparedPdfPageBase(pdfDoc, pageNumber, scale);
  if (!page?.__plotflowPrepared) return page;
  return {
    ...page,
    dataUrl: null,
    coordinateOnlyPage: true,
  };
}
