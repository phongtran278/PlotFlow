import { useEffect, useRef } from "react";
import { releasePreparedFallbackPdf } from "../floorplan/pdfLocator";
import "./AutoFloorplanSource.css";

export default function AutoFloorplanSource() {
  const pendingLotHighlightRef = useRef(false);
  const bridgeButtonRef = useRef(null);
  const autoConnectKeyRef = useRef("");

  useEffect(() => {
    const root = document.getElementById("root") || document.body;
    let observer;
    let raf = null;
    let lotEditorWasOpen = Boolean(document.querySelector(".lot-editor-shell"));

    function removeBridge() {
      bridgeButtonRef.current?.remove();
      bridgeButtonRef.current = null;
    }

    function releaseRemovedEditorTree(node) {
      if (!(node instanceof Element)) return false;
      const editor = node.matches(".lot-editor-shell") ? node : node.querySelector?.(".lot-editor-shell");
      if (!editor) return false;

      editor.querySelectorAll("img").forEach((img) => {
        const src = img.currentSrc || img.src || "";
        try {
          img.removeAttribute("src");
          img.srcset = "";
        } catch {}
        if (src.startsWith("blob:")) {
          try { URL.revokeObjectURL(src); } catch {}
        }
      });
      editor.querySelectorAll("canvas").forEach((canvas) => {
        try {
          canvas.width = 1;
          canvas.height = 1;
        } catch {}
      });
      return true;
    }

    function releaseLotEditorMemory() {
      releasePreparedFallbackPdf().catch(() => {});
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent("plotflow:lot-memory-released"));
        });
      });
    }

    function findRealLotButton() {
      return document.querySelector(".stage-actions .lot-button:not(.lazy-lot-button)");
    }

    function findBundledButton() {
      const buttons = Array.from(document.querySelectorAll(".locator-card button"));
      return buttons.find((button) => String(button.textContent || "").includes("Use Bundled Masterplan"));
    }

    function findReviewButton() {
      const buttons = Array.from(document.querySelectorAll(".locator-card button"));
      return buttons.find((button) => String(button.textContent || "").trim() === "Review Issues");
    }

    function selectedUnitCode() {
      return document.querySelector(".unit-selector .unit-select.active .unit-main strong")?.textContent?.trim()
        || document.querySelector(".stage-actions > strong")?.textContent?.trim()
        || "";
    }

    function unitButtons() {
      return Array.from(document.querySelectorAll(".unit-selector .unit-select"));
    }

    function locatorState() {
      const status = document.querySelector(".locator-card .locator-status");
      if (!status) return "idle";
      if (status.classList.contains("indexing")) return "indexing";
      if (status.classList.contains("ready")) return "ready";
      if (status.classList.contains("error")) return "error";
      return "idle";
    }

    function locatorCounts() {
      const total = unitButtons().length;
      const summary = document.querySelector(".locator-card .locator-summary");
      const values = summary ? Array.from(summary.querySelectorAll("strong")).map((node) => Number(node.textContent || 0)) : [];
      return {
        total,
        ready: values[0] || 0,
        review: values[1] || 0,
        notFound: values[2] || 0,
      };
    }

    function selectedBadgeState() {
      const badge = document.querySelector(".unit-selector .unit-select.active .floorplan-badge");
      if (!badge) return "unindexed";
      if (badge.classList.contains("ready")) return "ready";
      if (badge.classList.contains("review")) return "review";
      if (badge.classList.contains("not-found")) return "not_found";
      return "unindexed";
    }

    function autoConnectPreparedMasterplan() {
      const buttons = unitButtons();
      if (!buttons.length || locatorState() !== "idle") return;
      const first = buttons[0]?.querySelector(".unit-main strong")?.textContent?.trim() || "";
      const last = buttons.at(-1)?.querySelector(".unit-main strong")?.textContent?.trim() || "";
      const key = `${buttons.length}:${first}:${last}`;
      if (autoConnectKeyRef.current === key) return;

      const bundled = findBundledButton();
      if (!bundled || bundled.disabled) return;
      autoConnectKeyRef.current = key;
      bundled.click();
    }

    function ensureSimpleLocatorCard() {
      const card = document.querySelector(".locator-card");
      if (!card) return;
      card.classList.add("plotflow-locator-simplified");

      let panel = card.querySelector(".plotflow-locator-simple");
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "plotflow-locator-simple";
        panel.innerHTML = `
          <div class="plotflow-locator-simple__status">
            <strong></strong>
            <span></span>
          </div>
          <div class="plotflow-locator-simple__selected"><span>Selected lot</span><strong>—</strong></div>
          <div class="plotflow-locator-simple__actions">
            <button type="button" class="plotflow-locator-simple__edit">✦ Edit Lot Highlight</button>
            <button type="button" class="plotflow-locator-simple__review">Review Issues</button>
          </div>`;
        card.querySelector(".unit-list-header")?.after(panel);

        panel.querySelector(".plotflow-locator-simple__edit")?.addEventListener("click", () => {
          const realButton = findRealLotButton();
          if (realButton) {
            realButton.click();
            return;
          }
          const bundled = findBundledButton();
          if (bundled && !bundled.disabled) {
            pendingLotHighlightRef.current = true;
            bundled.click();
          }
        });
        panel.querySelector(".plotflow-locator-simple__review")?.addEventListener("click", () => findReviewButton()?.click());
      }

      const counts = locatorCounts();
      const state = locatorState();
      const found = Math.max(0, counts.total - counts.notFound);
      const statusStrong = panel.querySelector(".plotflow-locator-simple__status strong");
      const statusText = panel.querySelector(".plotflow-locator-simple__status span");
      const selected = selectedUnitCode();
      const badgeState = selectedBadgeState();
      const edit = panel.querySelector(".plotflow-locator-simple__edit");
      const review = panel.querySelector(".plotflow-locator-simple__review");

      panel.querySelector(".plotflow-locator-simple__selected strong").textContent = selected || "—";

      if (!counts.total) {
        statusStrong.textContent = "Waiting for unit data";
        statusText.textContent = "Connect Google Sheets or import Excel first.";
      } else if (state === "indexing") {
        statusStrong.textContent = `Matching ${counts.total} lots…`;
        statusText.textContent = "Using the prepared masterplan in the background.";
      } else if (state === "ready") {
        statusStrong.textContent = `${found} / ${counts.total} lots found`;
        const notes = [];
        if (counts.notFound) notes.push(`${counts.notFound} not found`);
        if (counts.review) notes.push(`${counts.review} need review`);
        statusText.textContent = notes.length ? notes.join(" · ") : "All lots are connected and ready.";
      } else if (state === "error") {
        statusStrong.textContent = "Masterplan needs attention";
        statusText.textContent = "The prepared locator could not be loaded.";
      } else {
        statusStrong.textContent = `Preparing ${counts.total} lots…`;
        statusText.textContent = "PlotFlow will match the masterplan automatically.";
      }

      const editable = state === "ready" && (badgeState === "ready" || badgeState === "review");
      edit.disabled = !editable;
      edit.textContent = editable && selected ? `✦ Edit Highlight · ${selected}` : "✦ Edit Lot Highlight";

      const issueCount = counts.review + counts.notFound;
      review.hidden = state !== "ready" || issueCount === 0;
      review.textContent = issueCount ? `Review ${issueCount} issue${issueCount === 1 ? "" : "s"}` : "Review Issues";
    }

    function handOffIfReady() {
      const realButton = findRealLotButton();
      if (!realButton) return false;
      removeBridge();
      if (pendingLotHighlightRef.current) {
        pendingLotHighlightRef.current = false;
        requestAnimationFrame(() => realButton.click());
      }
      return true;
    }

    function ensureBridge() {
      if (handOffIfReady()) return;
      const stage = document.querySelector(".component-stage");
      const actions = stage?.querySelector(".stage-actions");
      const unitCode = actions?.querySelector("strong")?.textContent?.trim();
      const isEditor = stage?.classList.contains("layout-studio-mode") || stage?.classList.contains("finetune-mode");
      if (!actions || !unitCode || unitCode === "NO DATA" || isEditor) {
        removeBridge();
        return;
      }
      if (bridgeButtonRef.current?.isConnected) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "edit-floorplan-top lot-button lazy-lot-button";
      button.textContent = "✦ Lot Highlight";
      button.title = "Edit highlight for the selected lot";
      button.addEventListener("click", () => {
        const realButton = findRealLotButton();
        if (realButton) return realButton.click();
        const bundled = findBundledButton();
        if (!bundled || bundled.disabled) return;
        pendingLotHighlightRef.current = true;
        button.disabled = true;
        button.textContent = "… Loading Lot Highlight";
        bundled.click();
      });
      actions.insertBefore(button, actions.querySelector(".edit-layout-button") || null);
      bridgeButtonRef.current = button;
    }

    function reconcile() {
      raf = null;
      autoConnectPreparedMasterplan();
      ensureSimpleLocatorCard();
      ensureBridge();
    }

    function schedule() {
      if (raf != null) return;
      raf = requestAnimationFrame(reconcile);
    }

    reconcile();
    observer = new MutationObserver((records) => {
      let editorRemoved = false;
      records.forEach((record) => {
        record.removedNodes.forEach((node) => {
          if (releaseRemovedEditorTree(node)) editorRemoved = true;
        });
      });

      const editorIsOpen = Boolean(document.querySelector(".lot-editor-shell"));
      if ((lotEditorWasOpen && !editorIsOpen) || editorRemoved) releaseLotEditorMemory();
      lotEditorWasOpen = editorIsOpen;
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "disabled"] });

    return () => {
      observer?.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
      removeBridge();
      document.querySelector(".plotflow-locator-simple")?.remove();
      document.querySelector(".locator-card")?.classList.remove("plotflow-locator-simplified");
    };
  }, []);

  return null;
}
