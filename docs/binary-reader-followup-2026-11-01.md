# Reader follow-up — 2026-11-01

This continues the [2026-10-31 static trace](binary-research-2026-10-31.md) of the same privately extracted `cardv` executable (SHA-256 `150fbe9ed0496d663f69fcbc10339d77f078ad8f4fbddeb44a2dff7839af9bb1`). All addresses are ELF virtual addresses in this one firmware version. Only read-only parsing and Thumb disassembly were used; the executable was never run. No database bytes or disassembly are distributed here.

## Speed byte: direct km/h and zero evidence

The raw record loop's `r5` points at record + 16. Its first byte is copied to the speed output (`0x914a8–0x914b0`; the customer-specific branch also uses `0x9095a–0x909e6`). The caller `EDOGCtrl_Handler` sets that output argument to stack + `0x17` (`0x91b7c`), calls `EDOGCtrl_CheckSpeedCamera` (`0x91b92`), reloads the resulting byte (`0x91bf6`), and stores it without conversion to `POSITIONINFO + 0x4e` (`0x91c18`). This closes the previously incomplete raw-byte-to-alert-field chain.

`VideoFunc_SpeedLimitedSound(POSITIONINFO*, unsigned char)` at `0x92178` reads exactly `POSITIONINFO + 0x4e` (`0x9217a`). Its Thumb `TBH` dispatch table starts at `0x9218e`, indexed by unsigned `speed - 5`. The following selected entries and string references were decoded independently from the ELF bytes:

| Stored byte | Dispatch target | Normal audio path | Unit-setting = 1 audio path |
| --- | --- | --- | --- |
| 32 | `0x92396` | `32km.wav` (`0x923bc`) | `20ml.wav` (`0x924ec`) |
| 48 | `0x923e6` | `48km.wav` (`0x9240a`) | `30ml.wav` (`0x924e0`) |
| 64 | `0x92428` | `64km.wav` (`0x9244c`) | `40ml.wav` (`0x92510`) |
| 97 | `0x92352` | `97km.wav` (`0x92378`) | `60ml.wav` (`0x92504`) |
| 113 | `0x9230e` | `113km.wav` (`0x92334`) | `70ml.wav` (`0x924d4`) |
| 50 | `0x923da` | `50km.wav` (`0x923e0`) | same branch |
| 140 | `0x922c6` | `140km.wav` (`0x922de`) | same branch |

All audio paths are under `/customer/audio/`. The unit branch tests byte `+0x103` of the settings structure; for example, `0x92324–0x9232a` selects the miles file for stored 113 when that setting equals 1. Thus **the byte is consumed as a km/h speed limit in this firmware**, including rounded conversions for some imperial limits. This is stronger than an inference from values such as 32 or 48. It does not mean every possible byte has a spoken file, nor that the raw byte itself switches units with user settings.

The GPS consumer corroborates the unit convention. `appGpsCurrSpeedGet(int)` at `0x8cb40` reads the GPS speed double at `+24`; its nonzero unit argument divides by **1.609** at `0x8cb70–0x8cb78` (binary64 literal at `0x8cb80`). `EDOGCtrl_IsOverSpeedLimit_Customer` (`0x8f038`) compares the GPS double to `POSITIONINFO + 0x4e` plus a threshold (`0x8f06e–0x8f084`), without converting the raw limit. This code uses an approximate 1.609 factor, not the exact international-mile ratio.

### Zero is unavailable numerical limit, not a demonstrated posted 0 km/h

The spoken-speed dispatch accepts only 5–140 before looking up its table; zero takes the out-of-range branch at `0x92186` to `0x9229e`. That path emits **`unknown speed limit = %d`** (format at `0x149c7c`) for selected language cases or returns via the equivalent unknown-speed path at `0x924ba`; it does not select a `0km.wav` announcement. The bundled unusual value 139 likewise reaches the unknown-speed target through the dispatch table.

Separately, `pSpeedCamAlertStart` reads `POSITIONINFO + 0x4e` at `0x92b0a` and, when zero, exits the repeated overspeed-warning branch at `0x92b10` before `GetSpeedThreshold_KM` and `EDOGCtrl_IsOverSpeedLimit_Customer` are called. Zero does **not** universally disable all camera alerts: type/generic warning paths still exist; another branch at `0x92bc2–0x92bcc` selects a generic manual-camera voice when a relevant zero limit is encountered.

A defensible presentation is “speed limit unavailable” for zero in this tested format. The trace does not establish why the upstream provider omitted the limit, the posted road limit, or that all device screens render the same placeholder. A red-light classification and a missing numerical limit are separate facts.

## Raw type 3 / 5: explicit consumer labels, not bit guesses

Values 1, 3 and 5 pass unchanged through `Autodoria_Change_POItype`, whose decimal conversion applies only above 63. `VideoFunc_SpeedLimitedSound_Additional_OTHERS` (`0x91efc`) obtains the selected UI type from `EDOGCtrl_uiPOITypeGet` (`0x8f0a4`). Its branch table is a **byte TBB table at `0x91f2a`**, indexed by `type - 3`. Treating the table bytes as offsets rather than instructions gives:

| Raw type | Table behavior | Direct label evidence |
| --- | --- | --- |
| 3 | table byte `0x44` → `0x91fb2` | Log says `RED LIGHT` (format `0x149714`, referenced `0x91fbe`); appropriate customer branches select `/customer/audio/SC_Redlight.wav` (`0x91fec`), otherwise generic camera voice (`0x920f4`). |
| 5 | table byte `0x64` → `0x91ff2` | Selects `/customer/audio/SC_Mobile.wav` (`0x91ff8`). |
| 1 | below the table's 3–19 range → default `0x91fa6` | Selects `/customer/audio/Speedcam_voice.wav` (`0x91fac`). This is generic camera voice, **not sufficient proof of a fixed-camera label**. |

For this firmware the direct evidence supports **raw 3 as the red-light announcement category** and **raw 5 as the mobile announcement category**. It does not justify describing bits 1, 2 and 4 individually as these meanings: these small values are compared/dispatched as whole numbers. Raw 3 includes both low bits numerically; that alone does not make it “fixed plus red light.” The earlier CANARD correlations are consistent with the red-light category, but were not used to invent these labels.

The integer raw 964/9128 conversion and internal `0x1000`/`0x2000` Autodoria categories remain as documented previously. Their full endpoint state-machine roles are separate from these small-enum audio categories.

## Header extension: deeper alias work, conservative guard retained

The earlier description of an “allocation” was imprecise. Following the complete initialization sequence at `EDOGCtrl_Initial` (`0x8e8e0`) shows a **static BSS scratch area**, not a malloc call:

| Object | Resolved address | Initialization |
| --- | --- | --- |
| Scratch base / initial global header storage | `0x25c830` | PC-relative literal at `0x8ea1c`, added at `0x8e932`; first 20 bytes cleared. |
| Aligned scratch pointer | `0x25cc30` | `(base + 0x403) & ~3`, `0x8e93a–0x8e93e`; stored in pointer global `0x215a44`. |
| First node header scratch | `0x25d030` | aligned scratch + `0x400`, stored in `0x215a48`. |
| Second node header scratch | `0x25d430` | aligned scratch + `0x800`, stored in `0x215a4c`. |
| 16-byte header extension | `0x25d830` | aligned scratch + `0xc00`, stored in `0x215a50` at `0x8e97c`. |
| Manual-camera scratch | `0x25dc30` | aligned scratch + `0x1000`, stored in `0x215a54`. |

The extended audit enumerated direct PC-relative load/add references to the base, each concrete scratch address and all five pointer globals across the entire executable. It found 47 references to `0x215a44`, 1 to `0x215a48`, 4 to `0x215a4c`, **4 to `0x215a50`**, 15 to `0x215a54`, and one direct base reference in initialization. The four extension-pointer references remain initialization, the 16-byte read, and the two version accesses. Initialization also accesses the extension through the first-node scratch pointer plus `0x800` at `0x8e9a4–0x8e9b0`, clearing it before use; this is a concrete alias absent from the earlier direct-global scan.

A second scan searched `movw`/`movt` pairs for these exact absolute addresses (up to 20 instructions apart), finding no matches. A raw aligned/unaligned 32-bit-address search found no absolute words for `0x25c830`, `0x25d830` or `0x215a50`. No retained dynamic BSS symbol spans the base, extension or extension-pointer address, so no exported aggregate alias was identified. These observations substantially narrow the remaining question; they do not turn pattern-based searches into complete machine-code def-use analysis. Computed offsets, copied aliases, mixed-mode call paths and unrecognized address construction remain possible.

The actual structural read path still obtains regional offsets from the region table, seeks explicitly, checks empty node counts and reads explicit cell offsets. Nothing traced uses the extension version word as the first populated region's address, or derives cell layout from that word. Nevertheless **no guard removal is included**: the request explicitly requires independent review before bypassing it, and this bounded work does not prove every alias/caller. The known reason to retain it is the incomplete consumer audit, not the disproved offset-20-pointer hypothesis.

## What this enables and what remains

These findings support reviewed, firmware-scoped km/h interpretation of nonzero byte 16, unavailable-limit treatment of zero, and descriptive raw-type 3/5 categories. They do not authorize changing raw type bits, rewriting unresolved references, claiming raw 1 means fixed, or removing the first-populated-region guard automatically. The research itself made no product changes. A separately reviewed read-only decoder in `src/bin-metadata.js` now uses the finite contract below; it does not add semantic editing.

Remaining programmatic work is specific: follow copied/computed aliases from the static scratch and node-header pointers, prove all extension consumers across mixed ARM/Thumb code, trace the update/checksum callers, and trace the internal Autodoria category state machine. Physical device acceptance and the screen/voice behavior under the user's exact settings still require controlled testing.

## Finite contract for a conservative read-only decoder

The whole 136-entry speed dispatch table was decoded, not only the examples above. It contains 113 entries pointing to the common unknown-speed target `0x9229e`. The remaining 23 entries are:

| Byte | Target | Evidence |
| ---: | --- | --- |
| 5 | `0x92498` | Prints a `speed limit = 5` diagnostic only; **no corresponding audio selection was established**. Exclude from the conservative display whitelist below. |
| 10 | `0x92482` | Recognized special customer branch, selecting `10km.wav` through `0x92516–0x92530`; other customers return without speech. |
| 15 | `0x924ae` | `15km.wav` |
| 20 | `0x9246a` | `20km.wav` |
| 25 | `0x92476` | `25km.wav` |
| 30 | `0x923c2` | `30km.wav` |
| 32 | `0x92396` | `32km.wav` / `20ml.wav` |
| 35 | `0x9238a` | `35km.wav` |
| 40 | `0x92410` | `40km.wav` |
| 48 | `0x923e6` | `48km.wav` / `30ml.wav` |
| 50 | `0x923da` | `50km.wav` |
| 60 | `0x923ce` | `60km.wav` |
| 64 | `0x92428` | `64km.wav` / `40ml.wav` |
| 70 | `0x9241c` | `70km.wav` |
| 80 | `0x92452` | `80km.wav` / `50ml.wav` |
| 90 | `0x9237e` | `90km.wav` |
| 97 | `0x92352` | `97km.wav` / `60ml.wav` |
| 100 | `0x92346` | `100km.wav` |
| 110 | `0x9233a` | `110km.wav` |
| 113 | `0x9230e` | `113km.wav` / `70ml.wav` |
| 120 | `0x92302` | `120km.wav` |
| 130 | `0x922e4` | `130km.wav` |
| 140 | `0x922c6` | `140km.wav` |

A deliberately conservative display contract can therefore classify **only** `{10,15,20,25,30,32,35,40,48,50,60,64,70,80,90,97,100,110,113,120,130,140}` as recognized km/h values. Zero is **Not specified**. All other bytes—including **5, 139 and 255**—remain visible as raw, unclassified values with a format-research caveat. Five is excluded conservatively despite its special diagnostic branch; the decoder can expand later with independently reviewed evidence. An unclassified display value is not a malformed record and must not be silently rewritten or prevent lossless reconstruction.

Applying this exact finite whitelist to the available private files gives:

| Private file | Recognized km/h | Not specified (0) | Unclassified |
| --- | ---: | ---: | ---: |
| Official `202609010125`, 53,338 records | 49,977 | 3,361 | 0 |
| Firmware `202509020125`, 51,790 records | 48,721 | 3,067 | **2, both raw 139** |

A separate type contract can describe exact raw values **1: Speed camera (generic)**, **3: Red-light announcement category**, **5: Mobile announcement category**, **964 / 9128: two distinct linked-section endpoint categories**. Endpoint labels must not claim start/end roles; they derive from the distinct converted Autodoria flags, pairing evidence and coordinate-reference consumer. Other raw codes remain unclassified. These are whole raw values; do not implement this mapping by testing raw bit masks.

For independent implementation review, the meaningful decoder checks are: enumerate all 256 speed bytes against the explicit whitelist; assert zero is not a posted 0 km/h; assert 5/139/255 remain raw; distinguish all five observed types and unknown whole type values; apply the real-file counts above; and confirm decoded presentation does not alter project save/reopen or binary round-trip bytes. There is no need to make device speech availability a promise: even recognized values have language/customer-specific speech behavior.
