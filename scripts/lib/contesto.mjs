// Contesto comune alla build e alla prova di costruzione: oggetti compatti, testi dei calendari e delle anteprime.
import { compatto, titoloScheda, leggibile, orarioTesto, luogoTesto } from './presenta.mjs';
import { elencoSettori, infoSettore } from './normalizza.mjs';
import { REGIONI, CITTA } from './luoghi.mjs';
import { fasceInUnaRiga } from './fasce.mjs';
import { dataLunga, dataMedia } from './date.mjs';
import { STATI } from '../../src/js/schede.mjs';

export function creaContesto({ archivio, stato = {}, oggi, sito, aff, versione }) {
  const perSlug = new Map(archivio.scioperi.map((s) => [s.slug, s]));
  const compatti = archivio.scioperi.map((s) => compatto(s, perSlug));
  const compattiPerId = new Map(compatti.map((c) => [c.id, c]));
  return { sito, versione, oggi, stato, aff, archivio, scioperi: archivio.scioperi, compatti, compattiPerId, perSlug, REGIONI, CITTA, settori: elencoSettori() };
}

/** Testi di un evento del calendario. */
export function testiEvento(ctx, s) {
  const { sito } = ctx;
  const c = ctx.compattiPerId.get(s.id);
  const nuovo = s.differito_a ? ctx.perSlug.get(s.differito_a) : null;
  let avviso = null;
  if (s.stato === 'revocato') avviso = STATI.revocato.spiegazione;
  else if (s.stato === 'rimosso') avviso = STATI.rimosso.spiegazione;
  else if (nuovo) avviso = `sciopero rinviato a ${dataLunga(nuovo.inizio)}: ${sito.urlBase}/sciopero/${nuovo.slug}/`;
  else if (s.stato === 'differito' && s.inizio_precedente) avviso = `sciopero rinviato: prima era previsto per ${dataLunga(s.inizio_precedente)}.`;
  if (s.esclude_trasporti) avviso = 'secondo il Ministero questo sciopero generale esclude il settore dei trasporti.';
  if (c.nota_anticipo && !avviso) avviso = c.nota_anticipo.replace(/^Attenzione: /, '');
  return {
    titolo: titoloScheda(s), chi: leggibile(s.categoria), orari: orarioTesto(s) || leggibile(s.modalita), settore: infoSettore(s.settore).nome,
    luogo: luogoTesto(s), fasce: fasceInUnaRiga(s), note: s.note ? leggibile(s.note) : null, sindacati: s.sindacati,
    url: `${sito.urlBase}/sciopero/${s.slug}/`, dominio: sito.dominio, avviso,
  };
}

/** Parametri dell'immagine di anteprima di uno sciopero. */
export function datiAnteprima(ctx, s) {
  const c = ctx.compattiPerId.get(s.id);
  const st = c.stato === 'confermato' && c.a < ctx.oggi ? 'concluso' : c.stato;
  const quando = s.inizio === s.fine ? dataLunga(s.inizio) : `${dataMedia(s.inizio)} - ${dataLunga(s.fine)}`;
  return { stato: st, titolo: c.titolo, data: quando[0].toUpperCase() + quando.slice(1), dettaglio: [c.orario, c.chi].filter(Boolean).join(' · '), sito: ctx.sito };
}
