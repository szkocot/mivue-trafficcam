# Compatible source and OPP merges

User requests all fitting points, including OPPs, to be mergeable and shown on the map, using CANARD kierunek. Keep explicit review: 100 m point candidates with compatible types; complete existing 964→9128 section pairs with both endpoints and span tolerance. Unique, uncontested candidates may be preselected for a user-applied batch; ambiguous/multiple candidates remain selectable without automatic identity claims.

Add optional recordIds bindings while preserving legacy primary recordId and old projects. A source observation can associate with several compatible point records or complete section pairs. Validate pair integrity and protect deletions/coordinates/raw fields. Save/load/export, country selection, attribution, undo and reimport must retain every association. Batch apply is one transaction with a revision guard.

A paginated merge review permits unique bulk selection and manual ambiguous choices. Show both OPP endpoints/geometry and source direction evidence; merged endpoint records and connector are blue. Preserve named CANARD kierunek/nazwaKierunku as text and label road chainage separately; do not convert named text to a compass bearing. Car-speed minimum policy remains unchanged.

Verify matching/type/distance/range edge cases, multi-binding schema/legacy compatibility, country subset exports, unchanged BIN bytes, atomic undo/redo/stale rejection and PL/EN browser merge/map/persistence flows. Run actual 53,338-record/811-source evidence without guessing ambiguous identities, then update TODO and release evidence.
