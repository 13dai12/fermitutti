// Ora dell'ultimo controllo ogni 30 minuti senza ripubblicare: la funzione di Cloudflare e la regola del browser.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, statoLeggero } from '../functions/api/stato.js';
import { controlloRecente } from '../src/js/stato.mjs';

const fetchVero = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchVero; });

const STATO = {
  ultima_verifica_riuscita: '2026-11-12T08:07:40.123Z',
  ultimo_tentativo: '2026-11-12T08:07:40.123Z',
  ultima_modifica_dati: '2026-11-11T17:04:21.450Z',
  ultima_pubblicazione: '2026-11-12T03:57:09.388Z',
  fonte_guasta_dal: null,
  ultimo_errore: { quando: '2026-11-11T20:57:31.195Z', messaggio: 'fonte non raggiungibile' },
  avvisi: ['qualcosa'],
};

test('statoLeggero tiene solo tre date valide', () => {
  assert.deepEqual(statoLeggero(JSON.stringify(STATO)), {
    ultima_verifica_riuscita: '2026-11-12T08:07:40.123Z',
    ultima_modifica_dati: '2026-11-11T17:04:21.450Z',
    fonte_guasta_dal: null,
  });
  // Date non valide o con altro testo diventano null; senza l'ora del controllo non si restituisce niente.
  assert.equal(statoLeggero(JSON.stringify({ ...STATO, ultima_modifica_dati: '<b>x</b>' })).ultima_modifica_dati, null);
  assert.equal(statoLeggero(JSON.stringify({ ...STATO, fonte_guasta_dal: '2026-13-45T99:00:00Z' })).fonte_guasta_dal, null);
  assert.equal(statoLeggero(JSON.stringify({ ...STATO, ultima_verifica_riuscita: '2026-11-12T08:07:40Z<script>' })), null);
  for (const cattivo of ['', 'null', '[]', '"testo"', '{', 'x'.repeat(20000), JSON.stringify({ ...STATO, ultima_verifica_riuscita: 12 })]) {
    assert.equal(statoLeggero(cattivo), null, cattivo.slice(0, 20));
  }
});

test('la funzione risponde con le sole date, le intestazioni di sicurezza e una cache breve', async () => {
  let chiesto;
  globalThis.fetch = async (url, opzioni) => { chiesto = { url, opzioni }; return new Response(JSON.stringify(STATO), { status: 200 }); };
  const r = await onRequestGet();
  assert.equal(r.status, 200);
  assert.match(chiesto.url, /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/refs\/tags\/stato\/stato\.json$/);
  assert.equal(chiesto.opzioni.redirect, 'manual');
  assert.deepEqual(Object.keys(await r.json()).sort(), ['fonte_guasta_dal', 'ultima_modifica_dati', 'ultima_verifica_riuscita']);
  assert.equal(r.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(r.headers.get('Cache-Control'), 'public, max-age=60');
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(r.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.match(r.headers.get('Strict-Transport-Security'), /max-age=/);
});

test('se GitHub non risponde o manda altro, la funzione risponde 503 senza cache', async () => {
  const casi = [
    async () => { throw new Error('rete'); },
    async () => new Response('non trovato', { status: 404 }),
    async () => new Response(null, { status: 302, headers: { Location: 'https://altrove.example/' } }),
    async () => new Response('<html>', { status: 200 }),
    async () => new Response(JSON.stringify(STATO), { status: 200, headers: { 'Content-Length': '999999' } }),
  ];
  for (const caso of casi) {
    globalThis.fetch = caso;
    const r = await onRequestGet();
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await r.json(), {});
  }
});

test('il browser mostra l\'ora nuova solo se il controllo ha trovato gli stessi dati pubblicati', () => {
  const pubblicato = { ultima_verifica_riuscita: '2026-11-12T03:57:09.388Z', ultima_modifica_dati: '2026-11-11T17:04:21.450Z', fonte_guasta_dal: null };
  const vivo = statoLeggero(JSON.stringify(STATO));
  assert.equal(controlloRecente(vivo, pubblicato), '2026-11-12T08:07:40.123Z');
  // Dati cambiati ma il sito non è ancora ripubblicato: resta l'ora della pagina.
  assert.equal(controlloRecente({ ...vivo, ultima_modifica_dati: '2026-11-12T08:07:40.123Z' }, pubblicato), null);
  // Fonte guasta, da una parte o dall'altra.
  assert.equal(controlloRecente({ ...vivo, fonte_guasta_dal: '2026-11-12T08:07:40.123Z' }, pubblicato), null);
  assert.equal(controlloRecente(vivo, { ...pubblicato, fonte_guasta_dal: '2026-11-12T03:00:00.000Z' }), null);
  // Più vecchio o uguale a quello già scritto nella pagina.
  assert.equal(controlloRecente({ ...vivo, ultima_verifica_riuscita: '2026-11-12T03:57:09.388Z' }, pubblicato), null);
  assert.equal(controlloRecente({ ...vivo, ultima_verifica_riuscita: '2026-11-12T01:00:00.000Z' }, pubblicato), null);
  // Risposte vuote o strane.
  for (const v of [null, {}, { ultima_verifica_riuscita: 'ieri' }]) assert.equal(controlloRecente(v, pubblicato), null);
  assert.equal(controlloRecente(vivo, null), null);
});
