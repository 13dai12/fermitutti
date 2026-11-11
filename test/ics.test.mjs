// Calendari iCalendar: validati con la libreria ical.js e con controlli puntuali su RFC 5545.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ICAL from 'ical.js';
import { buildDiProva } from './costruisci.mjs';
import { evento, calendario, escapaTesto, piega } from '../scripts/lib/ics.mjs';

function controllaFormato(testo, nome) {
  assert.ok(testo.startsWith('BEGIN:VCALENDAR\r\n'), `${nome}: inizio`);
  assert.ok(testo.endsWith('END:VCALENDAR\r\n'), `${nome}: fine`);
  assert.ok(!/[^\r]\n/.test(testo), `${nome}: solo fine riga CRLF`);
  for (const riga of testo.split('\r\n')) {
    assert.ok(Buffer.byteLength(riga, 'utf8') <= 75, `${nome}: riga troppo lunga (${Buffer.byteLength(riga)}): ${riga}`);
    assert.ok(!riga.includes('�'), `${nome}: carattere spezzato`);
  }
}

/** Nei valori TEXT ogni ';' e ',' deve essere preceduto da una barra rovesciata (RFC 5545 §3.3.11). */
function controllaEscape(testo, nome) {
  const B = String.fromCharCode(92);
  const righe = testo.replace(/\r\n[ \t]/g, '').split('\r\n');
  for (const riga of righe) {
    const m = /^(SUMMARY|DESCRIPTION|LOCATION|CATEGORIES|X-WR-CALNAME|NAME|X-WR-CALDESC)(;[^:]*)?:(.*)$/.exec(riga);
    if (!m) continue;
    const senzaCoppie = m[3].split(B + B).join('');
    for (let i = 0; i < senzaCoppie.length; i++) {
      const c = senzaCoppie[i];
      if ((c === ';' || c === ',') && senzaCoppie[i - 1] !== B) assert.fail(`${nome}: '${c}' senza escape in ${m[1]}: ${m[3].slice(0, 80)}`);
    }
  }
}

function eventi(testo) {
  const comp = new ICAL.Component(ICAL.parse(testo));
  return { comp, eventi: comp.getAllSubcomponents('vevent') };
}

test('tutti i calendari generati sono validi', async () => {
  const { uscita } = await buildDiProva();
  const cartella = join(uscita, 'ics');
  const file = readdirSync(cartella).filter((f) => f.endsWith('.ics'));
  assert.ok(file.length >= 1 + 54 + 20 + 12, `calendari trovati: ${file.length}`);
  for (const f of file) {
    const testo = readFileSync(join(cartella, f), 'utf8');
    controllaFormato(testo, f);
    controllaEscape(testo, f);
    const { comp, eventi: ev } = eventi(testo);
    assert.equal(comp.getFirstPropertyValue('version'), '2.0');
    assert.ok(comp.getFirstPropertyValue('prodid'));
    assert.equal(comp.getFirstSubcomponent('vtimezone').getFirstPropertyValue('tzid'), 'Europe/Rome');
    for (const e of ev) {
      assert.match(e.getFirstPropertyValue('uid'), /^mit-\d+@fermitutti\.it$/);
      assert.ok(e.getFirstPropertyValue('dtstamp'));
      assert.ok(Number.isInteger(e.getFirstPropertyValue('sequence')));
      assert.ok(['CONFIRMED', 'CANCELLED'].includes(e.getFirstPropertyValue('status')));
      const ev2 = new ICAL.Event(e);
      assert.ok(ev2.endDate.compare(ev2.startDate) > 0, `${f}: la fine deve seguire l'inizio`);
      assert.match(ev2.description, /Avvisa anche i colleghi: https:\/\/fermitutti\.it\/sciopero\/[a-z0-9-]+\//);
    }
  }
  // Calendari per singolo sciopero
  const singoli = readdirSync(join(cartella, 'sciopero'));
  assert.equal(singoli.length, 35);
  for (const f of singoli) controllaFormato(readFileSync(join(cartella, 'sciopero', f), 'utf8'), f);
});

test('revoche, rinvii, orari e giornate intere nel calendario nazionale', async () => {
  const { uscita } = await buildDiProva();
  const { eventi: ev } = eventi(readFileSync(join(uscita, 'ics', 'italia.ics'), 'utf8'));
  const per = (id) => ev.find((e) => e.getFirstPropertyValue('uid') === `mit-${id}@fermitutti.it`);
  const revocato = per('9001');
  assert.equal(revocato.getFirstPropertyValue('status'), 'CANCELLED');
  assert.equal(revocato.getFirstPropertyValue('sequence'), 1);
  assert.match(revocato.getFirstPropertyValue('summary'), /^REVOCATO: /);
  const rinviato = per('9002');
  assert.equal(rinviato.getFirstPropertyValue('status'), 'CANCELLED');
  assert.match(rinviato.getFirstPropertyValue('summary'), /^RINVIATO: /);
  assert.match(rinviato.getFirstPropertyValue('description'), /rinviato a giovedì 26 novembre 2026/);
  const nuovo = per('9003');
  assert.equal(nuovo.getFirstPropertyValue('status'), 'CONFIRMED');
  const treni = new ICAL.Event(per('8635'));
  assert.equal(treni.startDate.toString(), '2026-11-20T21:00:00');
  assert.equal(per('8635').getFirstProperty('dtstart').getParameter('tzid'), 'Europe/Rome');
  assert.equal(treni.endDate.toString(), '2026-11-21T20:00:00');
  assert.match(treni.description, /Fasce garantite: Trenitalia/);
  const giornata = new ICAL.Event(per('8605'));
  assert.equal(giornata.startDate.isDate, true);
  assert.equal(giornata.startDate.toString(), '2026-11-14');
  assert.equal(giornata.endDate.toString(), '2026-11-15');
  const escluso = per('8640');
  assert.match(escluso.getFirstPropertyValue('description'), /esclude il settore dei trasporti/);
});

test('calendario di una città: locali, regionali e nazionali, ma non solo merci', async () => {
  const { uscita } = await buildDiProva();
  const { eventi: ev } = eventi(readFileSync(join(uscita, 'ics', 'citta-milano.ics'), 'utf8'));
  const ids = ev.map((e) => e.getFirstPropertyValue('uid').replace(/^mit-|@.*$/g, ''));
  for (const atteso of ['8602', '9001', '8635', '8610']) assert.ok(ids.includes(atteso), `manca ${atteso}`);
  for (const assente of ['8603', '8639', '8630', '8640']) assert.ok(!ids.includes(assente), `non doveva esserci ${assente}`);
});

test('testo malevolo: niente righe iniettate, escape corretto, UTF-8 non spezzato', () => {
  const B = String.fromCharCode(92);
  assert.equal(escapaTesto('a;b,c' + B + 'd\r\ne\nf'), 'a' + B + ';b' + B + ',c' + B + B + 'd' + B + 'ne' + B + 'nf');
  const s = { id: '1', slug: 'x', stato: 'confermato', sequence: 3, modificato_il: '2026-11-11T07:00:00Z', visto_prima: '2026-11-10T07:00:00Z', inizio: '2026-11-20', fine: '2026-11-20', orario: null };
  const cattivo = 'ATTACCO\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:finto\r\nSUMMARY:finto;,\\ èèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèèè 🚌🚌🚌';
  const t = { titolo: cattivo, chi: cattivo, orari: cattivo, settore: 'Treni', luogo: cattivo, fasce: null, note: cattivo, sindacati: cattivo, url: 'https://fermitutti.it/sciopero/x/', dominio: 'fermitutti.it', avviso: cattivo };
  const testo = calendario({ nome: cattivo, descrizione: cattivo, prodid: '-//prova//IT', eventi: [evento(s, t)] });
  controllaFormato(testo, 'malevolo');
  const { eventi: ev } = eventi(testo);
  assert.equal(ev.length, 1, 'un solo evento');
  assert.equal(ev[0].getFirstPropertyValue('uid'), 'mit-1@fermitutti.it');
  assert.ok(ev[0].getFirstPropertyValue('summary').includes('END:VEVENT'), 'il testo resta testo');
  assert.ok(ev[0].getFirstPropertyValue('summary').endsWith('🚌🚌🚌'));
  assert.equal(piega('a'.repeat(200)).split('\r\n').every((r) => Buffer.byteLength(r) <= 75), true);
});
