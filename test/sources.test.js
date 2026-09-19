import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_DATABASE_URL, fetchOfficialDatabase } from '../src/sources.js';
import { makeFixture } from './helpers/fixture.js';

test('official loader fetches the supplied URL and validates the binary', async () => {
  const { bytes } = makeFixture([{}]); let request;
  const result = await fetchOfficialDatabase({ fetchImpl: async (url, options) => {
    request = { url, options }; return new Response(bytes);
  } });
  assert.equal(request.url, 'https://dl-mio.akamaized.net/dvr/MiVue8xx/Speedcam_Data_FEU.bin');
  assert.equal(request.options.credentials, 'omit'); assert.equal(request.options.mode, 'cors');
  assert.equal(result.database.records.length, 1); assert.deepEqual(result.bytes, bytes);
  assert.equal(result.source.url, OFFICIAL_DATABASE_URL);
});
test('official loader reports HTTP failure and rejects a non-database response', async () => {
  await assert.rejects(fetchOfficialDatabase({ fetchImpl: async () => new Response('no', { status: 503 }) }), /503/);
  await assert.rejects(fetchOfficialDatabase({ fetchImpl: async () => new Response('<html>error</html>') }));
});
test('official loader forwards cancellation and never replaces source bytes with a fallback', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchOfficialDatabase({ signal: controller.signal, fetchImpl: async (_, options) => {
    options.signal.throwIfAborted(); return new Response(makeFixture().bytes);
  } }), e => e.name === 'AbortError');
});
