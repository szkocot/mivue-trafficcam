# Vehicle direction and camera aim

The editor distinguishes vehicle alert direction from the physical aiming direction of a camera. CANARD's similarly named fields are not interchangeable.

## Evidence and presentation

- `limity[].typ.kierunek`: passenger-limit direction text. Exact approach (`najazd`) / departure (`odjazd`) wording can establish a source claim about traffic relative to the camera. Named places remain named destinations, not compass angles. Truck-only rows do not determine passenger-car capture mode.
- `limity[].typ.kierunekPikietazu`: limit applicability relative to road chainage. It is not a camera azimuth.
- `urzadzenie.nazwaKierunku1/2`: named section directions, retained as source text.
- `urzadzenie.masztKierunekPomiaru`: a separate mast-direction claim. It is displayed independently, including when it differs from the limit row. Different fields do not by themselves prove an upstream error or establish physical aim.
- Qualified Mio BIN record: in the inspected firmware branch, mode byte 19 = 1 consumes heading byte 17 as `2 × value`, compared with GPS heading. The UI labels this **Vehicle alert heading (Mio)**, with the record ID. Only researched types and byte values 0–179 are interpreted; deleted/unknown-type/other-mode records stay unclassified. This is firmware-scoped alert logic, not a surveyed road tangent or optical camera azimuth.

A selected BIN point gets an alert-heading arrow when its heading format is qualified. The legend explicitly distinguishes that arrow from physical camera aim. Merge candidates and selected details display the evidence separately; raw bytes are untouched.

If an exact passenger capture label establishes approach or departure and a qualified alert heading is available, the editor can calculate an explicitly **derived road-axis aiming estimate**: opposite travel for approach, same travel for departure. A roadside camera may be mounted at an angle to the road, so this estimate is never labelled as its physical optical azimuth. Both-direction, mixed or unspecified capture modes cannot establish a single aiming axis.

The existing generic source `direction` number is not silently reclassified as either travel or physical aim. Actual physical camera azimuth remains unknown until a source with that explicit meaning or a verified measurement is supplied. These display calculations never rewrite BIN direction bytes or change merge identity decisions.

## Actual CANARD/Mio check — 2026-11-02

All 811 cached detail responses were analyzed. None supplies an unambiguous passenger approach/departure label or physical camera azimuth. There are 256 point-camera records whose limit-row chainage differs from the mast field; those values remain separate rather than being joined into one direction.

For PP `91359960`, the car-limit row says `MALEJACY`; the mast says `Pikietaz rosnacy`; the associated Mio record `source:1357896` stores heading byte 50 / mode 1, giving a **100° alert heading** in the traced reader. The data does not establish the physical camera azimuth, so it remains unknown and no road-axis aiming estimate is fabricated.

OPP `91414277` names two opposite car-limit destinations but marks both rows `ROSNACY`; its truck-only row says `najazd i odjazd`. That truck row is not used to infer passenger capture mode or a physical bearing.

The unchanged official BIN rebuild retains SHA-256 `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`. Private machine-readable verification is `exports/direction-verification-2026-11-02/summary.json`.

The official [CANARD safety analysis report](https://www.canard.gitd.gov.pl/cms/documents/20123/159327/Raport%2BAnaliza%2Bstanu%2Bbezpiecze%C5%84stwa.pdf/039d9da1-7f44-655a-3b5b-8454408f3852?t=1651141683593), printed pages 51/54, distinguishes approach/departure from increasing/decreasing chainage. It does not define a physical-azimuth contract for these API fields. The bounded read-only download was 3,437,970 bytes, SHA-256 `1b78f7678d7fe259b2fbbe3405810235b9401d4a3774a6ac629cebeaa5ffe995`.
