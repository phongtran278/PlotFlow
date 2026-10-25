# Cleanup Phase 5 — Unit review CSS ownership

Consolidated `UnitReviewDrawer.css` into `UnitReviewBar.css`, preserving the **exact source-rule order** and selectors. `UnitReviewBar.jsx` now imports one stylesheet instead of two. No JSX or styling rules were changed.

This is a safe first CSS ownership consolidation: the same component owns both the review toolbar and its review drawer. The deleted CSS file remains in Git history. Verify CI and manually inspect collapsed/expanded drawer, mobile breakpoints and stacking before merging.
