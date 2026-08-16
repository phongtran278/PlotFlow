import { useEffect, useMemo, useState } from "react";
import { openVectorPdf } from "../floorplan/pdfLocator.js";

export default function ManualFloorplanLocator({ pdfDoc: providedPdfDoc, initialPage = 1, busy = false, onCancel, onPick }) {
  const [pdfDoc, setPdfDoc] = useState(providedPdfDoc || null);
  const [pageNumber, setPageNumber] = useState(Math.max(1, Number(initialPage) || 1));
  const [zoom, setZoom] = useState(180);
  const [pageImage, setPageImage] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 1, height: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (providedPdfDoc) {
      setPdfDoc(providedPdfDoc);
      return;
    }
    let cancelled = false;
    openVectorPdf("/masterplan/masterplan.pdf").then((doc) => {
      if (!cancelled) setPdfDoc(doc);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [providedPdfDoc]);

  const totalPages = pdfDoc?.numPages || 1;
  const safePage = useMemo(() => Math.max(1, Math.min(totalPages, pageNumber)), [pageNumber, totalPages]);

  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      if (!pdfDoc) return;
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(safePage);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false });
        await page.render({ canvasContext: ctx, viewport, background: "#fff" }).promise;
        if (cancelled) return;
        setPageImage(canvas.toDataURL("image/png"));
        setPageSize({ width: canvas.width, height: canvas.height });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, safePage]);

  function pick(event) {
    if (!pageImage || !pdfDoc || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    onPick?.({ pageNumber: safePage, x, y, zoom, pageSize, pdfDoc });
  }

  return (
    <div className="manual-locator-shell">
      <div className="manual-locator-topbar">
        <div><span>MANUAL FLOORPLAN LOCATOR</span><strong>Chọn trang → chỉnh zoom → click đúng vị trí căn</strong></div>
        <div className="manual-locator-page-controls">
          <button type="button" onClick={() => setPageNumber((value) => Math.max(1, value - 1))}>←</button>
          <input type="number" min="1" max={totalPages} value={safePage} onChange={(e) => setPageNumber(Number(e.target.value) || 1)} />
          <b>/ {totalPages}</b>
          <button type="button" onClick={() => setPageNumber((value) => Math.min(totalPages, value + 1))}>→</button>
          <label>Zoom <input type="number" min="50" max="2000" step="10" value={zoom} onChange={(e) => setZoom(Math.max(50, Math.min(2000, Number(e.target.value) || 180)))} />%</label>
          <button type="button" className="manual-locator-close" onClick={onCancel}>Đóng</button>
        </div>
      </div>
      <div className="manual-locator-stage">
        {(loading || !pdfDoc) && <div className="manual-locator-loading">{pdfDoc ? `Đang render trang ${safePage}…` : "Đang mở masterplan…"}</div>}
        {pageImage && <button type="button" className="manual-locator-image" onClick={pick} title="Click đúng vị trí căn trên masterplan" disabled={busy}><img src={pageImage} alt={`Masterplan page ${safePage}`} draggable="false" /></button>}
      </div>
      <div className="manual-locator-hint">Auto không ra thì dùng đường dự phòng này: tìm đúng trang như Ctrl+F, click gần tâm mã căn. Có thể tăng Zoom trước khi click; bạn có thể mở lại và chọn lại bất cứ lúc nào.</div>
    </div>
  );
}
