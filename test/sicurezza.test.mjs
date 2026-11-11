// Sicurezza: escape per ogni contesto, link solo sicuri, intestazioni HTTP, widget, affiliazioni, dati malevoli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { e, urlSicuro, jsonPerScript } from '../scripts/lib/html.mjs';
import { leggiHeaders, intestazioniPer } from '../scripts/servi.mjs';
import { preparaAffiliati, compagniaAereaCheSciopera, htmlDirittiVolo, htmlAlternative, htmlPubblicita } from '../scripts/lib/affiliati.mjs';
import { validaArchivio } from '../scripts/build.mjs';
import { validaFasce } from '../scripts/lib/fasce.mjs';
import { htmlScheda } from '../scripts/lib/pagine.mjs';
import { schedaModello } from '../src/js/schede.mjs';
import { compatto } from '../scripts/lib/presenta.mjs';
import { archivioDiProva } from './aiuto.mjs';
import { buildDiProva } from './costruisci.mjs';

test('escape HTML in testo e attributi', () => {
  assert.equal(e('<script>"x"&\'y\'</script>'), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  assert.equal(e(null), '');
});

test('link: solo interni, https, webcal e mailto; tutto il resto diventa #', () => {
  for (const cattivo of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'http://example.com', '//evil.example/x',
    '/\\evil.example', 'https://user:pw@evil.example/', 'ftp://x', '/x"onmouseover="y', '', null]) {
    assert.equal(urlSicuro(cattivo), '#', String(cattivo));
  }
  assert.equal(urlSicuro('/sciopero/2026-11-20-treni/'), '/sciopero/2026-11-20-treni/');
  assert.equal(urlSicuro('https://europa.eu/x?a=1&b=2'), 'https://europa.eu/x?a=1&amp;b=2');
  assert.equal(urlSicuro('webcal://fermitutti.it/ics/italia.ics'), 'webcal://fermitutti.it/ics/italia.ics');
  assert.equal(urlSicuro('https://evil.example/', ['trenitalia.com']), '#');
  assert.equal(urlSicuro('https://www.trenitalia.com/x', ['trenitalia.com']), 'https://www.trenitalia.com/x');
});

test('JSON dentro <script type="application/ld+json"> non può chiudere il tag', () => {
  const j = jsonPerScript({ a: '</script><script>alert(1)</script>', b: 'x' + String.fromCharCode(0x2028) + 'y' });
  assert.ok(!j.includes('</script'));
  assert.ok(!j.includes(String.fromCharCode(0x2028)));
  assert.equal(JSON.parse(j).a, '</script><script>alert(1)</script>');
});

test('dati malevoli arrivati fino alla pagina vengono mostrati come testo', () => {
  const a = archivioDiProva();
  const s = structuredClone(a.scioperi.find((x) => x.id === '8605'));
  s.categoria = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
  s.modalita = 'javascript:alert(3)';
  const html = htmlScheda(schedaModello(compatto(s, new Map()), '2026-11-11'), 3);
  assert.ok(!html.includes('<script>'), html);
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/href="javascript:/i.test(html));
  // E la build rifiuta comunque un archivio con caratteri < >.
  const cattivo = archivioDiProva();
  cattivo.scioperi[0].categoria = '<b>x</b>';
  assert.throws(() => validaArchivio(cattivo), /campo categoria non valido/);
  const slugCattivo = archivioDiProva();
  slugCattivo.scioperi[0].slug = '../../etc';
  assert.throws(() => validaArchivio(slugCattivo), /slug non valido/);
});

test('fasce garantite: il file dati è valido e i link sono https', () => {
  assert.equal(validaFasce(), true);
  assert.throws(() => validaFasce([{ id: 'x', tipo: 'aereo', fonte_url: 'http://x.it', fasce: [], verificato_il: '2026-11-11', pagina_scioperi_url: null }]), /https/);
  assert.throws(() => validaFasce([{ id: 'x', tipo: 'aereo', fonte_url: 'https://x.it', fasce: [{ giorni: 'tutti', dalle: '25:00', alle: '9:00' }], fasce_testo: 'x', verificato_il: '2026-11-11' }]), /orario non valido/);
  assert.throws(() => validaFasce([{ id: 'x', tipo: 'aereo', fonte_url: 'https://x.it', fasce: [{ giorni: 'tutti', dalle: '06:00', alle: '09:00' }], fasce_testo: null, verificato_il: '2026-11-11' }]), /citazione/);
});

test('intestazioni di sicurezza (_headers)', () => {
  const regole = leggiHeaders(readFileSync(new URL('../src/_headers', import.meta.url), 'utf8'));
  const h = intestazioniPer(regole, '/');
  const csp = h['Content-Security-Policy'];
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'none'", "script-src 'self'", "require-trusted-types-for 'script'"]) {
    assert.ok(csp.includes(d), `manca ${d}`);
  }
  assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp), 'niente unsafe-inline, unsafe-eval o caratteri jolly');
  assert.match(h['Strict-Transport-Security'], /max-age=(\d+)/);
  assert.ok(Number(/max-age=(\d+)/.exec(h['Strict-Transport-Security'])[1]) >= 63072000);
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(h['Permissions-Policy'], /camera=\(\).*geolocation=\(\).*microphone=\(\)/);
  assert.equal(h['Cross-Origin-Opener-Policy'], 'same-origin');
  for (const p of ['/sciopero/x/', '/citta/milano/', '/dati/scioperi.json', '/ics/italia.ics', '/assistente/']) assert.ok(intestazioniPer(regole, p)['Content-Security-Policy'], p);
  const w = intestazioniPer(regole, '/widget/milano/');
  assert.equal(w['Content-Security-Policy'], undefined, 'il widget si può incorporare');
  assert.equal(w['X-Frame-Options'], undefined);
  assert.equal(w['X-Robots-Tag'], 'noindex');
  assert.ok(w['Strict-Transport-Security'] && w['X-Content-Type-Options']);
  for (const r of regole) for (const [nome] of r.imposta) assert.ok(!r.togli.includes(nome.toLowerCase()), `la regola ${r.schema} toglie e reimposta ${nome}`);
  assert.ok(regole.length <= 100, 'limite di Cloudflare: 100 regole');
  // Solo il dominio va su Google: gli indirizzi *.pages.dev hanno noindex.
  for (const schema of ['https://:progetto.pages.dev/*', 'https://:anteprima.:progetto.pages.dev/*']) {
    const r = regole.find((x) => x.schema === schema);
    assert.ok(r, `manca la regola ${schema}`);
    assert.deepEqual(r.imposta, [['X-Robots-Tag', 'noindex']]);
  }
});

test('il widget non contiene script e ha la sua politica di sicurezza', async () => {
  const { uscita } = await buildDiProva();
  const html = readFileSync(join(uscita, 'widget', 'milano', 'index.html'), 'utf8');
  assert.ok(!/<script/i.test(html));
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'/);
  assert.match(html, /target="_blank" rel="noopener"/);
});

test('affiliazioni: spente senza codici, validate quando ci sono', () => {
  const spente = preparaAffiliati({ airhelp: { link: '' }, flixbus: { awinAffid: '' }, noleggioAuto: { link: '' }, pubblicita: { attiva: false } });
  assert.deepEqual(spente, { airhelp: null, flixbus: null, noleggio: null, pubblicita: false });
  const accese = preparaAffiliati({ airhelp: { link: 'https://www.airhelp.com/it/?a_aid=123' }, flixbus: { awinAffid: '12345', awinMid: '110876' }, noleggioAuto: { link: 'https://www.discovercars.com/?a_aid=x', nome: 'Discover Cars' } });
  assert.equal(accese.flixbus, 'https://www.awin1.com/cread.php?awinmid=110876&awinaffid=12345&ued=https%3A%2F%2Fwww.flixbus.it%2F');
  for (const cattivo of [{ airhelp: { link: 'javascript:alert(1)' } }, { airhelp: { link: 'http://www.airhelp.com/' } }, { airhelp: { link: 'https://airhelp.com.evil.example/' } },
    { flixbus: { awinAffid: '12a', awinMid: '110876' } }, { noleggioAuto: { link: 'https://evil.example/', nome: 'X' } }, { noleggioAuto: { link: 'https://www.rentalcars.com/', nome: '<b>' } }]) {
    assert.throws(() => preparaAffiliati(cattivo), /non valido/, JSON.stringify(cattivo));
  }
});

test('rimborsi aerei: testo forte solo se sciopera la compagnia, mai promesse', () => {
  const base = { settore_slug: 'aerei' };
  assert.equal(compagniaAereaCheSciopera({ ...base, categoria: 'PERSONALE NAVIGANTE SOC. EASYJET' }), 'EASYJET');
  assert.equal(compagniaAereaCheSciopera({ ...base, categoria: 'PILOTI E ASSISTENTI DI VOLO ITA AIRWAYS' }), 'ITA AIRWAYS');
  assert.equal(compagniaAereaCheSciopera({ ...base, categoria: 'PERSONALE SOC. ENAV AEROPORTO DI MILANO MALPENSA' }), null);
  assert.equal(compagniaAereaCheSciopera({ ...base, categoria: 'PERSONALE HANDLING RYANAIR' }), null);
  assert.equal(compagniaAereaCheSciopera({ settore_slug: 'generale', categoria: 'RYANAIR' }), null);
  const nessunCodice = { airhelp: null, flixbus: null, noleggio: null };
  const conCodice = { airhelp: 'https://www.airhelp.com/it/?a_aid=1', flixbus: 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2', noleggio: null };
  const forte = htmlDirittiVolo({ ...base, categoria: 'PERSONALE NAVIGANTE SOC. EASYJET' }, conCodice);
  assert.match(forte, /potrebbero spettarti da 250 a 600 euro/);
  assert.match(forte, /rel="sponsored noopener"/);
  assert.match(forte, /Link di affiliazione/);
  const neutro = htmlDirittiVolo({ ...base, categoria: 'PERSONALE SOC. ENAV' }, conCodice);
  assert.doesNotMatch(neutro, /250|600|spettarti/);
  assert.match(neutro, /europa\.eu/);
  assert.doesNotMatch(htmlDirittiVolo({ ...base, categoria: 'PERSONALE SOC. ENAV' }, nessunCodice), /airhelp|sponsored/i);
  assert.equal(htmlAlternative({}, nessunCodice), '');
  assert.match(htmlAlternative({}, conCodice), /rel="sponsored noopener"/);
  assert.equal(htmlPubblicita({ pubblicita: false }), '');
  for (const t of [forte, neutro]) assert.doesNotMatch(t, /garantit[oa] (il|un) rimborso|sicuramente/i);
});

test('nessun link affiliato nel sito costruito senza codici', async () => {
  const { uscita } = await buildDiProva();
  const html = readFileSync(join(uscita, 'sciopero', archivioDiProva().scioperi.find((s) => s.id === '8579').slug, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /sponsored|airhelp|awin1/i);
  assert.match(html, /europa\.eu\/youreurope/);
});

test('statistiche spente: CSP invariata; accese: solo i due indirizzi di Cloudflare', async () => {
  const { intestazioniPerConfigurazione } = await import('../scripts/build.mjs');
  const originale = readFileSync(new URL('../src/_headers', import.meta.url), 'utf8');
  assert.equal(intestazioniPerConfigurazione(originale, { statisticheCloudflare: false }), originale);
  const accese = intestazioniPerConfigurazione(originale, { statisticheCloudflare: true });
  assert.match(accese, /script-src 'self' https:\/\/static\.cloudflareinsights\.com;/);
  assert.match(accese, /connect-src 'self' https:\/\/cloudflareinsights\.com;/);
  assert.doesNotMatch(accese, /unsafe-inline|unsafe-eval/);
  assert.match(accese, /frame-ancestors 'none'/);
});
