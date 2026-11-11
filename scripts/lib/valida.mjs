// Validazione rigorosa dei dati letti dal feed. Se qualcosa non torna, non si pubblica nulla.
import { readFileSync } from 'node:fs';
import { daItaliana, differenzaGiorni } from './date.mjs';

const settori = JSON.parse(readFileSync(new URL('../../data/settori.json', import.meta.url), 'utf8'));

export const LIMITI = {
  titolo: 400, modalita: 700, categoria: 500, sindacati: 500, note: 700,
  settore: 80, rilevanza: 40, regione: 60, provincia: 60, inizio: 12, fine: 12, proclamazione: 12, ricezione: 20,
};
const RE_GUID = /^https?:\/\/scioperi\.mit\.gov\.it\/(\d{1,9})$/;
export const RILEVANZE = ['Nazionale', 'Interregionale', 'Regionale', 'Territoriale', 'Provinciale', 'Locale', 'Aziendale', 'Da definire'];
const OBBLIGATORI = ['inizio', 'fine', 'settore', 'rilevanza', 'regione', 'provincia'];
const DURATA_MASSIMA_GIORNI = 60;
const ORIZZONTE_GIORNI = 400;
export const MINIMO_PER_CONTROLLO_CALO = 6;

function taglia(s, n = 60) {
  s = String(s ?? '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Valida gli elementi del feed.
 * @param {Array} elementi - output di analizzaFeed().elementi
 * @param {object} opzioni - { oggi: 'YYYY-MM-DD', attesiMinimi: scioperi ancora validi nell'archivio, accettaCalo: true per saltare il controllo sul calo }
 * @returns {{ ok: boolean, errori: string[], avvisi: string[], record: object[] }}
 */
export function validaElementi(elementi, opzioni = {}) {
  const { oggi = null, attesiMinimi = null, accettaCalo = false } = opzioni;
  const errori = [], avvisi = [], record = [];
  if (!Array.isArray(elementi) || elementi.length === 0) {
    errori.push('il feed non contiene nessuno sciopero');
    return { ok: false, errori, avvisi, record };
  }
  if (elementi.length > 2000) {
    errori.push(`il feed contiene troppi elementi (${elementi.length})`);
    return { ok: false, errori, avvisi, record };
  }
  const visti = new Set();
  let sconosciuti = 0;
  elementi.forEach((el, i) => {
    const dove = `elemento ${i + 1}`;
    const c = el.campi || {};
    const m = RE_GUID.exec(el.guid || '');
    if (!m) { errori.push(`${dove}: guid non riconosciuto (${taglia(el.guid)})`); return; }
    const id = m[1];
    if (visti.has(id)) { errori.push(`${dove}: guid duplicato ${id}`); return; }
    visti.add(id);
    if (el.sospetti && el.sospetti.length) { errori.push(`${dove} (${id}): markup o link non attesi nei campi ${el.sospetti.join(', ')}`); return; }
    for (const k of OBBLIGATORI) {
      if (!c[k]) { errori.push(`${dove} (${id}): manca il campo ${k}`); return; }
    }
    for (const [k, lim] of Object.entries(LIMITI)) {
      if (typeof c[k] === 'string' && c[k].length > lim) { errori.push(`${dove} (${id}): campo ${k} troppo lungo (${c[k].length} caratteri)`); return; }
    }
    if ((el.titolo || '').length > LIMITI.titolo) { errori.push(`${dove} (${id}): titolo troppo lungo`); return; }
    for (const [k, v] of Object.entries(c)) {
      if (typeof v === 'string' && /[<>]/.test(v)) { errori.push(`${dove} (${id}): il campo ${k} contiene caratteri non ammessi`); return; }
    }
    const inizio = daItaliana(c.inizio), fine = daItaliana(c.fine);
    if (!inizio) { errori.push(`${dove} (${id}): data di inizio non valida (${taglia(c.inizio)})`); return; }
    if (!fine) { errori.push(`${dove} (${id}): data di fine non valida (${taglia(c.fine)})`); return; }
    if (fine < inizio) { errori.push(`${dove} (${id}): la fine (${fine}) precede l'inizio (${inizio})`); return; }
    if (differenzaGiorni(inizio, fine) > DURATA_MASSIMA_GIORNI) { errori.push(`${dove} (${id}): durata anomala (${differenzaGiorni(inizio, fine)} giorni)`); return; }
    if (oggi) {
      if (differenzaGiorni(oggi, inizio) > ORIZZONTE_GIORNI) { errori.push(`${dove} (${id}): inizio troppo lontano nel futuro (${inizio})`); return; }
      if (differenzaGiorni(fine, oggi) > ORIZZONTE_GIORNI) { errori.push(`${dove} (${id}): sciopero troppo vecchio (${fine})`); return; }
    }
    const proclamazione = c.proclamazione ? daItaliana(c.proclamazione) : null;
    const ricezione = c.ricezione ? daItaliana(String(c.ricezione).slice(0, 10)) : null;
    if (c.proclamazione && !proclamazione) avvisi.push(`${dove} (${id}): data di proclamazione non leggibile (${taglia(c.proclamazione)})`);
    if (!(c.settore in settori) || c.settore.startsWith('_')) { sconosciuti++; avvisi.push(`${dove} (${id}): settore sconosciuto "${taglia(c.settore)}"`); }
    if (!RILEVANZE.includes(c.rilevanza)) avvisi.push(`${dove} (${id}): rilevanza sconosciuta "${taglia(c.rilevanza)}"`);
    if (!c.modalita) avvisi.push(`${dove} (${id}): modalità assente`);
    record.push({
      id, inizio, fine,
      settore: c.settore, rilevanza: c.rilevanza, regione: c.regione, provincia: c.provincia,
      modalita: c.modalita || '', sindacati: c.sindacati || '', categoria: c.categoria || '', note: c.note || '',
      proclamazione, ricezione,
    });
  });
  if (errori.length === 0) {
    if (sconosciuti > 0 && sconosciuti > record.length * 0.3) errori.push(`troppi settori sconosciuti (${sconosciuti} su ${record.length}): il formato è cambiato?`);
    if (!accettaCalo && attesiMinimi != null && attesiMinimi >= MINIMO_PER_CONTROLLO_CALO && record.length < Math.ceil(attesiMinimi * 0.5)) {
      errori.push(`numero di scioperi crollato: ${record.length} nel feed contro ${attesiMinimi} ancora validi nell'archivio`);
    }
  }
  return { ok: errori.length === 0, errori, avvisi, record };
}
