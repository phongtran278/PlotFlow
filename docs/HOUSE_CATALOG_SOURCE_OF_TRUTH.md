# House Catalog Source of Truth

PlotFlow uses exactly one source for house images:

`assets/houses/`

Running `cd app && npm run setup` scans that folder and regenerates `app/src/data/generatedHouseCatalog.js`.

`houseCatalog` must contain only `generatedHouseCatalog`; no static/legacy house entries are allowed.

On the first run after this migration, PlotFlow clears historical per-unit `houseId` overrides from `plotflow-design-assignments-r1` so old selections cannot make two units with the same base key render different images. Amenity, logo, badge and pin settings are preserved. New manual house selections made after the migration remain supported.
