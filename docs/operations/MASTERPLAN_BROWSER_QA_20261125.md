# PDF, raster, tiles and browser memory baseline

Stacked on Draft #72; reuses the browser smoke approach from #59, now with full assets and locked dependencies. No application UI or source assets changed. CI checks a synthetic cross-tile crop, original/built PDF byte equality and PDF signature, all declared page-1 tiles against Overview runtime dimensions and levels (metadata, not full pixel decode), and reports missing lot raster/tile declarations separately. The checked repository contains a page pyramid; lot assets may be intentionally absent, so those are diagnostic release findings, not silently treated as acceptance.

Browser test uses local Chromium only, blocks remote requests and non-GET/HEAD, blocks WebSockets, and exercises existing raster camera events (fit/zoom/pan/reset), then repeated navigation with heap, DOM and tile samples. Camera events test the raster listener, not physical mouse interaction. No real state, imports, saving, export, Azure access or production deployment. Memory counters are diagnostic, not a proof of leak-free behavior or actual process RAM. Real Windows/macOS and Detail/Fine Tune, full PDF decoding/locator/export and visual QA remain required.

Keep #72 unchanged for rollback. Actual downloaded backup and Azure restore still unverified. Do not merge or deploy production without explicit approval.
