# PlotFlow House Asset Naming

House images are matched by architecture code + property type + optional variant.
Do not use the marketing architecture style as the technical key because the same style can appear on multiple property types.

Canonical key:

`CH{code}_{TYPE}_{VARIANT}`

TYPE values:
- `LK` = Liền kề
- `SONG_LAP` = Song lập
- `DON_LAP` = Đơn lập

Common variants:
- `CAN_GOC`
- `XE_KHE`
- `SHOPHOUSE`
- `SAN_VUON`

Examples:
- `CH53_LK`
- `CH59_LK_XE_KHE`
- `CH75_SONG_LAP`
- `CH33_LK_SHOPHOUSE`
- `CH71_DON_LAP`

Recommended asset id: `HOUSE_<canonical key>`
Recommended filename: `<canonical key>.<png|jpg>`

Example:
`HOUSE_CH53_LK` -> `CH53_LK.jpg`

The human-facing architecture name remains in `architectureLabel`, e.g. `LIỀN KỀ - TÂN CỔ ĐIỂN`.
