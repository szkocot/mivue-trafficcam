# Binary follow-up — 2026-10-31

Read-only firmware and database inspection; no firmware code was executed. Proprietary downloads and extracted database bytes stayed outside public assets and version control. These are observations of two files, not an official format specification or evidence of device acceptance.

## Verified structural extension

The [user-provided firmware](firmware-research.md) was downloaded again: 81,530,904 bytes, SHA-256 `cb2fec10430fad91407a2cd30485ab3169663642f1e25c0b8c9890503b0f4ee6`. Scanning UBIFS data nodes for inode 536 recovered 366 consecutive blocks. Every selected node's CRC (`CRC32(bytes[8:]) XOR 0xffffffff`) and decompressed output length were verified. LZO1X decompression used the installed `liblzo2`; uncompressed blocks were copied. Duplicate blocks were required to agree. The concatenation is 1,497,714 bytes, with SHA-256 `8f6930c3bbf7be5c9d51e8fadad93e300b6eea8b6b9f1c9dff4d046accaa13ca` and MD5 `9de8a23b26437fc09491bdf14999e983`, matching the previously researched manifest identity.

The existing 28-byte record and 3×3 region layout also applies to the 22×22 cell grid. All 51,790 records belong to their fractional spatial cells when each global axis has 66 divisions. There are 3,388 cells across seven populated regions, 987 populated cells, and no coordinate diagnostics. Supporting this exact variant required replacing fixed 400-cell tables with the header's verified square dimension in parsing, reconstruction, grouping, offsets, and generated bounds. Spatial indexing uses 60 divisions for 20×20 and 66 for 22×22. Other dimensions and nonsquare grids remain rejected.

Both raw-node reconstruction and a no-op project build reproduce the real extracted file byte for byte. Synthetic tests cover 22×22 reconstruction, later-region coordinates, cross-cell linked-record relocation, and unsupported dimensions. The optional private regression can be run with `MIVUE_FIRMWARE_DATABASE=/path/to/extracted/Speedcam_Data_FEU.bin node --test test/grid-variant.test.js`; it pins the identity and counts above. The public fixture contains only synthetic bytes.

The repeat-cycle regression also passes both private files through parsed JSON export/reload and reconstruction, then project creation, two successive project saves/reopens, and binary build; it repeats that whole process after reparsing the output. Every cycle retains exact bytes, SHA-256, records and diagnostics: official 20×20 is 1,532,826 bytes (`69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`); firmware 22×22 is 1,497,714 bytes (hash above). Synthetic cases for both grids cover every value 0–255 in bytes 16–19, all observed raw types plus unknown values, opaque links, signed coordinates, signed zero, infinities and a noncanonical NaN payload. These checks establish lossless supported-file re-export; GeoJSON is a spatial export and is not a binary reconstruction format.

## Header follow-up

Both files have identical geographic bounds, 3×3 regions, opaque bytes `04 20 20 20`, an empty region at 72 and the first populated region at 82. The firmware database stores **72** at header offset 20; the September official database stores **82**. Thus this field cannot consistently mean the first populated region's address. The bounded executable trace below identifies a direct display-version consumer for this field. It does not establish every possible consumer or rule out unrelated layout dependencies. The encoder's conservative first-populated-region guard remains in place; the word is preserved verbatim.

## Quantitative record comparison

| Observation | Bundled 202509020125 | Official 202609010125 |
| --- | ---: | ---: |
| Records | 51,790 | 53,338 |
| Raw type 1 / 3 / 5 | 36,590 / 5,951 / 243 | 36,443 / 6,081 / 38 |
| Raw type 964 / 9128 | 4,503 / 4,503 | 5,388 / 5,388 |
| Valid 964 → 9128 absolute-offset links | 4,494 | 5,375 |
| Missing target / unexpected target type | 9 / 0 | 11 / 2 |
| Distinct valid targets | 4,494 | 5,375 |
| Linked pairs with equal byte 16 | 4,494 | 5,375 |
| Linked pairs with equal byte 17 | 345 | 470 |
| Byte 17 range | 0–179 | 0–179 |
| Byte 18 / byte 19 | all 0 / all 1 | all 0 / all 1 |

Every 964 record has a nonzero last word; every other record has zero. Every valid target is used once in each inspected file. This supports one-to-one endpoint pairing for the valid subset, but does not prove official OPP roles or identify raw flag bits. The type values are preserved without invented bit assignments.

Byte 16 includes decimal values 32, 48, 64, 97 and 113 in both files, compatible with rounded mph-to-km/h conversions. All valid pairs share this byte, strengthening the speed-limit hypothesis. The zero value and firmware values 139 (two records) remain unexplained; no new semantic speed controls follow from this evidence.

For each valid link, an initial great-circle bearing was computed from its source to target. Circular error against twice byte 17 has a median of **9.75° / 10.24°** (bundled / official); treating the byte as degrees gives **90.28° / 91.14°**. Errors are at most 45° for **4,206 of 4,494 / 5,024 of 5,375** links under the two-degree hypothesis, versus **1,143 / 1,358** under the one-degree hypothesis. This is strong empirical support for two-degree heading units. It does not establish device direction matching, zero semantics, direction-disable flags, or exact endpoint roles; curved roads and anomalous links prevent treating a source-to-target bearing as ground truth. No semantic direction editor was added.

Valid-link straight-line distances have median **1.325 / 1.277 km**, interquartile range **0.595–3.254 / 0.562–3.188 km**, and maximum **131.462 / 131.628 km**. These long tails caution against automatically choosing geographically nearest endpoint partners.

Exact latitudeRaw/longitudeRaw/type tuples match only three uniquely keyed records across these annual versions; all three retain bytes 16–19. Most coordinates changed numerically, so offset comparison or exact-coordinate joining cannot establish cross-version record identity.

## Candidate-link anomalies: no safe automatic repair

For each anomaly, the nearest *byte-address* record with raw type 9128 was located. Its signed offset difference from the stored target is:

- Bundled file: `+116, -378, -206, -122, +10, -5938, -5742, -5826, +152`.
- Official file (source-offset order): `+144, +508, -42, -94, -66, +94, +6758, +6954, +272, +350, -120, +2318, -308`.

The differences vary in magnitude and sign; they do not support a single constant correction to the pointer interpretation. Nearest address is only a diagnostic, not proof of a counterpart. Several anomalous source coordinates recur near the same Netherlands locations in both versions, but their exact coordinates and offsets differ. No unique arithmetic correction or defensible semantic mapping was found. Existing unresolved references survive no-op builds, and address-space changes remain blocked until explicit supported resolution. No anomaly bytes were silently repaired.

## Bounded executable trace

The reader **is available** in the firmware root filesystem, not only as UI symbols in `libzkgui.so`. Gzip decompression of the documented rootfs segment followed by read-only `newc` CPIO traversal recovered `/bootconfig/bin/cardv`: 1,408,300 bytes, SHA-256 `150fbe9ed0496d663f69fcbc10339d77f078ad8f4fbddeb44a2dff7839af9bb1`, ELF32 little-endian ARM EABI5, BuildID `13855e7208a8943144127332cb6f520f41dcf887`. It is stripped, but its dynamic table retains the reader function names. It contains both `Speedcam_Data_FEU.bin` and `/customer/Speedcam_Data_FEU.bin`; the selected database path buffer is at virtual address `0x25bf60`. The extracted binary remained private and was never run.

Available tools: `/usr/bin/objdump` is LLVM's object dumper and supports ARM/Thumb; separate `llvm-objdump`, radare2 and an ARM GNU objdump were not found on PATH. Default ARM disassembly misinterprets these functions: selecting `--triple=thumbv7-linux-gnueabihf` yields coherent Thumb instructions and symbolized calls. Reproduce a function inspection with `objdump -d --triple=thumbv7-linux-gnueabihf --start-address=0x8dc6c --stop-address=0x8dd10 /path/to/cardv`. Addresses below are ELF virtual addresses, not firmware or database offsets; literal pools are data even when a disassembler renders them as instructions.

| Function | Address / size | Direct observation |
| --- | --- | --- |
| `EDOGCtrl_ReadGlobalHeader` | `0x8dc6c` / `0xa4` | Reads 20 bytes, conditionally reads another 16, then region-offset words. |
| `EDOGCtrl_ParseHeader` | `0x8dd1c` / `0x6c` | Opens selected database, calls global-header reader, closes. |
| `EDOGCtrl_UpdateSpeedCameraArray_BLOCK` | `0x8d114` / `0x1e8` | Absolute seeks, 10-byte node headers and 28-byte record reads. |
| `EDOGCtrl_GetDBVersion` | `0x8f508` / `0xbc` | Formats file offset 20 as the displayed version prefix. |
| `EDOGCtrl_CheckIsHeaderValid` | `0x8f5c4` / `0x9c` | Checks bounds, nonzero dimensions and header byte 16 in 1–4; not a complete integrity specification. |
| `EDOGCtrl_SpeedCamCheckSum` | `0x8f66c` / `0x16c` | Computes a whole-file additive byte sum and returns it through an output pointer. |
| `EDOGCtrl_Autodoria_Change_POItype` | `0x8f914` / `0x64` | Converts large decimal-coded types into internal flags. |
| `EDOGCtrl_Autodoria_POItype` | `0x8f978` / `0x12` | Classifies internal `0x1000` / `0x2000` bits as 1 / 2. |
| `EDOGCtrl_Autodoria_NtoA` | `0x8fa78` / `0xf4` | Reads coordinates by an unadjusted absolute file offset. |
| `EDOGCtrl_CheckSpeedCamera` (mangled C++ export) | `0x90668` / `0x1218` | Consumes raw record fields and runs direction/Autodoria checks. |

### Header word 20: display version, not the proposed pointer

At `0x8dc88` the reader requests 20 bytes. Header byte 16 is checked at `0x8dc9c`; values above 1 take the additional 16-byte read at `0x8dce6–0x8dcec`. Both researched files have byte 16 equal to 4. The extension pointer is stored at `0x215a50`. `EDOGCtrl_GetDBVersion` dereferences that pointer, loads its first word (file offset 20) at `0x8f510`, and formats it with **`V%d.`** at `0x8f520`; the format string is at `0x149104`. It then copies extension bytes 8–15 (file offsets 28–35) into four digits, a dot, four digits. Thus these files provide display versions **`V72.0902.0125`** and **`V82.0901.0125`**. The 12 ASCII bytes beginning at file 24 additionally include a year; the display routine uses their final eight digits.

A bounded whole-binary scan resolved PC-relative literal loads followed by `add register, pc` to the extension-pointer address. Matches were its initialization (`0x8e964–0x8e97c`), the header read (`0x8dce0–0x8dcec`), and the two version-format accesses (`0x8f50a–0x8f510`, `0x8f546–0x8f554`). This is useful evidence against the first-populated-offset hypothesis. **It is not a complete alias analysis**: initialization points the extension into a shared allocation at allocation-base + `0xc00`; access via the allocation base, copied pointers, indirect code or unrecognized instruction sequences could escape this pattern scan. No claim that every consumer is known follows from these xrefs. The conservative layout guard is retained pending a fuller consumer audit or controlled device evidence.

The checksum routine seeks to zero (`0x8f6d2–0x8f6dc`), reads 512-byte blocks, sums each byte (`0x8f70c–0x8f712`), includes the tail (`0x8f768–0x8f76e`) and writes the sum to its caller's output pointer (`0x8f734`). This establishes one checksum calculation, **not** an embedded checksum field or the acceptance/update caller's policy; it does not justify rewriting header 20 or adding a checksum trailer.

### Raw record fields: instruction-level support

The camera-check loop sets `r5` to record base + 16 (`0x907a2`) and advances it by 28 (`0x90810`). This distinguishes its raw-record accesses from later 30-byte internal candidate structures.

- **Byte 16:** read from `[r5]` at `0x9095a` / `0x914a8`, used in Autodoria state handling and copied to the alert's speed output. Together with equal values across every valid pair, this strengthens the speed-field interpretation. The bounded trace did not establish every unit-conversion path or zero behavior.
- **Byte 17:** read from `[r5,#1]` at `0x908ec`. With the observed byte 19 value 1, `0x913e2` computes `2 × byte17 − current heading`, followed by absolute-value handling. The gate at `0x91034–0x91038` excludes differences 61–299, admitting a ±60° circular window. This directly confirms two-degree units for this branch in this firmware, beyond the statistical comparison above. Exact output rounding and behavior for values outside the observed 0–179 remain unverified.
- **Byte 19:** read from `[r5,#3]` at `0x908d2`; 2 selects an alternate opposite-direction path at `0x90ffc`, 0 bypasses this heading gate, and the observed 1 selects the single-heading branch. This identifies branch behavior, not an official enum contract across devices. Byte 18's full role was not traced.
- **Raw word 20:** passed from `[r5,#4]` at `0x90972–0x90976` to `Autodoria_Change_POItype`. For values above 63 this routine formats decimal (`%d`, string at `0x13f174`), removes the **first decimal character** by shifting the remaining characters left (`0x8f946–0x8f958`), parses the suffix in base 10 and shifts it left six (`0x8f968–0x8f96c`). Observed raw **964 → 64 << 6 = `0x1000`**, **9128 → 128 << 6 = `0x2000`**. Values 1, 3 and 5 pass through unchanged. `Autodoria_POItype` tests these internal bits at `0x8f978–0x8f988` and returns 1 / 2. Consequently the decimal raw values must not be treated as a direct binary flag mask. Official endpoint labels and all other type encodings still need fuller state-machine tracing.
- **Raw word 24:** the candidate loop loads the stored last word at `0x912e2` and calls `Autodoria_NtoA`. That function passes the unmodified value into absolute `AHC_FS_FileSeek` at `0x8fab2–0x8faba`, reads 28 bytes at `0x8fac6–0x8fac8`, and converts the first two doubles with `GpsDmmToDegree` at `0x8fad4` / `0x8fae8`. No per-pointer arithmetic correction or target-type/bounds check appears in this function. This substantiates the absolute-coordinate-record reference interpretation for the traced consumer. The shipped anomalous values are not explained by a hidden correction here; their intended counterpart records remain unknown and must not be guessed.

These observations are specific to the supplied firmware. No product semantic editor or automatic link repair was introduced from this bounded trace.

## Remaining blockers

The executable trace confirms structural reads, a displayed version consumer, two-degree heading consumption, decimal type conversion and direct absolute-coordinate reads. It does not complete all aliases or the entire warning/Autodoria state machine. Exact device-facing endpoint labels, all flag/type encodings, speed units and zero behavior, checksum caller policy, complete header-layout independence, and acceptance of edited binaries remain unverified. A fuller static def-use/caller audit can make further programmatic progress; controlled device testing is still needed for acceptance. The user will perform device acceptance testing.

## Concrete next audit and device cases

Continue the static audit at `EDOGCtrl_Initial` (`0x8e8e0`, especially allocation/pointer setup `0x8e92e–0x8e99c`): follow aliases of allocation-base + `0xc00` and the extension pointer at `0x215a50`, rather than relying only on direct xrefs. Trace all callers of `EDOGCtrl_GetDBVersion` (`0x8f508`) and `EDOGCtrl_SpeedCamCheckSum` (`0x8f66c`) to distinguish display/update policy from structural dependence. Continue `EDOGCtrl_CheckSpeedCamera` (`0x90668`), `Autodoria_State` (`0x904bc`), `Autodoria` (`0x8fef8`) and the internal-type consumers to establish endpoint state transitions and byte 18 / all byte 19 modes. GPS-to-warning speed conversion and zero handling require their own caller/data-flow audit. None of this requires executing firmware.

Useful controlled device cases, with the original database backed up and the original file available for restoration:

1. Import and re-export the unchanged official file; confirm the unchanged bytes are accepted and the displayed database version remains `V82.0901.0125`. This validates the installation procedure before interpreting edited-file outcomes.
2. Use one documented ordinary-camera record for a same-cell coordinate-only edit, then restore the original; record whether the device accepts it and whether the expected position changes. Keep its raw type, speed and direction bytes unchanged.
3. Independently test a small known speed-byte change on that record, preserving every other raw field; observe display/alert units and restore. A successful parse/build alone does not prove an on-device speed interpretation.
4. Compare a selected recorded approach with heading byte unchanged and then adjusted by `(old + 90) % 180` (180°), keeping byte 19 equal to 1. Use a lawful controlled location or simulator; record the direction and whether alerts differ. This tests the confirmed arithmetic against physical warning behavior without introducing unobserved enum values.
5. After the remaining header alias audit, evaluate a file that changes the first populated region while retaining version bytes; the current production guard deliberately blocks constructing this case. Do not bypass the guard or auto-repair unresolved section references merely to obtain a device test file.

These are separate experiments, not prerequisites claimed to have been performed.
