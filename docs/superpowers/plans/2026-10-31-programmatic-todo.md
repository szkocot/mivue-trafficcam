# Programmatic TODO completion

**Goal:** Complete the existing TODO programmatically and leave evidence plus a manual browser/device test procedure.

**Execution:** User requested autonomous execution and subagents. Three independent agents own browser compatibility, source imports/research and binary research. The coordinator owns country filenames, release verification, integration and the handoff. Work stays in this shared checkout with explicit file ownership; no concurrent commits.

**Approach:** Extend existing JS parsers, worker and Playwright checks. Prefer local attributed OSM exports over a proxy/service. Add only evidence-backed binary structures; unknown field meanings remain blocked. Preserve original project backups, attributed source references, manual edits and conservative BIN validation.

- [x] Verify the already-pushed release workflow and public-site smoke behavior.
- [x] Add Firefox/WebKit projects and CI coverage; fix observed compatibility failures and run live source checks.
- [x] Research current CANARD/OSM evidence; implement a bounded attributed OSM import with trust-boundary tests where supported.
- [x] Investigate header/link/field evidence, implement verified structural variants with synthetic and real byte-identical tests, document remaining semantic blockers.
- [x] Use reviewed ISO codes for scoped data filenames, stable-ID fallback, unchanged device BIN name and report IDs; test mixed selections.
- [x] Run integrated tests/build/artifact checks and independent review, resolving important findings.
- [x] Update TODO/README/research evidence and prepare manual browser/device acceptance and recovery instructions.
- [ ] Commit/push the verified increment and check the deployment, continuing the user-authorized release workflow.

**Limits:** No firmware execution, proprietary artifact publication, guessed semantic encoding, force-build bypass or physical-device success claim. Real mobile/browser provider GPS and camera alert behavior require the user's tests.

## Verification

256 Node tests pass with both private variants;201 browser checks pass across three engines,3opt-in skips;3live Mio tests pass. Both allowlisted build modes pass. Independent review found no actionable issues. OSM/source and firmware-semantic blockers are explicit in the TODO; manual acceptance remains user work.
