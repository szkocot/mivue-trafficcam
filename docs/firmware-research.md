# MiVue 955W firmware observations

Read-only inspection on 2026-09-20. No firmware code was executed, installed, or modified. Firmware and extracted proprietary bytes are not distributed in this repository.

## User-provided sources

- [955W EU firmware VF538.10.20.BE1AD.18](https://dl-mio.akamaized.net/Support/Downloads/Firmware/MiVue955W/EU/5651N7040009/VF538.10.20.BE1AD.18/SD_CarDV.bin)
- [Mio guide](https://service.mio.com/M0100/FileReader_119674_Rest%20of%20Europe_English.html): returned HTTP 403 during this inspection, so its contents were not verified.
- [Current official European speed-camera database](https://dl-mio.akamaized.net/dvr/MiVue8xx/Speedcam_Data_FEU.bin)

The firmware download is 81,530,904 bytes, SHA-256 `cb2fec10430fad91407a2cd30485ab3169663642f1e25c0b8c9890503b0f4ee6`.

## Findings

The update begins with a readable U-Boot command script describing its partitions. Its root filesystem segment at offset `0x29e000` has length `0x6d2f12`; gzip decompression yields a 15,954,432-byte `newc` CPIO archive. The customer image contains UBIFS nodes with uncompressed and LZO-compressed data, including European and other regional camera databases and speed-camera UI symbols.

The bundled `Speedcam_Data_FEU.bin` was reconstructed in memory from data nodes for inode 536, checking node CRCs, LZO output lengths, block order and file size. Its MD5 matches the update's embedded manifest:

| Property | Bundled database |
| --- | --- |
| Bytes | 1,497,714 |
| SHA-256 | `8f6930c3bbf7be5c9d51e8fadad93e300b6eea8b6b9f1c9dff4d046accaa13ca` |
| MD5 | `9de8a23b26437fc09491bdf14999e983` |
| ASCII version candidate | `202509020125` |
| Regional grid | 3×3 |
| Cell grid | **22×22** |
| Records | 51,790 |
| Record bytes | 28 |
| Unknown uint32 at header offset 20 | 72 |

All regional sums and 484-cell tables were checked; every populated cell's byte span is `10 + count × 28`. The initial region at offset 72 is empty; the first populated region is at offset 82. Therefore header offset 20 is **not consistently the offset of the first populated region**: its value here is 72, whereas the current sample has 82 with the same first populated-region offset. Its actual meaning remains unknown.

This validates a second structural variant associated with the 955W firmware, but does not establish camera-type bits, direction units, OPP endpoint roles, checksum semantics, or whether modified files will be accepted. The production parser/encoder still explicitly supports only the tested 20×20 variant. Supporting 22×22 is a separately testable next format extension.

UBIFS structures were interpreted using the [Linux UBIFS on-flash definitions](https://raw.githubusercontent.com/torvalds/linux/master/fs/ubifs/ubifs-media.h). Static inspection found speed-camera activity symbols in `libzkgui.so`; the database-reading implementation has not yet been traced.

## Official database source for the website

The current download matches the original project sample exactly: 1,521,542 bytes and SHA-256 `2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0`. The response returned `Access-Control-Allow-Origin: *`, indicating that direct browser fetching is currently permitted. This is an observed service behavior, not a permanent guarantee.

`src/sources.js` records all three links and provides `fetchOfficialDatabase()` for a user-triggered download in the future GitHub Pages UI. It validates the downloaded bytes with the parser and reports failures; it does not silently fall back to an old sample or bundle Mio's database into the public site. Network/CORS errors should offer local file import in the UI. Format changes are reported as unsupported rather than treated as the known sample.
