// Controllo dell'archivio prima di salvarlo (aggiornamento) e prima di pubblicarlo (build).
// Difesa in profondità: i dati li produce il nostro script, ma un dato strano non deve mai bloccare il sito.
import { isoValida } from './date.mjs';

const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RE_ORA = /^\d\d:\d\d$/;
const STATI_VALIDI = ['confermato', 'revocato', 'differito', 'rimosso'];
const ZONE_VALIDE = ['nazionale', 'regione', 'provincia'];
const SETTORI_VALIDI = ['aerei', 'treni', 'servizi-ferroviari', 'bus-metro', 'traghetti', 'merci', 'taxi', 'ncc', 'elicotteri', 'autostrade', 'generale', 'piu-settori', 'altro'];

const dataFacoltativa = (v) => v == null || isoValida(v);
const elencoSettori = (v) => Array.isArray(v) && v.every((x) => SETTORI_VALIDI.includes(x));

export function validaArchivio(archivio) {
  const errori = [];
  if (!archivio || !Array.isArray(archivio.scioperi)) throw new Error('data/scioperi.json: manca l\'elenco "scioperi"');
  const slug = new Set(), id = new Set();
  for (const s of archivio.scioperi) {
    const dove = `sciopero ${/^\d{1,9}$/.test(String(s?.id)) ? s.id : '(codice non valido)'}`;
    if (!s || typeof s !== 'object') { errori.push('voce non valida'); continue; }
    if (!/^\d{1,9}$/.test(String(s.id))) errori.push(`${dove}: id non valido`);
    if (id.has(s.id)) errori.push(`${dove}: id duplicato`);
    id.add(s.id);
    if (typeof s.slug !== 'string' || !RE_SLUG.test(s.slug) || s.slug.length > 120) errori.push(`${dove}: slug non valido`);
    else if (slug.has(s.slug)) errori.push(`${dove}: slug duplicato`);
    slug.add(s.slug);
    for (const k of ['inizio', 'fine', 'giorno_da', 'giorno_a']) if (!isoValida(s[k])) errori.push(`${dove}: ${k} non valida`);
    for (const k of ['proclamazione', 'ricezione', 'inizio_precedente']) if (!dataFacoltativa(s[k])) errori.push(`${dove}: ${k} non valida`);
    if (!STATI_VALIDI.includes(s.stato)) errori.push(`${dove}: stato non valido`);
    if (!Number.isInteger(s.sequence) || s.sequence < 0) errori.push(`${dove}: sequence non valida`);
    if (!SETTORI_VALIDI.includes(s.settore_slug)) errori.push(`${dove}: settore non valido`);
    if (!ZONE_VALIDE.includes(s.zona_tipo)) errori.push(`${dove}: zona non valida`);
    for (const k of ['settore', 'rilevanza', 'regione', 'modalita', 'sindacati', 'categoria', 'note', 'zona_nome']) {
      if (typeof s[k] !== 'string' || s[k].length > 800 || /[<>]/.test(s[k])) errori.push(`${dove}: campo ${k} non valido`);
    }
    if (s.provincia != null && (typeof s.provincia !== 'string' || s.provincia.length > 80 || /[<>]/.test(s.provincia))) errori.push(`${dove}: campo provincia non valido`);
    if (s.coinvolti != null && !elencoSettori(s.coinvolti)) errori.push(`${dove}: settori coinvolti non validi`);
    if (!elencoSettori(s.esclusi || [])) errori.push(`${dove}: settori esclusi non validi`);
    if (s.orario != null) {
      const o = s.orario;
      const okTipo = o.tipo === 'giornata' || (o.tipo === 'orario' && RE_ORA.test(o.dalle) && RE_ORA.test(o.alle));
      if (!okTipo || !isoValida(o.giornoFine)) errori.push(`${dove}: orario non valido`);
    }
    for (const k of ['differito_a', 'differito_da']) if (s[k] != null && (typeof s[k] !== 'string' || !RE_SLUG.test(s[k]))) errori.push(`${dove}: ${k} non valido`);
    for (const k of ['visto_prima', 'modificato_il']) if (Number.isNaN(Date.parse(s[k]))) errori.push(`${dove}: ${k} non valido`);
    if (!Array.isArray(s.storia)) errori.push(`${dove}: storia non valida`);
  }
  if (errori.length) throw new Error(`data/scioperi.json non valido:\n- ${errori.slice(0, 20).join('\n- ')}`);
  return true;
}
