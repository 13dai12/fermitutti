// Dal record validato al modello interno usato dal sito: slug, zona, settore, orario strutturato (solo se certo),
// settori coinvolti o esclusi (letti dal testo ufficiale) e giorni effettivamente toccati.
import { readFileSync } from 'node:fs';
import { aggiungiGiorni, componi, differenzaGiorni } from './date.mjs';

const settori = JSON.parse(readFileSync(new URL('../../data/settori.json', import.meta.url), 'utf8'));

export function slugify(testo) {
  return String(testo ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'n-d';
}

export function infoSettore(nome) {
  const s = settori[nome];
  if (s && !nome.startsWith('_')) return { ...s, mit: nome, noto: true };
  return { ...settori._altro, mit: nome, noto: false };
}

export function elencoSettori() {
  return Object.entries(settori).filter(([k]) => !k.startsWith('_')).map(([mit, s]) => ({ ...s, mit }));
}

function ora(h, m) {
  const hh = +h, mm = +m;
  if (hh > 24 || mm > 59 || (hh === 24 && mm !== 0)) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Prova a leggere un orario preciso dalle modalità del Ministero. Solo schemi semplici e inequivocabili;
 * in tutti gli altri casi restituisce null e si mostra il testo com'è (mai inventare orari).
 * Esempi riconosciuti: "4 ORE: DALLE 09.59 ALLE 13.59", "24 ORE", "INTERA GIORNATA",
 * "23 ORE: DALLE 21.00 DEL 20/11 ALLE 20.00 DEL 21/11", "24 ORE: DALLE 00.00 ALLE 24.00".
 */
export function analizzaOrario(modalita, inizio, fine) {
  const t = String(modalita ?? '').toUpperCase().replace(/\s+/g, ' ').replace(/\s*:\s*/g, ': ').trim();
  if (!t) return null;
  if (/^(INTERA GIORNATA( DI LAVORO)?|24 ORE|INTERA PRESTAZIONE( LAVORATIVA)?|INTERO TURNO( DI LAVORO)?)$/.test(t)) {
    return { tipo: 'giornata', dalle: null, alle: null, giornoFine: fine };
  }
  let m = /^(?:(\d{1,2}) ORE: )?DALLE (\d{1,2})[.:](\d{2}) ALLE (\d{1,2})[.:](\d{2})$/.exec(t);
  if (m) {
    const dalle = ora(m[2], m[3]), alle = ora(m[4], m[5]);
    if (!dalle || !alle) return null;
    if (inizio === fine && (dalle === '00:00' || dalle === '00:01') && (alle === '24:00' || alle === '23:59')) {
      return { tipo: 'giornata', dalle: null, alle: null, giornoFine: fine };
    }
    if (inizio !== fine) return null; // orario su un solo giorno ma date diverse: non è chiaro
    if (alle === '24:00') return { tipo: 'orario', dalle, alle: '00:00', giornoFine: aggiungiGiorni(inizio, 1) };
    if (alle <= dalle) return { tipo: 'orario', dalle, alle, giornoFine: aggiungiGiorni(inizio, 1) };
    return { tipo: 'orario', dalle, alle, giornoFine: inizio };
  }
  m = /^(?:(\d{1,2}) ORE: )?DALLE (\d{1,2})[.:](\d{2}) DEL (\d{1,2})\/(\d{1,2}) ALLE (\d{1,2})[.:](\d{2}) DEL (\d{1,2})\/(\d{1,2})$/.exec(t);
  if (m) {
    const dalle = ora(m[2], m[3]), alle = ora(m[6], m[7]);
    if (!dalle || !alle) return null;
    const gi = componi(+inizio.slice(0, 4), +m[5], +m[4]);
    const gf = componi(+fine.slice(0, 4), +m[9], +m[8]);
    if (gi !== inizio || gf !== fine) return null; // le date nel testo devono coincidere con quelle ufficiali
    if (alle === '24:00') return { tipo: 'orario', dalle, alle: '00:00', giornoFine: aggiungiGiorni(fine, 1) };
    return { tipo: 'orario', dalle, alle, giornoFine: fine };
  }
  return null;
}

// Parole del testo ufficiale che indicano un settore dei trasporti.
const PAROLE_SETTORI = [
  ['servizi-ferroviari', /\bAPPALTI FERROVIARI\b/],
  ['treni', /\b(FERROVIARI[OAE]?|FERROVIE|TRENI|FSI|RFI|ITALO|NTV|TRENITALIA|TRENORD)\b/],
  ['bus-metro', /\b(TPL|TRASPORTO PUBBLICO LOCALE|AUTOFERROTRANVIERI|AUTOFERROTRANVIARI|METROPOLITAN[AE])\b/],
  ['aerei', /\b(AEREO|AEREI|AEREA|AEROPORT[OI]|AEROPORTUAL[EI]|AVIAZIONE|ENAV|VOLO|VOLI|HANDLING)\b/],
  ['traghetti', /\b(MARITTIM[OI]|PORT[OI]|PORTUAL[EI]|TRAGHETT[OI]|NAVIGAZIONE)\b/],
  ['taxi', /\bTAXI\b/],
  ['ncc', /\bNCC\b/],
  ['autostrade', /\b(AUTOSTRAD[AE]|AUTOSTRADAL[EI]|CIRCOLAZIONE E SICUREZZA STRADALE)\b/],
  ['merci', /\b(MERCI|LOGISTICA|AUTOTRASPORTO)\b/],
];
export const SETTORI_TRASPORTO = ['treni', 'servizi-ferroviari', 'bus-metro', 'aerei', 'traghetti', 'taxi', 'ncc', 'autostrade', 'merci', 'elicotteri'];

/** Parte di testo che segue "ESCLUSO/ESCLUSIONE…" fino al punto e virgola: descrive cosa NON sciopera. */
function codeEsclusione(testo) {
  const code = [];
  const re = /\bESCLUS(?:O|A|I|E|IONE)\b([^;]*)/g;
  let m;
  while ((m = re.exec(testo))) code.push(m[1]);
  return code;
}

// Accenti combinanti (U+0300-U+036F), costruiti con i codici per non dipendere dalla codifica del sorgente.
const DIACRITICI = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const pulisciMaiuscolo = (t) => String(t || '').toUpperCase().normalize('NFD').replace(DIACRITICI, '').replace(/\s+/g, ' ');

/**
 * Legge dal testo ufficiale quali settori sono coinvolti o esclusi.
 * Solo per scioperi "Generale" e "Plurisettoriale": per gli altri il settore è quello dichiarato.
 * Le note di solito parlano delle adesioni di altri sindacati e non si leggono; fa eccezione l'esclusione
 * richiamata da un asterisco ("INTERA GIORNATA*" nelle modalità e "*ESCLUSI SETTORI ..." nelle note).
 * @returns {{ coinvolti: string[]|null, esclusi: string[], escludeTrasporti: boolean }}
 */
export function analizzaCoinvolgimento(settoreSlug, categoria, modalita, note = '') {
  if (settoreSlug !== 'generale' && settoreSlug !== 'piu-settori') return { coinvolti: [settoreSlug], esclusi: [], escludeTrasporti: false };
  const testo = pulisciMaiuscolo(`${categoria || ''} ; ${modalita || ''}`);
  const nota = pulisciMaiuscolo(note);
  const richiamo = testo.includes('*') ? /\*\s*(ESCLUS(?:O|A|I|E|IONE)\b[^*;]*)/.exec(nota) : null;
  const esclusi = new Set();
  let escludeTrasporti = false;
  for (const coda of [...codeEsclusione(testo), ...(richiamo ? codeEsclusione(richiamo[1]) : [])]) {
    if (/\bTRASPORTI\b/.test(coda)) { escludeTrasporti = true; continue; }
    if (/\bFERROVIARI[OA]?\b/.test(coda.replace(/\bAPPALTI FERROVIARI\b/g, ' '))) esclusi.add('treni');
    if (/\bAPPALTI FERROVIARI\b/.test(coda)) esclusi.add('servizi-ferroviari');
    if (/\bMERCI\b(?! SU ROTAIA)/.test(coda)) esclusi.add('merci');
    if (/\bAERE[OA]\b/.test(coda)) esclusi.add('aerei');
    if (/\bMARITTIM[OI]\b/.test(coda)) esclusi.add('traghetti');
    if (/\bTAXI\b/.test(coda)) esclusi.add('taxi');
    if (/\bTPL\b/.test(coda) && !/\b(VARIE|ALCUNE|TALUNE)\b/.test(coda)) esclusi.add('bus-metro');
  }
  if (escludeTrasporti) return { coinvolti: [], esclusi: [...SETTORI_TRASPORTO], escludeTrasporti: true };
  const senzaEsclusioni = testo.replace(/\bESCLUS(?:O|A|I|E|IONE)\b[^;]*/g, ' ');
  const senzaAppalti = senzaEsclusioni.replace(/\bAPPALTI FERROVIARI\b/g, ' ');
  const coinvolti = PAROLE_SETTORI.filter(([s, re]) => re.test(s === 'servizi-ferroviari' ? senzaEsclusioni : senzaAppalti)).map(([s]) => s).filter((s) => !esclusi.has(s));
  return { coinvolti: coinvolti.length ? coinvolti : null, esclusi: [...esclusi], escludeTrasporti: false };
}

/**
 * Giorni toccati davvero: alcune modalità iniziano la sera prima della "Data inizio" ufficiale
 * (es. "FERROVIARIO DALLE 21.00 DEL 19/11" per uno sciopero del 20/11). Si considerano solo date entro 2 giorni da quelle ufficiali.
 */
export function giorniToccati(inizio, fine, modalita, orario) {
  let da = inizio, a = fine;
  if (orario && orario.giornoFine > a) a = orario.giornoFine;
  const anno = +inizio.slice(0, 4);
  const re = /\bDEL (\d{1,2})\/(\d{1,2})\b/g;
  let m;
  const testo = String(modalita ?? '').toUpperCase();
  while ((m = re.exec(testo))) {
    for (const y of [anno - 1, anno, anno + 1]) {
      const d = componi(y, +m[2], +m[1]);
      if (!d) continue;
      if (d < da && differenzaGiorni(d, inizio) <= 2) da = d;
      if (d > a && differenzaGiorni(fine, d) <= 2) a = d;
    }
  }
  return { da, a };
}

const PAROLE_VUOTE = new Set(('PERSONALE SOC SOCC GRUPPO DI DEL DELLA DELLE DEI DEGLI E ED AL ALLA AI AGLI IL LA LO LE GLI IN PRESSO SERVIZIO SERVIZI ' +
  'ADDETTI ADDETTO LAVORATORI DIPENDENTI DIPENDENTE IMPRESE IMPRESA AZIENDE AZIENDA CHE SVOLGONO ATTIVITA SCIOPERO GENERALE CATEGORIE CATEGORIA ' +
  'SETTORI SETTORE PUBBLICI PRIVATI PUBBLICHE PRIVATE APPALTO APPALTI NAVIGANTE MACCHINA BORDO TECNICI TECNICO MANUTENZIONE INGEGNERIA UNITA ' +
  'TERRITORIALE BACINO APT AEROPORTO AEROPORTI ACC PERS FERROVIARIO FERROVIARIA PDM PV PDB B U ANCHE CON ESCLUSIONE TUTTI TUTTE COMPARTI COMPARTO ' +
  'STRUMENTALI TEMPO DETERMINATO INDETERMINATO CONTRATTI PRECARI ATIPICI OSR OST OSP RSA RSU OO SS').split(' '));

/** Una o due parole significative (azienda) ricavate dalla categoria, per rendere leggibile l'indirizzo della pagina. */
export function parolaChiave(categoria, sindacati) {
  const prendi = (testo, quante) => String(testo ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^A-Z0-9]+/).filter((w) => w.length >= 2 && w.length <= 20 && !PAROLE_VUOTE.has(w)).slice(0, quante);
  let parole = prendi(categoria, 2);
  if (parole.length === 0) parole = prendi(sindacati, 1);
  return parole.join(' ').toLowerCase();
}

export function zonaDi(regione, provincia) {
  const r = String(regione ?? '').trim();
  const p = String(provincia ?? '').trim();
  if (p && !/^tutte$/i.test(p)) return { tipo: 'provincia', nome: p, provincia: p, regione: r };
  if (r && !/^italia$/i.test(r)) return { tipo: 'regione', nome: r, provincia: null, regione: r };
  return { tipo: 'nazionale', nome: 'Italia', provincia: null, regione: null };
}

/** Record validato -> sciopero del modello interno (senza stato e numeri di sequenza, che gestisce l'archivio). */
export function normalizza(record) {
  const settore = infoSettore(record.settore);
  const zona = zonaDi(record.regione, record.provincia);
  const orario = analizzaOrario(record.modalita, record.inizio, record.fine);
  const coinv = analizzaCoinvolgimento(settore.slug, record.categoria, record.modalita, record.note);
  const giorni = giorniToccati(record.inizio, record.fine, record.modalita, orario);
  const chiave = parolaChiave(settore.slug === 'generale' ? '' : record.categoria, record.sindacati);
  const slugBase = `${record.inizio}-${settore.slug}-${zona.tipo === 'nazionale' ? 'nazionale' : slugify(zona.nome)}${chiave ? '-' + slugify(chiave) : ''}`;
  return {
    id: record.id,
    inizio: record.inizio,
    fine: record.fine,
    giorno_da: giorni.da,
    giorno_a: giorni.a,
    settore: record.settore,
    settore_slug: settore.slug,
    rilevanza: record.rilevanza,
    regione: zona.regione ?? 'Italia',
    provincia: zona.provincia,
    zona_tipo: zona.tipo,
    zona_nome: zona.nome,
    modalita: record.modalita,
    orario,
    coinvolti: coinv.coinvolti,
    esclusi: coinv.esclusi,
    esclude_trasporti: coinv.escludeTrasporti,
    sindacati: record.sindacati,
    categoria: record.categoria,
    note: record.note,
    proclamazione: record.proclamazione,
    ricezione: record.ricezione,
    slug_base: slugBase,
  };
}
