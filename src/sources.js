import { parseDatabase } from './parser.js';

/** User-supplied official source; fetch directly, without bundling its data. */
export const OFFICIAL_DATABASE_URL = 'https://dl-mio.akamaized.net/dvr/MiVue8xx/Speedcam_Data_FEU.bin';
export const FIRMWARE_REFERENCE_URL = 'https://dl-mio.akamaized.net/Support/Downloads/Firmware/MiVue955W/EU/5651N7040009/VF538.10.20.BE1AD.18/SD_CarDV.bin';
export const FIRMWARE_GUIDE_URL = 'https://service.mio.com/M0100/FileReader_119674_Rest%20of%20Europe_English.html';

/** Browser/Node loader. User action supplies cancellation; every response is parsed. */
export async function fetchOfficialDatabase({ fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl(OFFICIAL_DATABASE_URL, { mode: 'cors', credentials: 'omit', signal });
  if (!response.ok) throw new Error(`Official database download failed: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const database = parseDatabase(bytes);
  return { bytes, database, source: { url: OFFICIAL_DATABASE_URL, retrievedAt: new Date().toISOString() } };
}
