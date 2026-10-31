# Import and cache polish implementation plan

> Execute inline using superpowers:executing-plans, with regression tests before fixes.

**Goal:** Actionable PL/EN import errors and persistent Mio cache warnings.

**Approved design:** Keep the existing dialog/status UI. Translate import issues with field and row context when available. Retain cache warnings alongside operation status until storage succeeds. No parser, BIN, source or deployment changes.

**Architecture:** Existing locale dictionaries supply issue guidance. The source cache reports a separate cache-failure flag; the app appends its existing translated warning.

**Tech stack:** JavaScript, Node tests, Playwright Chromium. No dependencies.

## Tasks

- [x] Add failing cache tests for GET/HEAD persistence failures, offline retention and successful recovery; add browser tests for visible warnings and translated malformed imports.
- [x] Update `web/source-cache.js`, its caller in `web/app.js`, `web/import-dialog.js` and both locale dictionaries. File-wide errors must not display row zero; CSV record/feature indices must not pretend to be physical line numbers.
- [x] Run Node tests, browser tests, web build and diff checks; review the complete diff.
- [x] Update README/TODO with results and remaining Firefox/WebKit/hardware limitations.

## Review focus

Failed reads, repeated failed writes, unavailable network checks, successful persistence after failure, unknown issue fields/codes and file-wide errors. Preserve usable in-memory bytes and unchanged projects after failed imports. Keep schema field names as written in the source so users can find them.

## Results

239 Node tests pass; 65 Chromium tests pass, one optional live-source skip. Build and diff checks pass. Independent review found a CSV count-limit index mismatch; file-wide presentation and PL/EN regressions resolve it. Existing private-sample tests now pin both July and September downloads. Separate live Mio browser test passes (one GET, one HEAD, no repeat download). User authorized commit/push after live success; deployment remains unverified.
