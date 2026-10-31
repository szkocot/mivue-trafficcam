# Browser and MiVue 955W acceptance

Use the [published application](https://szkocot.github.io/mivue-trafficcam/). Record the date, browser/OS or device model/firmware, source hash and each result. Automated parser/browser success does not establish device acceptance.

## Before testing

1. Copy your current device database and card contents to a separate backup. Keep the official Mio download untouched. Save a full project backup before editing; country-scoped JSON is not a full project backup.
2. Use a spare compatible card where possible. Follow the instructions for your exact 955W firmware/model for card format, directory, installation and restoring the original file. This project has not verified a universal card path or firmware recovery procedure. Do not flash firmware as part of this test.
3. The official download inspected on 2026-10-31 has 53,338 records, size 1,532,826 bytes, version candidate `202609010125` and SHA-256 `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`. A newer official release can legitimately differ; record its own hash before testing.

## Browser checks

- Open the site in your normal browser and on your phone. Try both PL and EN. Verify the experimental notice, map/table selection and editing controls fit the display. Refusing map tiles must not prevent local-file work.
- On first use, let the official source load. Reload: the existing project should return, and a source update must not overwrite edits. Save a full project, reopen it and verify the edits, references and source notices.
- Change one coordinate, Apply, Undo, Redo, then Undo again. Close/reopen the browser and verify applied edits persist. Keep an external backup if the browser reports a storage failure; private browsing may not retain local data.
- Import a small valid CSV/GeoJSON, repeat it and confirm no duplicate observations. Import a duplicate-ID CSV and a malformed quoted field; check actionable PL/EN guidance and an unchanged project. Correct the file and retry.
- For OSM, select the OSM JSON format and a local Overpass JSON export containing speed-camera nodes. Check source IDs, raw tags, licence, reported speed/direction and reference-only state. Reimport an update and check manual edits survive. Unsupported enforcement ways/relations must produce a visible error, not an invented point/route.
- Export full BIN without edits and compare its SHA-256 with the input. Export a full project backup, select Poland and preview countries: confirm counts, review uncertain records and linked outside-country endpoints. Full backups must remain unfiltered. Data downloads should use country codes; the device filename remains `Speedcam_Data_FEU.bin`.
- If a reduced BIN is blocked by an unresolved link/header dependency, retain that blocker. Review reference/GeoJSON exports instead; do not rename a JSON/GeoJSON file to `.bin`.
- Test browser location once with permission refused and once granted. Check accuracy/time, Cancel and Clear. Clearing/reloading must not restore location history. Actual GPS accuracy and browser/provider prompts need this physical test.
- Check downloaded files in your normal Downloads/share workflow, particularly iOS/Safari. Confirm the files are nonempty and reopen them; automated desktop WebKit does not establish iPhone behavior.

## Device sequence

1. While parked, verify the device works with its backed-up original official database. Record the displayed firmware and any database/version information. Confirm you know how to restore the backup before replacing anything.
2. First install an **unchanged rebuilt** database using the model's documented process. It must be byte-identical to the official input; keep the required `Speedcam_Data_FEU.bin` name. Record whether installation and restart succeed. If installation fails, restore the original and stop this sequence.
3. Before trying a reduced/edited database, save its full source project, input/output hashes and build report. Only use output whose build completed without bypassing blockers. Coordinate/raw-field editing is not evidence that undocumented speed/direction bits are correct.
4. After a successful parked check, assess alerts on a familiar legal route. Use a passenger or review recorded observations after stopping. Compare point-camera and OPP approach/start/end behavior, displayed limits/distance and opposite-direction behavior against the original official file. Do not speed or interact with the editor/device while driving.
5. Record missing, extra or reversed alerts with the source record IDs/location and expected/observed behavior. Restore the original if results are unexpected; keep the failing generated file and project for diagnosis.

## Results to return

| Item | Your result |
| --- | --- |
| Date, browser/OS or device model and firmware | |
| Input filename, bytes and SHA-256 | |
| Output SHA-256, full/reduced scope and project backup | |
| Browser import/edit/recovery/download/location checks | |
| Parked installation/restart and original-file restoration | |
| Point-camera and OPP alerts, direction and displayed values | |
| Failure, record IDs/location, screenshot or exact message | |

Firmware inspection, headless engine tests and a valid binary layout do not replace these observations. Speed/direction/type meanings that remain unverified are listed in the binary research notes.

For byte comparison on macOS/Linux, retain distinct original and rebuilt paths:

```sh
shasum -a 256 original/Speedcam_Data_FEU.bin rebuilt/Speedcam_Data_FEU.bin
cmp original/Speedcam_Data_FEU.bin rebuilt/Speedcam_Data_FEU.bin
```

Equal hashes and a successful silent `cmp` establish byte identity. Use this for unchanged output; edited or country-reduced output should differ and requires the separate build/device checks. CSV/GeoJSON/reference exports represent supported data, while project JSON preserves the reopenable original BIN and edits. OSM source-file formatting, envelope and unrelated elements are outside the camera-node selection.
