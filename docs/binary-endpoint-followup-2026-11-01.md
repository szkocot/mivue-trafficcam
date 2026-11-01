# Endpoint state and anomalous links — 2026-11-01

This is a bounded continuation of the [reader follow-up](binary-reader-followup-2026-11-01.md), using the same private ARM ELF and two pinned databases. It adds instruction-level endpoint-state evidence and classifies the bytes at every unresolved target. No firmware was executed. No product code, labels, encoder guards or source bytes were changed.

## From raw endpoint codes to state-machine calls

Previously verified: the decimal suffix conversion maps raw 964 to internal `0x1000` (category 1) and raw 9128 to `0x2000` (category 2). Following the selected-camera branch beyond that conversion gives a materially stronger distinction:

1. `EDOGCtrl_CheckSpeedCamera` calls `Autodoria_POItype` at `0x90d04`. Category 1 branches at `0x90d0c` to `0x91574`.
2. `0x91574–0x9158a` loads the selected record's last word, initializes two output doubles, then calls `Autodoria_NtoA`. The latter directly seeks to that absolute file offset and decodes the first two doubles, as previously established.
3. `0x9158e–0x915a8` passes `r0=1`, the selected speed in `r1`, **linked coordinates in `d0/d1`**, and **the selected record's own coordinates in `d2/d3`** to `EDOGCtrl_Autodoria`.
4. Category 2 instead takes `0x90d14–0x90d4e`: command 0 looks up the selected coordinates against retained slots, then command 2 handles those same coordinates. This path does not obtain the raw 9128 record's zero final word or dereference a reverse link.

This means the outward reference on a raw 964 record is not merely an arbitrary counterpart identifier: in this reader branch its target coordinates become the retained destination against which later observations are compared. The raw 9128 record is handled as a destination observation. Combined with the explicit `SC_Autodoria_Start.wav` branch for `0x1000`, this supports an **entry/registration versus destination role in the traced firmware branch**. It does not establish official cross-device enum names, every state transition, or how all roads/overlapping sections should be modeled. The existing generic endpoint labels remain unchanged pending independent review.

There is another candidate-processing branch at `0x912d2–0x9130a` which dereferences the same last-word field and invokes command 5 with linked coordinates and source coordinates. It must be included in any complete role audit; it should not be silently assumed equivalent to command 1.

## Two complete destination slots, not a start slot plus an end slot

The GOT base resolves to `0x172000`; the entry at `0x172efc` contains `0x275870`. The dynamic symbol table identifies `endpoint` at **`0x275870`, size `0x40`**. Runtime accesses use a 32-byte stride and slot indexes 0/1. These are **two retained destination records**, not proof that array indexes 0 and 1 themselves mean start and end.

The traced per-slot structure is:

| Offset | Observed state content |
| --- | --- |
| `+0` / `+8` | Destination latitude/longitude doubles |
| `+0x10` | Speed byte |
| `+0x14` | An integer counter initialized from a distance/speed expression and subsequently decremented |
| `+0x18` | State byte; 0 and 1 have explicit inactive/active behavior in average-speed and distance helpers |
| Remaining bytes | Not assigned complete meanings here |

Command 1 begins at `0x90056`. It compares linked coordinates with already retained destinations and selects an available slot; if both are occupied, the branch at `0x901ac–0x901e8` compares distance-helper results and clears one slot before registration. At `0x900ba`, `0x900cc` and `0x900be`, it stores linked coordinates and the selected record's speed.

The value stored at `+0x14` (`0x900fe`) is calculated through `DistanceGCD`, addition of the **binary64 literal 52.0 at `0x90390`**, unsigned conversion, multiplication by 36 and integer division by `10 × speed` (`0x900c0–0x900f4`). The command-5 path contains the analogous expression at `0x90222–0x9025e`. For ordinary finite values without integer overflow the instruction arithmetic is:

```text
uint32(36 × uint32(DistanceGCD(destination, source) + 52.0)) / (10 × speed)
```

This is a code observation, **not an authoritative section length or legal minimum travel time**. The unusual 52.0 adjustment, straight-line distance, unsigned truncation and update timing must be understood before exposing such a value to users. The inspected linked endpoints have nonzero speed values; behavior with a fabricated zero-speed endpoint was not established or tested.

`EDOGCtrl_Autodoria_Second` (`0x903d0`) tests active slot flags and decrements a positive `+0x14` counter at `0x903f0–0x903fa` / `0x90412–0x9041c`. Its symbol name does not establish call frequency by itself. `Second_Done` (`0x90438`) clears exhausted slot storage and resets related indices. Full scheduler/caller timing remains unaudited.

## Activation, destination observation and displayed average

`Autodoria` command 8 is selected at `0x8ffa0–0x8ffa2` and enters `0x902dc`, which prints **`distance < 250m`**. It uses retained candidate indexes to set a slot's state byte to 1 (`0x90350` / `0x90386`), after checking that the slot has a nonzero speed. This is the activation boundary in the traced path, not simply file import or loading a raw 964 record.

Command 2 begins at `0x90106`, compares incoming destination coordinates to slot coordinates, and records a matching candidate index (`0x9012e–0x90136` / `0x90158–0x90162`). In command 8, that matched index can reach the **`endpoint[%d] is done`** log (`0x90374`) and slot deletion (`0x9037c`). Command 7 prints **`distance > 250m`** and clears retained candidates/slots through `DestroyCanelOne`; command 9 resets both slots. The 250 m log strings document the branch's intended threshold description, but complete caller conditions, tie-breaking and GPS uncertainty behavior still need tracing.

`EDOGCtrl_Autodoria_Check` (`0x8fdc8`) selects an active slot, returns its stored speed, requests the average-speed helper's retained result and requests distance-to-destination. If both slots are active it compares distance-helper results. This further confirms that each slot represents a whole retained destination context rather than half of one pair.

A useful caution: `EDOGCtrl_Autodoria_AvgSpeed` (`0x8fb6c`) mode 1, when the slot state equals 1, increments a sample count, adds the incoming integer speed to an accumulator and divides accumulator by count (`0x8fbcc–0x8fbf0`). Call sites such as `0x90fa0–0x90fb2` obtain that integer by converting the current GPS speed double at `+24`. Thus this helper computes an **integer arithmetic mean of supplied speed samples**; it is not demonstrated to compute a distance divided by elapsed time. Sample cadence, skipped updates and physical accuracy are outside this bounded audit. No enforcement-equivalent average-speed calculator should be inferred from its function name.

## Every anomalous target classified by actual container bytes

For each parser link warning, the last-word value was treated exactly as the traced reader treats it: an absolute start for two little-endian binary64 coordinate inputs. Independently of the target's alleged type, its actual container was determined from all parsed record spans and cell-header spans.

| Sample | Missing targets in a record interior | Missing targets in a cell header | Wrong-type targets at exact record starts |
| --- | ---: | ---: | ---: |
| Official `202609010125` | 7 | 4 | 2 |
| Bundled `202509020125` | 6 | 3 | 0 |

Official missing-target positions:

| Source offset | Stored target | Actual container position |
| ---: | ---: | --- |
| 921988 | 821950 | Record +6 |
| 922100 | 821586 | Record +6 |
| 1000140 | 822482 | Record +14 |
| 1034500 | 1000206 | Cell header +8 |
| 1072780 | 1034594 | Cell header +0 |
| 1215972 | 1246374 | Record +18 |
| 1238908 | 1284546 | Record +8 |
| 1278060 | 1296450 | Record +26 |
| 1289264 | 1293122 | Record +26 |
| 1323048 | 1166928 | Cell header +8 |
| 1432510 | 1477554 | Cell header +0 |

Bundled missing-target positions, in source-offset order, are: record +24, record +4, cell header +6, cell header +8, record +18, record +12, record +12, record +12, cell header +8. These positions are incompatible with a single universal byte-offset adjustment.

None of the 11 official or nine bundled missing-target byte locations supplies a pair of valid DDMM coordinate inputs lying inside the dataset's geographic coverage. Some decode to finite tiny values outside Europe, some to enormous values, and some contain NaN. This is a **read-only characterization of the raw inputs**, not a claim to have emulated ARM floating-point-to-integer behavior or observed the resulting firmware display.

The two official unexpected-type references do point at valid raw-type-1 coordinate records, but geographically distant ones:

| Source offset → target offset | Referenced coordinate | Straight-line source-to-target distance |
| --- | --- | ---: |
| `1238068 → 1310386` | `56.7299261, 15.3435907` | ≈916.813 km |
| `1238376 → 1310190` | `56.8580611, 15.0373794` | ≈916.040 km |

Distances use the standard haversine calculation with a 6,371 km spherical radius. They are diagnostic distances, not road-section lengths. `NtoA` itself does not check the target's raw type and would read these coordinate inputs; that does not make them intended partners. The intended targets remain unidentified. Nearest address, nearest physical point, speed equality or type equality alone cannot establish a repair.

All valid outward links remain one-to-one in each sample. The unexplained references leave respectively **13 / 9** raw-9128 records without an incoming link from the valid subset. Equal source/target type counts are therefore not evidence that the missing pairings can be recovered uniquely.

## Next safe increment and proof gaps

The new evidence supports an independently reviewed **read-only relationship inspector** for already validated 964 → 9128 links: preserve both raw codes, display source and destination coordinates and the exact pointer, and mark missing/wrong-type references unresolved. Straight-line distance can be presented only with that explicit label; no inferred road geometry, legal timing or automatic pairing follows. This is a proposed next increment, not a feature implemented by this research.

A firmware-scoped entry/destination role annotation now has stronger support than before through the category-1 registration/category-2 observation paths and the start-voice consumer. Before promoting it to definitive cross-device labels, audit command 5 and all customer/state branches, the scheduler cadence, mixed ARM/Thumb callers and real-device transitions. The arithmetic sample average and 52.0 distance adjustment also need explicit interpretation. No malformed link repair, semantic editor, exported binary change or guard relaxation is justified by the unresolved cases above.
