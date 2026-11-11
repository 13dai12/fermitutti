// Lettura del feed del Ministero, validazione e normalizzazione (anche con dati malevoli).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizzaFeed, pulisciTesto, contieneMarkup, ErroreFeed } from '../scripts/lib/feed.mjs';
import { validaElementi } from '../scripts/lib/valida.mjs';
import { normalizza, analizzaOrario, analizzaCoinvolgimento, giorniToccati, zonaDi, slugify } from '../scripts/lib/normalizza.mjs';
import { estraiNoteDaHtml, applicaNote } from '../scripts/lib/arricchisci.mjs';
import { FEED_REALE } from './aiuto.mjs';
import { readFileSync } from 'node:fs';

const OGGI = '2026-11-11';

test('il feed reale viene letto per intero', () => {
  const f = analizzaFeed(FEED_REALE);
  assert.equal(f.elementi.length, 32);
  assert.equal(f.canale.aggiornatoAl, '10/11/2026');
  const primo = f.elementi[0];
  assert.equal(primo.guid, 'http://scioperi.mit.gov.it/8619');
  assert.deepEqual(primo.sospetti, []);
  assert.equal(primo.campi.inizio, '10/11/2026');
  assert.equal(primo.campi.settore, 'Trasporto pubblico locale');
  assert.equal(primo.campi.provincia, 'Cosenza');
  assert.equal(primo.campi.modalita, '4 ORE: DALLE 09.59 ALLE 13.59');
  assert.equal(primo.campi.categoria, 'PERSONALE SOC. BUSITALIA RAIL SERVICE - B.U. CALABRIA');
});

test('il feed reale è valido', () => {
  const v = validaElementi(analizzaFeed(FEED_REALE).elementi, { oggi: OGGI });
  assert.equal(v.ok, true, v.errori.join('; '));
  assert.equal(v.record.length, 32);
  assert.deepEqual(v.avvisi, []);
});

test('risposte che non sono un feed RSS vengono rifiutate', () => {
  assert.throws(() => analizzaFeed('<html><body>Manutenzione</body></html>'), ErroreFeed);
  assert.throws(() => analizzaFeed(''), ErroreFeed);
  assert.throws(() => analizzaFeed(null), ErroreFeed);
  assert.throws(() => analizzaFeed('x'.repeat(6_000_000)), /troppo grande/);
  assert.throws(() => analizzaFeed(FEED_REALE.replace('<rss', '<!DOCTYPE x [<!ENTITY a "b">]><rss')), /DOCTYPE/);
});

test('pulizia del testo: tag, entità, caratteri invisibili e di direzione', () => {
  assert.equal(pulisciTesto('<b>Ciao</b> &amp; &lt;script&gt;x&lt;/script&gt;'), 'Ciao & x');
  assert.equal(pulisciTesto('A‮B​C D\u0007E﻿'), 'ABCDE');
  assert.equal(pulisciTesto('&#65;&#x42;&#0;&#xd800;'), 'AB');
  assert.equal(pulisciTesto('  molti   spazi \n a capo '), 'molti spazi a capo');
});

test('il markup nei campi rende il feed non valido', () => {
  assert.equal(contieneMarkup('PERSONALE ATM'), false);
  assert.equal(contieneMarkup('<script>alert(1)</script>'), true);
  assert.equal(contieneMarkup('&lt;img src=x onerror=alert(1)&gt;'), true);
  assert.equal(contieneMarkup('vedi javascript:alert(1)'), true);
  const cattivo = FEED_REALE.replace('PERSONALE SOC. ANM DI NAPOLI', '<img src=x onerror=alert(1)>ANM');
  const v = validaElementi(analizzaFeed(cattivo).elementi, { oggi: OGGI });
  assert.equal(v.ok, false);
  assert.match(v.errori.join(' '), /markup o link non attesi/);
  const titolo = FEED_REALE.replace('Provincia: Cosenza</title>', 'Provincia: &lt;svg onload=alert(1)&gt;</title>');
  assert.equal(validaElementi(analizzaFeed(titolo).elementi, { oggi: OGGI }).ok, false);
});

test('dati anomali: vuoto, campi mancanti, date impossibili, campi enormi, duplicati, calo improvviso', () => {
  const val = (xml, opz = {}) => validaElementi(analizzaFeed(xml).elementi, { oggi: OGGI, ...opz });
  assert.equal(val(FEED_REALE.replace(/<item>[\s\S]*<\/item>/, '')).ok, false);
  assert.match(val(FEED_REALE.replace(/Data fine: [^<]*<br\/>/g, '')).errori[0], /manca il campo fine/);
  assert.match(val(FEED_REALE.replace(/Data inizio: 10\/11\/2026/, 'Data inizio: 31/02/2026')).errori[0], /data di inizio non valida/);
  assert.match(val(FEED_REALE.replace('PERSONALE SOC. ATVO DI VENEZIA', 'X'.repeat(9000))).errori[0], /troppo lungo/);
  assert.match(val(FEED_REALE.replace('scioperi.mit.gov.it/8630', 'scioperi.mit.gov.it/8619')).errori[0], /duplicato/);
  assert.match(val(FEED_REALE.replace('scioperi.mit.gov.it/8630', 'evil.example/8630')).errori[0], /guid non riconosciuto/);
  assert.match(val(FEED_REALE.replace('Data fine: 10/11/2026', 'Data fine: 01/11/2026')).errori[0], /precede/);
  assert.match(val(FEED_REALE.replace('Data fine: 10/11/2026', 'Data fine: 10/11/2027')).errori[0], /durata anomala/);
  assert.match(val(FEED_REALE, { attesiMinimi: 80 }).errori[0], /crollato/);
  assert.equal(val(FEED_REALE, { attesiMinimi: 80, accettaCalo: true }).ok, true);
  // Molti settori sconosciuti: il formato è cambiato.
  assert.match(val(FEED_REALE.replace(/Settore: (Aereo|Trasporto pubblico locale|Generale)/g, 'Settore: Sconosciuto')).errori.join(' '), /settori sconosciuti/);
});

test('orari riconosciuti solo quando sono certi', () => {
  assert.deepEqual(analizzaOrario('4 ORE: DALLE 09.59 ALLE 13.59', '2026-11-10', '2026-11-10'), { tipo: 'orario', dalle: '09:59', alle: '13:59', giornoFine: '2026-11-10' });
  assert.deepEqual(analizzaOrario('24 ORE', '2026-11-13', '2026-11-13'), { tipo: 'giornata', dalle: null, alle: null, giornoFine: '2026-11-13' });
  assert.deepEqual(analizzaOrario('24 ORE: DALLE 00.00 ALLE 24.00', '2026-11-14', '2026-11-14').tipo, 'giornata');
  assert.deepEqual(analizzaOrario('23 ORE: DALLE 21.00 DEL 20/11 ALLE 20.00 DEL 21/11', '2026-11-20', '2026-11-21'), { tipo: 'orario', dalle: '21:00', alle: '20:00', giornoFine: '2026-11-21' });
  assert.deepEqual(analizzaOrario('8 ORE: DALLE 16.00 ALLE 24.00', '2026-11-10', '2026-11-10'), { tipo: 'orario', dalle: '16:00', alle: '00:00', giornoFine: '2026-11-11' });
  assert.equal(analizzaOrario("24 ORE: VARIE MODALITA'", '2026-11-13', '2026-11-13'), null);
  assert.equal(analizzaOrario('DALLE 21.00 DEL 19/11 ALLE 21.00 DEL 20/11', '2026-11-20', '2026-11-21'), null, 'date nel testo diverse da quelle ufficiali');
  assert.equal(analizzaOrario('DALLE 25.00 ALLE 26.00', '2026-11-20', '2026-11-20'), null);
  assert.equal(analizzaOrario('', '2026-11-20', '2026-11-20'), null);
});

test('settori coinvolti ed esclusi letti dal testo ufficiale', () => {
  assert.deepEqual(analizzaCoinvolgimento('treni', 'X', 'Y'), { coinvolti: ['treni'], esclusi: [], escludeTrasporti: false });
  const esclusione = analizzaCoinvolgimento('generale', 'SCIOPERO GENERALE CATEGORIE PUBBLICHE E PRIVATE CON ESCLUSIONE SETTORE TRASPORTI', 'INTERA GIORNATA');
  assert.equal(esclusione.escludeTrasporti, true);
  const parziale = analizzaCoinvolgimento('generale', 'SCIOPERO GENERALE', 'INTERA GIORNATA - ESCLUSO TRASPORTO FERROVIARIO, MERCI SU ROTAIA E VARIE AZIENDE TPL');
  assert.deepEqual(parziale, { coinvolti: null, esclusi: ['treni'], escludeTrasporti: false }, 'le merci su rotaia non escludono le merci su strada');
  const cgil = analizzaCoinvolgimento('generale', 'SCIOPERO GENERALE', "INTERA GIORNATA DI LAVORO - FERROVIARIO: GRUPPO FSI DALLE 21.00 DEL 19/11 ALLE 20.59 DEL 20/11, ITALO-NTV 00.00-23.59; AEREO, TPL, TAXI, NCC, MARITTIMO, PORTI: VARIE MODALITA'");
  assert.deepEqual(cgil.coinvolti, ['treni', 'bus-metro', 'aerei', 'traghetti', 'taxi', 'ncc']);
  assert.equal(analizzaCoinvolgimento('piu-settori', 'PERSONALE', 'X').coinvolti, null);
});

test('giorni toccati: modalità che iniziano la sera prima', () => {
  assert.deepEqual(giorniToccati('2026-11-20', '2026-11-20', 'FERROVIARIO: DALLE 21.00 DEL 19/11 ALLE 20.59 DEL 20/11', null), { da: '2026-11-19', a: '2026-11-20' });
  assert.deepEqual(giorniToccati('2026-11-20', '2026-11-20', 'DALLE 21.00 DEL 01/10', null), { da: '2026-11-20', a: '2026-11-20' }, 'date lontane ignorate');
  assert.deepEqual(giorniToccati('2027-01-01', '2027-01-01', 'DALLE 21.00 DEL 31/12', null), { da: '2026-12-31', a: '2027-01-01' }, 'a cavallo dell\'anno');
});

test('zona e indirizzo della pagina', () => {
  assert.deepEqual(zonaDi('Italia', 'Tutte'), { tipo: 'nazionale', nome: 'Italia', provincia: null, regione: null });
  assert.equal(zonaDi('Lombardia', 'Tutte').tipo, 'regione');
  assert.equal(zonaDi('Campania', 'Napoli').tipo, 'provincia');
  assert.equal(slugify("Valle d'Aosta <script>"), 'valle-d-aosta-script');
  const f = analizzaFeed(FEED_REALE);
  const r = validaElementi(f.elementi, { oggi: OGGI }).record.map(normalizza);
  for (const s of r) assert.match(s.slug_base, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
  assert.equal(r.find((s) => s.id === '8605').slug_base, '2026-11-14-bus-metro-bari-amtab-bari');
});

test('note della pagina HTML del Ministero abbinate agli scioperi giusti', () => {
  const html = readFileSync(new URL('./fixtures/pagina-reale.html', import.meta.url), 'utf8');
  const note = estraiNoteDaHtml(html);
  assert.ok(note && note.size >= 5, 'la tabella ufficiale ha 5 righe con note');
  const record = validaElementi(analizzaFeed(FEED_REALE).elementi, { oggi: OGGI }).record;
  const conNote = applicaNote(record, note).filter((r) => r.note);
  assert.deepEqual(conNote.map((r) => r.id).sort(), ['8575', '8579', '8592', '8602', '8633']);
  assert.equal(estraiNoteDaHtml('<html><table><tr><th>Altro</th></tr></table></html>'), null);
});

test('esclusioni richiamate da un asterisco nelle note (caso reale dell\'11/11/2026)', () => {
  const cgil = analizzaCoinvolgimento('generale', 'SCIOPERO GENERALE SETTORI PUBBLICI E PRIVATI ANCHE IN APPALTO E STRUMENTALI',
    "INTERA GIORNATA DI LAVORO* - APPALTI FERROVIARI, TPL, TAXI, NCC, MARITTIMO, PORTI, CIRCOLAZIONE E SICUREZZA STRADALE, MERCI E LOGISTICA: VARIE MODALITA'",
    'ADESIONE OS CSS - *ESCLUSI SETTORI TRASPORTO AEREO, FERROVIARIO, TRASPORTO MERCI SU ROTAIA, E VARIE SOCC. TPL');
  assert.deepEqual(cgil.esclusi.sort(), ['aerei', 'treni']);
  assert.deepEqual(cgil.coinvolti, ['servizi-ferroviari', 'bus-metro', 'traghetti', 'taxi', 'ncc', 'autostrade', 'merci']);
  assert.equal(cgil.escludeTrasporti, false);
  // Senza asterisco nelle modalità la nota riguarda solo l'adesione di un altro sindacato e non si applica.
  const adesione = analizzaCoinvolgimento('generale', 'SCIOPERO GENERALE', 'INTERA GIORNATA', 'ADESIONE DELLE OO.SS CUB CON ESCLUSIONE INTERO COMPARTO TRASPORTI');
  assert.equal(adesione.escludeTrasporti, false);
  // Un asterisco che rimanda a una nota senza esclusioni non cambia nulla.
  const solotpl = analizzaCoinvolgimento('piu-settori', 'PERSONALE', 'SETTORE FERROVIARIO; *TPL: INTERA PRESTAZIONE', '*PER TPL SOCC. FER. SUD EST, GTT');
  assert.deepEqual(solotpl.esclusi, []);
  assert.deepEqual(solotpl.coinvolti, ['treni', 'bus-metro']);
});
