# Travel and physical camera direction

The user requests both monitored vehicle/alert direction and the camera's physical aiming direction, using CANARD kierunek. Separate these concepts and their provenance: named passenger directions, limit-row road-chainage claims, the independent mast claim, firmware-scoped Mio alert heading, and physical optical azimuth.

Use exact passenger-row approach/departure text when supplied. A qualified Mio record's mode-1 heading is byte17 ×2 in the traced reader; do not interpret other modes/codes. Approach reverses the road-axis aiming estimate relative to traffic; departure keeps it. Such an estimate is not an optical camera azimuth, and bidirectional/unknown capture modes cannot determine one. Existing CANARD responses contain no numeric physical camera azimuth, so show that as unknown with the specific reason rather than inventing it.

Expose separate metadata/merge-review rows, flag contradictory mast/limit claims, and draw a selected BIN point's qualified alert-heading arrow with a clear legend. Keep every original field and all BIN bytes untouched. Do not reinterpret the existing generic source direction number as universally travel or camera-facing.

Test contradictory real-shaped PP and OPP examples, truck-only capture labels, both/unknown modes, heading format/type guards, input immutability, explicit derived-axis labels, PL/EN UI/arrow/persistence and exact BIN output. Verify against the cached CANARD/Mio inputs and retain physical aiming as unverified where unsupported.
