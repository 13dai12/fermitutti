// Build completa: pagine, link interni, metadati, dati strutturati, file statici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildDiProva } from './costruisci.mjs';
import { archivioDiProva } from './aiuto.mjs';
import { BASE, letterale, CI_SONO_SEGNAPOSTI } from './dominio.mjs';

const B = letterale(BASE);

function tuttiIFile(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...tuttiIFile(p)); else out.push(p);
  }
  return out;
}

test('la build produce tutte le pagine e i file attesi', async () => {
  const { uscita, messaggi } = await buildDiProva();
  const a = archivioDiProva();
  for (const s of a.scioperi) {
    assert.ok(existsSync(join(uscita, 'sciopero', s.slug, 'index.html')), s.slug);
    assert.ok(existsSync(join(uscita, 'og', `${s.slug}.png`)), `anteprima ${s.slug}`);
  }
  for (const p of ['index.html', '404.html', 'citta/index.html', 'citta/milano/index.html', 'regione/lombardia/index.html', 'settore/treni/index.html',
    'calendario/index.html', 'assistente/index.html', 'incorpora/index.html', 'widget/milano/index.html', 'come-funziona/index.html', 'fonti/index.html',
    'privacy/index.html', 'note-legali/index.html', 'contatti/index.html', 'stato/index.html', 'sitemap.xml', 'robots.txt', '_headers',
    '.well-known/security.txt', 'dati/scioperi.json', 'dati/base.json', 'dati/stato.json', 'stile.css', 'tema.js', 'js/app.js', 'js/assistente.js',
    'icona.svg', 'icona-180.png', 'og/predefinita.png', 'ics/italia.ics', 'ics/citta-roma.ics', 'ics/regione-sicilia.ics', 'ics/settore-aerei.ics']) {
    assert.ok(existsSync(join(uscita, p)), p);
  }
  if (CI_SONO_SEGNAPOSTI) assert.ok(messaggi.some((m) => /segnaposto ancora da compilare/.test(m)), 'avviso sui segnaposto');
  const png = readFileSync(join(uscita, 'og', 'predefinita.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('ogni link interno porta a un file esistente; niente script o stili in linea', async () => {
  const { uscita } = await buildDiProva();
  const html = tuttiIFile(uscita).filter((f) => f.endsWith('.html'));
  assert.ok(html.length > 150, `pagine: ${html.length}`);
  const rotti = [];
  for (const f of html) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      let p = m[1];
      if (p.endsWith('/')) p += 'index.html';
      if (!existsSync(join(uscita, p))) rotti.push(`${relative(uscita, f)} -> ${m[1]}`);
    }
    for (const s of t.matchAll(/<script\b([^>]*)>/g)) {
      assert.ok(/\bsrc="\//.test(s[1]) || /type="application\/ld\+json"/.test(s[1]), `${relative(uscita, f)}: script in linea ${s[0]}`);
    }
    assert.ok(!/\sstyle="/.test(t), `${relative(uscita, f)}: attributo style in linea`);
    assert.ok(!/\son[a-z]+="/i.test(t), `${relative(uscita, f)}: gestore di eventi in linea`);
    assert.ok(!/href="(javascript|data|vbscript):/i.test(t), `${relative(uscita, f)}: link pericoloso`);
  }
  assert.deepEqual(rotti, []);
});

test('ogni pagina ha titolo, descrizione, canonical, lingua e un solo h1', async () => {
  const { uscita } = await buildDiProva();
  const pagine = tuttiIFile(uscita).filter((f) => f.endsWith('.html') && !f.includes('/widget/'));
  const titoli = new Set();
  for (const f of pagine) {
    const t = readFileSync(f, 'utf8');
    const nome = relative(uscita, f);
    assert.match(t, /^<!doctype html>\n<html lang="it">/, nome);
    const titolo = /<title>([^<]{10,})<\/title>/.exec(t);
    assert.ok(titolo, `${nome}: titolo`);
    titoli.add(titolo[1]);
    assert.match(t, /<meta name="description" content="[^"]{50,}">/, `${nome}: descrizione`);
    assert.match(t, new RegExp('<link rel="canonical" href="' + B + '/[^"]*">'), `${nome}: canonical`);
    assert.equal((t.match(/<h1[\s>]/g) || []).length, 1, `${nome}: un solo h1`);
    assert.match(t, new RegExp('<meta property="og:image" content="' + B + '/og/[a-z0-9-]+[.]png">'), `${nome}: anteprima`);
  }
  assert.ok(titoli.size > pagine.length * 0.6, 'titoli in gran parte diversi');
});

test('dati strutturati schema.org Event sulle pagine degli scioperi', async () => {
  const { uscita } = await buildDiProva();
  const a = archivioDiProva();
  const leggiLd = (slug) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(readFileSync(join(uscita, 'sciopero', slug, 'index.html'), 'utf8'))[1]);
  const per = (id) => a.scioperi.find((s) => s.id === id);
  const treni = leggiLd(per('8635').slug);
  assert.equal(treni['@type'], 'Event');
  assert.equal(treni.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(treni.startDate, '2026-11-20T21:00:00');
  assert.equal(treni.location.address.addressCountry, 'IT');
  assert.equal(leggiLd(per('9001').slug).eventStatus, 'https://schema.org/EventCancelled');
  const rinviato = leggiLd(per('9003').slug);
  assert.equal(rinviato.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(leggiLd(per('9002').slug).eventStatus, 'https://schema.org/EventRescheduled');
  assert.equal(leggiLd(per('8603').slug).location.address.addressLocality, 'Napoli');
});

test('sitemap, robots e security.txt', async () => {
  const { uscita } = await buildDiProva();
  const sitemap = readFileSync(join(uscita, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, new RegExp('<loc>' + B + '/</loc>'));
  assert.match(sitemap, /sciopero\/2026-11-20-treni-nazionale/);
  assert.doesNotMatch(sitemap, /2026-11-10-/, 'gli scioperi già passati non vanno nella sitemap');
  assert.doesNotMatch(sitemap, /widget|stato\//);
  assert.match(readFileSync(join(uscita, 'robots.txt'), 'utf8'), new RegExp('Sitemap: ' + B + '/sitemap[.]xml'));
  const sec = readFileSync(join(uscita, '.well-known', 'security.txt'), 'utf8');
  assert.match(sec, /^Contact: mailto:/m);
  const scade = /^Expires: (.+)$/m.exec(sec)[1];
  assert.ok(Date.parse(scade) > Date.parse('2026-11-11') && Date.parse(scade) < Date.parse('2027-11-11'));
});

test('la home statica mostra oggi, domani e i prossimi 7 giorni con gli stati giusti', async () => {
  const { uscita } = await buildDiProva();
  const t = readFileSync(join(uscita, 'index.html'), 'utf8');
  assert.match(t, /<section id="oggi"[\s\S]*Nessuno sciopero in calendario per oggi/);
  assert.match(t, /Bus, tram e metro a Venezia/);
  assert.match(t, /Venerdì 13 novembre/);
  assert.match(t, /pill-stato revocato">Revocato/, 'il revocato del 18 resta visibile');
  const dati = JSON.parse(readFileSync(join(uscita, 'dati', 'scioperi.json'), 'utf8'));
  assert.equal(dati.scioperi.length, 35);
  assert.equal(dati.stato.oggi_build, '2026-11-11');
});

test('la pagina di uno sciopero escluso dai trasporti lo dice chiaramente', async () => {
  const { uscita } = await buildDiProva();
  const s = archivioDiProva().scioperi.find((x) => x.id === '8640');
  const t = readFileSync(join(uscita, 'sciopero', s.slug, 'index.html'), 'utf8');
  assert.match(t, /esclude il settore dei trasporti/);
  const rinviato = archivioDiProva().scioperi.find((x) => x.id === '9002');
  const r = readFileSync(join(uscita, 'sciopero', rinviato.slug, 'index.html'), 'utf8');
  assert.match(r, /Vai allo sciopero del giovedì 26 novembre/);
});
