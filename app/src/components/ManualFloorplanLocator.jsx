import { useEffect, useMemo, useState } from "react";

export default function ManualFloorplanLocator({ pdfDoc, initialPage = 1, onCancel, onPick }) {
  const [pageNumber, setPageNumber] = useState(Math.max(1, Number(initialPage) || 1));
  const [pageImage, setPageImage] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 1, height: 1 });
  const [loading, setLoading] = useState(false);

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
    if (!pageImage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    onPick?.({ pageNumber: safePage, x, y, pageSize });
  }

  return (
    <div className="manual-locator-shell">
      <div className="manual-locator-topbar">
        <div><span>MANUAL FLOORPLAN LOCATOR</span><strong>Chọn trang rồi click đúng vị trí căn</strong></div>
        <div className="manual-locator-page-controls">
          <button type="button" onClick={() => setPageNumber((value) => Math.max(1, value - 1))}>←</button>
          <input type="number" min="1" max={totalPages} value={safePage} onChange={(e) => setPageNumber(Number(e.target.value) || 1)} />
          <b>/ {totalPages}</b>
          <button type="button" onClick={() => setPageNumber((value) => Math.min(totalPages, value + 1))}>→</button>
          <button type="button" className="manual-locator-close" onClick={onCancel}>Đóng</button>
        </div>
      </div>
      <div className="manual-locator-stage">
        {loading && <div className="manual-locator-loading">Đang render trang {safePage}…</div>}
        {pageImage && <button type="button" className="manual-locator-image" onClick={pick} title="Click đúng vị trí căn trên masterplan"><img src={pageImage} alt={`Masterplan page ${safePage}`} draggable="false" /></button>}
      </div>
      <div className="manual-locator-hint">Nếu Auto Locate không bắt được mã, click gần tâm mã căn. Sau đó PlotFlow mở Fine Tune để bạn zoom/pan chính xác như bình thường.</div>
    </div>
  );
}
