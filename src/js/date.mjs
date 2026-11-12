// Utilità per le date, usate sia dagli script (Node) sia dal browser.
// Tutte le date degli scioperi sono "giorni" (YYYY-MM-DD) nel fuso Europe/Rome.
export const FUSO = 'Europe/Rome';

const fmtGiorno = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtParti = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Giorno di oggi nel fuso di Roma, come YYYY-MM-DD. */
export function oggiRoma(adesso = new Date()) {
  return fmtGiorno.format(adesso);
}

/** Ora locale di Roma per un istante, come { anno, mese, giorno, ore, minuti, secondi }. */
export function partiRoma(istante) {
  const p = {};
  for (const { type, value } of fmtParti.formatToParts(istante)) p[type] = value;
  return { anno: +p.year, mese: +p.month, giorno: +p.day, ore: +p.hour, minuti: +p.minute, secondi: +p.second };
}

/** Scostamento di Roma rispetto a UTC, in minuti, per un istante. */
export function scostamentoRoma(istante) {
  const p = partiRoma(istante);
  const comeUtc = Date.UTC(p.anno, p.mese - 1, p.giorno, p.ore, p.minuti, p.secondi);
  return Math.round((comeUtc - istante.getTime()) / 60000);
}

/** Istante UTC corrispondente all'ora locale di Roma indicata. */
export function istanteRoma(iso, ore = 0, minuti = 0) {
  const m = RE_ISO.exec(iso);
  if (!m) throw new Error(`data non valida: ${iso}`);
  const localeComeUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], ore, minuti);
  // Prima stima con lo scostamento di quell'istante, poi una seconda passata per i giorni di cambio dell'ora.
  let t = localeComeUtc - scostamentoRoma(new Date(localeComeUtc)) * 60000;
  t = localeComeUtc - scostamentoRoma(new Date(t)) * 60000;
  return new Date(t);
}

/** Converte "10/11/2026" in "2026-11-10". Restituisce null se non è una data reale. */
export function daItaliana(testo) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(testo || '');
  if (!m) return null;
  const g = +m[1], me = +m[2], a = +m[3];
  if (me < 1 || me > 12 || g < 1 || g > 31) return null;
  // Anni fuori da questo intervallo sono di sicuro errori di battitura (e romperebbero le date ISO a 4 cifre).
  if (a < 2000 || a > 2100) return null;
  const d = new Date(Date.UTC(a, me - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== me - 1 || d.getUTCDate() !== g) return null;
  return `${a}-${String(me).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

export function isoValida(iso) {
  const m = RE_ISO.exec(iso || '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Aggiunge n giorni a una data YYYY-MM-DD. */
export function aggiungiGiorni(iso, n) {
  const m = RE_ISO.exec(iso);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

/** Differenza in giorni (b - a). */
export function differenzaGiorni(a, b) {
  const ma = RE_ISO.exec(a), mb = RE_ISO.exec(b);
  return Math.round((Date.UTC(+mb[1], +mb[2] - 1, +mb[3]) - Date.UTC(+ma[1], +ma[2] - 1, +ma[3])) / 86400000);
}

/** Giorno della settimana: 0 = domenica ... 6 = sabato. */
export function giornoSettimana(iso) {
  const m = RE_ISO.exec(iso);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

const fmtLunga = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMedia = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fmtBreve = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long' });
const fmtDataOra = new Intl.DateTimeFormat('it-IT', { timeZone: FUSO, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function aDate(iso) {
  const m = RE_ISO.exec(iso);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
/** "martedì 10 novembre 2026" */
export function dataLunga(iso) { return fmtLunga.format(aDate(iso)); }
/** "martedì 10 novembre" */
export function dataMedia(iso) { return fmtMedia.format(aDate(iso)); }
/** "10 novembre" */
export function dataBreve(iso) { return fmtBreve.format(aDate(iso)); }
/** "10 novembre 2026, 23:14" (ora di Roma) per un istante ISO. */
export function dataOraRoma(istanteIso) { return fmtDataOra.format(new Date(istanteIso)); }

/** Lunedì della settimana che contiene il giorno indicato. */
export function lunediDi(iso) {
  const g = giornoSettimana(iso);
  return aggiungiGiorni(iso, g === 0 ? -6 : 1 - g);
}

/** Ultimo giorno del mese. */
export function fineMese(iso) {
  const m = RE_ISO.exec(iso);
  return new Date(Date.UTC(+m[1], +m[2], 0)).toISOString().slice(0, 10);
}

/** Costruisce YYYY-MM-DD da numeri; null se la data non esiste. */
export function componi(anno, mese, giorno) {
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  return d.toISOString().slice(0, 10);
}

export const NOMI_GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Domenica di Pasqua (algoritmo di Meeus/Jones/Butcher). */
export function pasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return componi(anno, mese, giorno);
}

/** Domeniche e festività nazionali italiane (il sabato è feriale per i servizi di trasporto). */
export function festivo(iso) {
  if (giornoSettimana(iso) === 0) return true;
  const md = iso.slice(5);
  if (['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].includes(md)) return true;
  return iso === aggiungiGiorni(pasqua(+iso.slice(0, 4)), 1);
}
