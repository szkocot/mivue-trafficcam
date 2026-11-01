# Checksum consumer follow-up — 2026-11-01

Read-only static inspection of the same private `cardv` ELF identified `EDOGCtrl_SpeedCamCheckSum` at `0x8f66c` (size `0x16c`). Firmware/ELF identities and extraction checks are recorded in [the reader research](binary-reader-followup-2026-11-01.md). The executable was not run.

The routine seeks to file offset zero (`0x8f6d2–0x8f6dc`), obtains the file size, then reads 512-byte chunks. Its inner loop adds each unsigned byte to a 32-bit accumulator (`0x8f70c–0x8f714`). The remainder path adds the final bytes (`0x8f752–0x8f770`). There is no excluded checksum field or trailer in this routine. It prints the sum and writes it through the caller's output pointer (`0x8f728–0x8f734`), then closes the file. Short-read/error handling must not be inferred to be stronger than the traced code.

A standalone Python sum over the complete available private files produces:

| Input SHA-256 | Bytes | Unsigned additive sum modulo 2³² |
| --- | ---: | --- |
| `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1` | 1,532,826 | `0x071fe0e6` |
| `8f6930c3bbf7be5c9d51e8fadad93e300b6eea8b6b9f1c9dff4d046accaa13ca` | 1,497,714 | `0x06e5aa10` |

These values reproduce the traced arithmetic; they are not device-observed acceptance values. The routine is not evidence of an embedded database checksum, signature, updater acceptance rule or permission to repair malformed links. No direct call to it was identified in the existing Thumb disassembly; indirect/shared-library/update-command callers remain unresolved. `EDOGCtrl_NeedtoUpdate` at `0x8efd4` compares four signed 16-bit state fields and is not demonstrated to compare this sum.

Additional private inspection reconstructed an analysis image of `libzkgui.so` from UBIFS inode 621. All present data-node CRCs and decompressed lengths were checked. Two absent blocks (226/227) were zero-filled only for static analysis; this is not claimed as a verified full extraction. The inode's candidate size `0xe9918` agrees with the final data block extent. The observed GUI `appSpeedCamUpdateFileDetect` at `0x920bc` checks file existence with `access`; that function alone contains no demonstrated checksum acceptance test. Its inspected code lies outside the absent blocks. No product behavior depends on this incomplete analysis image, which remains private.

The next useful proof is the caller/update-command chain: establish how the sum is consumed and whether any independent validation precedes file replacement. Existing encoder/header/link blockers remain unchanged. No firmware installation, firmware execution, device acceptance or semantic editor change was performed.
