// Generazione dei calendari iCalendar (RFC 5545): fuso Europe/Rome, UID stabili, SEQUENCE crescente,
// STATUS:CANCELLED per gli scioperi revocati, testo con escape corretto e righe ripiegate a 75 ottetti.
import { aggiungiGiorni } from './date.mjs';

export const VTIMEZONE_ROMA = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Rome',
  'X-LIC-LOCATION:Europe/Rome',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Escape per i valori di tipo TEXT (RFC 5545 §3.3.11). Elimina anche i caratteri di controllo.
 * La barra rovesciata si costruisce con il suo codice: il sorgente resta leggibile e senza ambiguità. */
const BARRA = String.fromCharCode(92);
const RE_BARRA = new RegExp(BARRA + BARRA, 'g');
const RE_CONTROLLO_ICS = new RegExp('[' + [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f]].map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
export function escapaTesto(valore) {
  return String(valore ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(RE_CONTROLLO_ICS, '')
    .replace(RE_BARRA, BARRA + BARRA)
    .replace(/;/g, BARRA + ';')
    .replace(/,/g, BARRA + ',')
    .replace(/\n/g, BARRA + 'n');
}

/** Ripiega una riga a 75 ottetti senza spezzare i caratteri UTF-8. */
export function piega(riga) {
  const byte = Buffer.from(riga, 'utf8');
  if (byte.length <= 75) return riga;
  const righe = [];
  let inizio = 0, limite = 75;
  while (inizio < byte.length) {
    let fine = Math.min(inizio + limite, byte.length);
    while (fine < byte.length && (byte[fine] & 0xc0) === 0x80) fine--;
    righe.push((inizio === 0 ? '' : ' ') + byte.subarray(inizio, fine).toString('utf8'));
    inizio = fine;
    limite = 74;
  }
  return righe.join('\r\n');
}

const dataIcs = (iso) => iso.replace(/-/g, '');
const dataOraIcs = (iso, ora) => `${dataIcs(iso)}T${ora.replace(':', '')}00`;
const istanteIcs = (istanteIso) => new Date(istanteIso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const riga = (nome, valore, parametri = '') => piega(`${nome}${parametri}:${valore}`);
/** Gli URI non sono TEXT: niente escape, ma niente caratteri che possano spezzare la riga. */
const uri = (u) => String(u).replace(/[\s\u0000-\u001F\u007F]/g, '');

/**
 * Evento VEVENT per uno sciopero.
 * @param {object} s - sciopero (id, slug, stato, sequence, modificato_il, visto_prima, inizio, fine, orario)
 * @param {object} t - testi già pronti: { titolo, chi, orari, settore, luogo, fasce, note, sindacati, url, dominio, avviso }
 */
export function evento(s, t) {
  const annullato = s.stato === 'revocato' || s.stato === 'rimosso' || (s.stato === 'differito' && s.differito_a);
  let sommario = `Sciopero: ${t.titolo}`;
  if (s.stato === 'revocato') sommario = `REVOCATO: ${t.titolo}`;
  else if (s.stato === 'rimosso') sommario = `TOLTO DAL CALENDARIO: ${t.titolo}`;
  else if (s.stato === 'differito') sommario = `RINVIATO: ${t.titolo}`;
  const d = [];
  if (t.avviso) d.push(`ATTENZIONE: ${t.avviso}`, '');
  d.push(`Cosa si ferma: ${t.chi || 'non specificato'}`);
  d.push(`Settore: ${t.settore}`);
  d.push(`Orari: ${t.orari || 'non comunicati'}`);
  if (t.fasce) d.push(`Fasce garantite: ${t.fasce}`);
  if (t.note) d.push(`Note del Ministero: ${t.note}`);
  if (t.sindacati) d.push(`Sindacati: ${t.sindacati}`);
  d.push('', `Dettagli e aggiornamenti: ${t.url}`, `Avvisa anche i colleghi: ${t.url}`, '',
    'Fonte: calendario ufficiale degli scioperi del Ministero delle Infrastrutture e dei Trasporti. Le informazioni possono cambiare: controlla il sito il giorno prima.');
  const righe = ['BEGIN:VEVENT'];
  righe.push(riga('UID', `mit-${s.id}@${t.dominio}`));
  righe.push(riga('DTSTAMP', istanteIcs(s.modificato_il)));
  righe.push(riga('SEQUENCE', String(s.sequence)));
  righe.push(riga('STATUS', annullato ? 'CANCELLED' : 'CONFIRMED'));
  if (s.orario && s.orario.tipo === 'orario') {
    righe.push(riga('DTSTART', dataOraIcs(s.inizio, s.orario.dalle), ';TZID=Europe/Rome'));
    righe.push(riga('DTEND', dataOraIcs(s.orario.giornoFine, s.orario.alle), ';TZID=Europe/Rome'));
  } else {
    righe.push(riga('DTSTART', dataIcs(s.inizio), ';VALUE=DATE'));
    righe.push(riga('DTEND', dataIcs(aggiungiGiorni(s.fine, 1)), ';VALUE=DATE'));
  }
  righe.push(riga('SUMMARY', escapaTesto(sommario)));
  righe.push(riga('DESCRIPTION', escapaTesto(d.join('\n'))));
  righe.push(riga('LOCATION', escapaTesto(t.luogo)));
  righe.push(riga('URL', uri(t.url), ';VALUE=URI'));
  righe.push(riga('CATEGORIES', escapaTesto(t.settore)));
  righe.push('TRANSP:TRANSPARENT');
  righe.push(riga('CREATED', istanteIcs(s.visto_prima)));
  righe.push(riga('LAST-MODIFIED', istanteIcs(s.modificato_il)));
  righe.push('END:VEVENT');
  return righe;
}

/** Calendario completo. eventi: array di righe VEVENT già pronte. */
export function calendario({ nome, descrizione, prodid, eventi }) {
  const righe = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    riga('PRODID', prodid),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    riga('X-WR-CALNAME', escapaTesto(nome)),
    riga('NAME', escapaTesto(nome)),
    riga('X-WR-CALDESC', escapaTesto(descrizione)),
    riga('DESCRIPTION', escapaTesto(descrizione)),
    'X-WR-TIMEZONE:Europe/Rome',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...VTIMEZONE_ROMA,
    ...eventi.flat(),
    'END:VCALENDAR',
  ];
  return righe.join('\r\n') + '\r\n';
}
