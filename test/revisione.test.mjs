// Prove nate dalla revisione di sicurezza indipendente: dati che superano la validazione ma rompevano la build,
// crescita senza limiti, input lenti da analizzare, server locale, link nel browser, messaggi senza indirizzi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { aggiorna, senzaIndirizzi, MASSIMO_NUOVI } from '../scripts/aggiorna.mjs';
import { build } from '../scripts/build.mjs';
import { analizzaFeed, pulisciTesto } from '../scripts/lib/feed.mjs';
import { estraiNoteDaHtml } from '../scripts/lib/arricchisci.mjs';
import { validaArchivio } from '../scripts/lib/valida-archivio.mjs';
import { provaCostruzione } from '../scripts/lib/prova-costruzione.mjs';
import { hrefSicuro } from '../src/js/filtri.mjs';
import { avviaServer } from '../scripts/servi.mjs';
import { FEED_REALE, itemFinto, archivioDiProva } from './aiuto.mjs';
import { CI_SONO_SEGNAPOSTI } from './dominio.mjs';

const cartelle = [];
function nuovaCartella() { const c = mkdtempSync(join(tmpdir(), 'fermitutti-rev-')); cartelle.push(c); return c; }
test.after(() => { for (const c of cartelle) rmSync(c, { recursive: true, force: true }); });

/** Aggiornamento con un feed passato direttamente (finto server in memoria tramite data: non serve: usiamo un server http locale). */
async function conFeed(xml, dataDir, adesso = new Date('2026-11-11T10:00:00Z')) {
  const { createServer } = await import('node:http');
  const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/rss+xml' }); res.end(xml); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    return await aggiorna({ fonteUrl: `http://127.0.0.1:${server.address().port}/rss`, fonteHtmlUrl: '', dataDir, tentativi: 1, attesaMs: 1, timeoutMs: 5000, log: () => {}, adesso });
  } finally { server.close(); }
}

const AVVELENATI = {
  'settore "constructor"': FEED_REALE.replace(/Settore: Trasporto merci - Rilevanza: Nazionale/, 'Settore: constructor - Rilevanza: Nazionale').replace('<br/>Settore: Trasporto merci<br/>', '<br/>Settore: constructor<br/>'),
  'settore "toString"': FEED_REALE.replace(/Settore: Taxi - /, 'Settore: toString - ').replace('<br/>Settore: Taxi<br/>', '<br/>Settore: toString<br/>'),
  'anno 0100 nella proclamazione': FEED_REALE.replace('Data proclamazione: 25/10/2026', 'Data proclamazione: 01/01/0100'),
  'anno 0999 nella ricezione': FEED_REALE.replace('Data ricezione: 26/10/2026', 'Data ricezione: 01/01/0999'),
  'carattere U+FFFF nella categoria': FEED_REALE.replace('PERSONALE SOC. ATVO DI VENEZIA', 'PERSONALE &#xFFFF; ATVO'),
  'carattere U+FDD0 nella regione': FEED_REALE.replace('Regione: Veneto<br/>Provincia: Venezia', 'Regione: Veneto&#xFDD0;<br/>Provincia: Venezia'),
};

for (const [nome, xml] of Object.entries(AVVELENATI)) {
  test(`dato strano ma accettabile (${nome}): l'aggiornamento lo ripulisce e la build con le immagini funziona`, async () => {
    const dir = nuovaCartella();
    const r = await conFeed(xml, dir);
    assert.equal(r.ok, true, r.messaggio);
    const uscita = join(dir, 'public');
    const esito = await build({ dataDir: dir, uscita, oggi: '2026-11-11', immagini: true, log: () => {}, pubblicazione: false });
    assert.ok(esito.pagine > 100);
    const archivio = JSON.parse(readFileSync(join(dir, 'scioperi.json'), 'utf8'));
    for (const s of archivio.scioperi) {
      assert.match(s.slug, /^[a-z0-9-]+$/);
      assert.ok(!s.slug.includes('undefined'));
      assert.ok(existsSync(join(uscita, 'og', `${s.slug}.png`)));
    }
  });
}

test('la prova di costruzione blocca prima del salvataggio un archivio che romperebbe la build', () => {
  const a = archivioDiProva();
  a.scioperi[0].settore_slug = undefined;
  assert.throws(() => validaArchivio(a), /settore non valido/);
  assert.throws(() => provaCostruzione(a, { oggi: '2026-11-11' }), /settore non valido/);
  const b = archivioDiProva();
  b.scioperi[0].proclamazione = '100-01-01';
  assert.throws(() => provaCostruzione(b, { oggi: '2026-11-11' }), /proclamazione non valida/);
  const c = archivioDiProva();
  c.scioperi[0].orario = { tipo: 'orario', dalle: 'x', alle: '10:00', giornoFine: '2026-11-11' };
  assert.throws(() => validaArchivio(c), /orario non valido/);
  assert.equal(provaCostruzione(archivioDiProva(), { oggi: '2026-11-11' }), true);
});

test('crescita anomala: troppi scioperi nuovi vengono rifiutati e i dati restano intatti', async () => {
  const dir = nuovaCartella();
  assert.equal((await conFeed(FEED_REALE, dir)).ok, true);
  const prima = readFileSync(join(dir, 'scioperi.json'), 'utf8');
  const tanti = Array.from({ length: 200 }, (_, i) => itemFinto({ id: 70000 + i, inizio: '25/11/2026', settore: 'Aereo', rilevanza: 'Nazionale', regione: 'Italia', provincia: 'Tutte', modalita: '24 ORE', sindacati: 'PROVA', categoria: `PERSONALE PROVA ${i}` }));
  const r = await conFeed(FEED_REALE.replace('</channel>', `${tanti.join('\n')}</channel>`), dir, new Date('2026-11-11T10:30:00Z'));
  assert.equal(r.ok, false);
  assert.match(r.messaggio, /cresciuto in modo anomalo|troppi scioperi nuovi/);
  assert.equal(readFileSync(join(dir, 'scioperi.json'), 'utf8'), prima);
  // Feed oltre il massimo assoluto di elementi.
  const enorme = Array.from({ length: 501 }, (_, i) => itemFinto({ id: 80000 + i, inizio: '25/11/2026', settore: 'Aereo', rilevanza: 'Nazionale', regione: 'Italia', provincia: 'Tutte', modalita: '24 ORE', sindacati: 'PROVA', categoria: 'PERSONALE PROVA' }));
  const r2 = await conFeed(FEED_REALE.replace('</channel>', `${enorme.join('\n')}</channel>`), dir, new Date('2026-11-11T11:00:00Z'));
  assert.equal(r2.ok, false);
  assert.ok(MASSIMO_NUOVI <= 100);
});

test('input ostili: il lettore resta veloce (tempo lineare)', () => {
  const misura = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
  const lungo = FEED_REALE.replace('Provincia: Cosenza</title>', `Provincia: ${'Cosenza - '.repeat(2000)}</title>`);
  assert.ok(misura(() => analizzaFeed(lungo)) < 1000, 'titolo da 20 KB');
  assert.ok(misura(() => analizzaFeed(`<rss><channel>${'<item>'.repeat(150000)}</channel></rss>`)) < 1000, 'item non chiusi');
  assert.ok(misura(() => pulisciTesto('<'.repeat(300000))) < 1000, 'molti < non chiusi');
  assert.ok(misura(() => estraiNoteDaHtml('<table>'.repeat(50000) + '<tr>'.repeat(50000))) < 1000, 'tabelle non chiuse');
  const f = analizzaFeed(lungo);
  assert.ok(f.elementi[0].sospetti.includes('titolo'), 'un titolo enorme è sospetto');
});

test('i messaggi per le segnalazioni non contengono indirizzi cliccabili', () => {
  const m = senzaIndirizzi('guid non riconosciuto (Accedi qui: https://github-login.evil.example/x) oppure www.evil.example o scrivi a a@b.it');
  assert.doesNotMatch(m, /https?:|www\.|@/);
  assert.match(m, /\[indirizzo tolto\]/);
});

test('link nel browser: solo interni o https', () => {
  for (const cattivo of ['//evil.example/x', '///evil.example', '/\\evil.example', 'javascript:alert(1)', 'http://x.it', 'https://x.it/"onmouseover=y', '/a b']) assert.equal(hrefSicuro(cattivo), null, cattivo);
  assert.equal(hrefSicuro('/sciopero/2026-11-20-treni/'), '/sciopero/2026-11-20-treni/');
  assert.equal(hrefSicuro('https://europa.eu/youreurope/'), 'https://europa.eu/youreurope/');
});

function chiedi(porta, percorso, host = '127.0.0.1') {
  return new Promise((risolvi, rifiuta) => {
    const r = request({ host: '127.0.0.1', port: porta, path: percorso, headers: { host } }, (res) => {
      let corpo = '';
      res.on('data', (d) => { corpo += d; });
      res.on('end', () => { res.corpo = corpo; risolvi(res); });
    });
    r.on('error', rifiuta);
    r.end();
  });
}

test('server locale: richieste malformate, percorsi fuori dalla cartella e host estranei', async () => {
  const dir = nuovaCartella();
  mkdirSync(join(dir, 'sito', 'citta'), { recursive: true });
  writeFileSync(join(dir, 'sito', 'index.html'), 'ok');
  writeFileSync(join(dir, 'sito', '404.html'), 'non trovato');
  writeFileSync(join(dir, 'segreto.txt'), 'segreto');
  const server = await avviaServer({ porta: 0, cartella: join(dir, 'sito') });
  const porta = server.address().port;
  try {
    assert.equal((await chiedi(porta, '/%E0%A4%A')).statusCode, 400);
    assert.equal((await chiedi(porta, '/')).statusCode, 200, 'il server è ancora vivo');
    for (const tentativo of ['/..%5c..%5csegreto.txt', '/%2e%2e/segreto.txt', '/..%2fsegreto.txt', '/%2e%2e%5csegreto.txt']) {
      const r = await chiedi(porta, tentativo);
      assert.ok([400, 404].includes(r.statusCode), `${tentativo}: ${r.statusCode}`);
      assert.notEqual(r.corpo, 'segreto', `${tentativo}: file fuori dalla cartella servito`);
    }
    assert.equal((await chiedi(porta, '/..%5c..%5csegreto.txt')).statusCode, 400, 'la barra rovesciata è rifiutata');
    assert.equal((await chiedi(porta, '/', 'evil.example')).statusCode, 421);
    const r = await chiedi(porta, '/%2Fcitta');
    assert.ok(!String(r.headers.location || '').startsWith('//'), `location: ${r.headers.location}`);
  } finally { server.close(); }
});

test('la pagina 404 ha la sua politica di sicurezza (serve sotto /widget/)', async () => {
  const { buildDiProva } = await import('./costruisci.mjs');
  const { uscita } = await buildDiProva();
  const t = readFileSync(join(uscita, '404.html'), 'utf8');
  assert.match(t, /<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';[^"]*object-src 'none'; base-uri 'none'; form-action 'none'">/);
});

test('su Cloudflare (CF_PAGES=1) la build si ferma se restano segnaposto e mancano le variabili', { skip: !CI_SONO_SEGNAPOSTI && 'nome ed email già scritti in config/sito.mjs' }, async () => {
  const dir = nuovaCartella();
  mkdirSync(join(dir, 'dati'));
  writeFileSync(join(dir, 'dati', 'scioperi.json'), JSON.stringify(archivioDiProva()));
  await assert.rejects(build({ dataDir: join(dir, 'dati'), uscita: join(dir, 'public'), oggi: '2026-11-11', immagini: false, log: () => {}, pubblicazione: true, ambiente: {} }), /segnaposto ancora da compilare/);
});
