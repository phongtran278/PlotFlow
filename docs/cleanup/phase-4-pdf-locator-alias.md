# Cleanup Phase 4 — Remove unused PDF locator re-export layer

`app/src/floorplan/pdfLocator.js` contained only a named re-export list from `pdfLocatorFacade.js`. The two active imports (`ManualFloorplanLocator.jsx` and `PosterCanvas.jsx`) have been changed to import the same functions from `pdfLocatorFacade.js` directly. No implementation or API behavior was modified.

**Regression gate:** existing npm tests + staging build, then manual Overview/Detail and Floorplan crop/locator smoke tests before merge. The canonical facade and implementation modules remain intact.
