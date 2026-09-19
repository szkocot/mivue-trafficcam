# Initial binary-format investigation

These findings describe one local sample, not a general MiVue specification. Structural observations are distinguished from inferred field meanings. No device testing or encoding has been performed.

## Sample identity

- File: `Speedcam_Data_FEU.bin` (not distributed)
- Size: 1,521,542 bytes
- SHA-256: `2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0`
- Embedded ASCII at offset 24: `202607060125`. This looks like a timestamp/version string; its meaning is unconfirmed.
- Observed records: 52,935. These are records, not necessarily unique physical cameras.

All multibyte numeric fields described below use little-endian byte order. Offsets are absolute byte offsets unless stated otherwise.

## Header and spatial index

| Offset | Encoding | Observed value | Interpretation |
| --- | --- | --- | --- |
| 0 | 4 × signed 16-bit | -8, 36, 31, 70 | Longitude minimum, latitude minimum, longitude maximum, latitude maximum |
| 8 | 2 × unsigned 16-bit | 20, 20 | Cell-grid dimensions within populated regions |
| 12 | 2 × unsigned 16-bit | 3, 3 | Regional grid dimensions |
| 16 | 4 raw bytes | `04 20 20 20` | Unknown |
| 20 | unsigned 32-bit | 82 | Unknown; also equals the first populated region's offset |
| 24 | 12 ASCII bytes | `202607060125` | Date/version candidate |
| 36 | 9 × unsigned 32-bit | See below | Region offsets |

Region ordering is latitude-major, then longitude. Each region starts with a 10-byte header: `<H4h`, meaning a record count followed by latitude minimum, longitude minimum, latitude maximum, longitude maximum.

| Region | Offset | Stored bounds (lat min, lon min, lat max, lon max) | Records |
| --- | --- | --- | --- |
| 0 | 72 | 36, -8, 47, 5 | 0 |
| 1 | 82 | 36, 5, 47, 18 | 25,068 |
| 2 | 707596 | 36, 18, 47, 31 | 2,171 |
| 3 | 773994 | 47, -8, 58, 5 | 13,437 |
| 4 | 1155840 | 47, 5, 58, 18 | 5,699 |
| 5 | 1321022 | 47, 18, 58, 31 | 3,332 |
| 6 | 1419928 | 58, -8, 70, 5 | 0 |
| 7 | 1419938 | 58, 5, 70, 18 | 1,457 |
| 8 | 1466344 | 58, 18, 70, 31 | 1,771 |

Empty regions consist only of their 10-byte header. Each populated region has 400 unsigned 32-bit cell offsets immediately after its header. Each cell has another `<H4h` header followed directly by `count × 28` record bytes. Empty cells still have a header. There are 2,800 cells: 898 populated and 1,902 empty.

The integer bounds lose precision. Do not use them as exact clipping boundaries: that would incorrectly flag 493 records at the regional level. Instead, divide the global latitude span (36–70) into three equal parts and longitude span (-8–31) into three equal parts, then subdivide each region into 20×20 cells. Every decoded record matches its expected cell using those fractional boundaries and latitude-major ordering.

The entire file is accounted for by:

```text
36-byte header
+ 9 × 4-byte regional offsets
+ 9 × 10-byte regional headers
+ 7 × 400 × 4-byte cell offsets
+ 7 × 400 × 10-byte cell headers
+ 52,935 × 28-byte records
= 1,521,542 bytes
```

There is no unaccounted trailer in this sample. This does not establish whether any existing header field provides integrity checking.

## Record layout

Offsets in this table are relative to the record start. Python's `struct` format `<ddBBBBII` describes the observed 28-byte layout, although the final two words may contain packed subfields.

| Offset | Encoding | Observation / candidate meaning |
| --- | --- | --- |
| 0 | IEEE-754 binary64 | Latitude in degrees-and-decimal-minutes numeric notation |
| 8 | IEEE-754 binary64 | Longitude in degrees-and-decimal-minutes numeric notation |
| 16 | unsigned byte | Likely speed limit; values include 0, 30, 50, 70, 90, 120, 130 |
| 17 | unsigned byte | Values 0–179; candidate heading in two-degree units |
| 18 | unsigned byte | Always 0; meaning unknown |
| 19 | unsigned byte | Always 1; meaning unknown |
| 20 | unsigned 32-bit | Type/flags candidate; preserve as raw value |
| 24 | unsigned 32-bit | Zero or candidate absolute counterpart-record offset |

For a coordinate `v`, convert using truncation toward zero:

```text
degrees = trunc(v / 100)
decimal_degrees = degrees + (v - degrees * 100) / 60
```

For example, the record at offset 2032 contains latitude `3706.648474` and longitude `1400.887352`, which decode to approximately `37.1108079, 14.0147892`. Negative longitude requires signed conversion, not floor division. All records have valid minute components and match the fractional spatial grid. Simply dividing the stored values by 100 gives 29,384 cell mismatches.

Decoded coverage spans approximately latitude 36.7224118–69.9658529 and longitude -7.2984308–30.3243819. This is a wider European dataset, not a Poland-only file. A rectangular Poland filter also includes neighboring countries and cannot provide a reliable Polish record count.

Speed-byte values such as 32, 48, 64, 97, and 113 could represent conversions from mph. Units, zero semantics, heading interpretation, and exact type meanings remain unverified.

## Candidate section links and anomalies

| Raw word at offset 20 | Record count |
| --- | --- |
| 1 | 36,298 |
| 3 | 6,061 |
| 5 | 192 |
| 964 (`0x000003C4`) | 5,192 |
| 9128 (`0x000023A8`) | 5,192 |

All 5,192 records with word 964 have a nonzero final word. All other records have a zero final word. Of these candidate links, 5,179 target the exact start of a record with word 9128. This strongly suggests paired endpoints, potentially for average-speed enforcement, but does not establish endpoint roles or official type codes. Equal type counts alone do not prove a one-to-one pairing.

Thirteen candidate links do not follow the usual pattern:

| Source record offset | Target offset | Observation |
| --- | --- | --- |
| 909920 | 809938 | Not a record start |
| 910032 | 809574 | Not a record start |
| 988856 | 810470 | Not a record start |
| 1023776 | 988922 | Not a record start |
| 1062504 | 1023898 | Not a record start |
| 1205780 | 1235846 | Not a record start |
| 1227652 | 1299774 | Targets raw type 1 |
| 1227960 | 1299578 | Targets raw type 1 |
| 1228492 | 1273570 | Not a record start |
| 1267224 | 1285670 | Not a record start |
| 1278484 | 1282426 | Not a record start |
| 1312772 | 1157548 | Not a record start |
| 1422122 | 1466214 | Not a record start |

Preserve these values during research. Do not silently repair them or assume the source database is corrupt: the pointer interpretation may have exceptions.

## Verification performed and next work

Read-only inspection used `file`, `xxd`, `shasum -a 256`, and Python's standard-library `struct` and `collections` modules. Checks covered all regional and cell counts, exact record spans, total byte accounting, coordinate-grid membership, field distributions, and candidate link targets. No sample bytes were changed.

Next steps are a reproducible read-only parser with raw-field preservation, malformed-input validation, and exports; comparison against known camera and OPP locations; and investigation of the 13 link anomalies. A byte-identical decode/re-encode check should precede editing or rebuilding for a device. Device compatibility and successful installation remain untested.
