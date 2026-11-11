// Modello delle schede degli scioperi, condiviso tra la build (HTML statico) e il browser (DOM).
// Riceve oggetti "compatti" (vedi scripts/lib/presenta.mjs) con i testi già pronti.
import { differenzaGiorni, dataMedia, dataBreve, NOMI_GIORNI, giornoSettimana } from './date.mjs';

export const STATI = {
  confermato: { testo: 'Confermato', classe: 'confermato', spiegazione: 'È nel calendario ufficiale del Ministero e non risulta revocato.' },
  differito: { testo: 'Rinviato', classe: 'differito', spiegazione: 'La data è cambiata rispetto a quella annunciata.' },
  revocato: { testo: 'Revocato', classe: 'revocato', spiegazione: 'Non è più nel calendario ufficiale del Ministero: di solito vuol dire che è stato revocato. Verifica con la tua azienda di trasporto.' },
  rimosso: { testo: 'Tolto dal calendario', classe: 'rimosso', spiegazione: 'Il Ministero lo ha tolto dal calendario durante i giorni dello sciopero: può essere una revoca dell\'ultimo minuto. Verifica con la tua azienda di trasporto.' },
  concluso: { testo: 'Concluso', classe: 'concluso', spiegazione: 'Lo sciopero è terminato.' },
};

export function statoMostrato(s, oggi) {
  if ((s.stato === 'confermato' || (s.stato === 'differito' && !s.differito_a)) && s.a < oggi) return 'concluso';
  return s.stato;
}

/** "oggi", "domani", "dopodomani" oppure null. */
export function relativo(giorno, oggi) {
  const d = differenzaGiorni(oggi, giorno);
  if (d === 0) return 'oggi';
  if (d === 1) return 'domani';
  if (d === 2) return 'dopodomani';
  if (d === -1) return 'ieri';
  return null;
}

function maiuscola(t) { return t ? t[0].toUpperCase() + t.slice(1) : t; }

/** "Oggi, mercoledì 11 novembre" / "Venerdì 20 novembre" / "Da venerdì 20 a sabato 21 novembre". */
export function quandoTesto(s, oggi) {
  if (s.inizio === s.fine) {
    const r = relativo(s.inizio, oggi);
    return r ? `${maiuscola(r)}, ${dataMedia(s.inizio)}` : maiuscola(dataMedia(s.inizio));
  }
  const ri = relativo(s.inizio, oggi);
  const stessoMese = s.inizio.slice(0, 7) === s.fine.slice(0, 7);
  const primo = stessoMese ? `${NOMI_GIORNI[giornoSettimana(s.inizio)]} ${+s.inizio.slice(8)}` : dataMedia(s.inizio);
  return `${ri ? maiuscola(ri) + ', d' : 'D'}a ${primo} a ${dataMedia(s.fine)}`;
}

/**
 * Modello di una scheda: { id, classe, url, titolo, quando, orario (breve) o modalita (testo lungo), chi, etichette: [{testo, classe}], note: [testo], link: {testo, url}|null }
 */
export function schedaModello(s, oggi, { giorno = null } = {}) {
  const stato = statoMostrato(s, oggi);
  const info = STATI[stato] || STATI.confermato;
  const etichette = [{ testo: info.testo, classe: `pill-stato ${info.classe}` }];
  const note = [];
  let link = null;
  if (s.esclude_trasporti) etichette.push({ testo: 'Non riguarda i trasporti', classe: 'pill-info' });
  else if (s.settore === 'merci') etichette.push({ testo: 'Merci: di norma non ferma i passeggeri', classe: 'pill-info' });
  else if (s.settore === 'servizi-ferroviari') etichette.push({ testo: 'Servizi in appalto: i treni di solito circolano', classe: 'pill-info' });
  if (stato === 'differito' && s.inizio_precedente && giorno === s.inizio_precedente && s.inizio !== s.inizio_precedente) {
    note.push(`Rinviato a ${dataMedia(s.inizio)}.`);
  } else if (stato === 'differito' && s.differito_a_data) {
    note.push(`Rinviato a ${dataMedia(s.differito_a_data)}.`);
    link = { testo: 'Vai al nuovo sciopero', url: `/sciopero/${s.differito_a}/` };
  } else if (s.inizio_precedente && s.inizio_precedente !== s.inizio) {
    note.push(`Prima era previsto per ${dataBreve(s.inizio_precedente)}.`);
  }
  if (stato === 'revocato' || stato === 'rimosso') note.push(info.spiegazione);
  if (s.nota_anticipo) note.push(s.nota_anticipo);
  if (s.esclusi_testo && !s.esclude_trasporti) note.push(s.esclusi_testo);
  return {
    id: s.id,
    classe: `scheda stato-${info.classe}`,
    url: `/sciopero/${s.slug}/`,
    titolo: s.titolo,
    quando: quandoTesto(s, oggi),
    orario: s.orario || null,
    modalita: s.orario ? null : (s.modalita || null),
    chi: s.chi,
    sindacati: s.sindacati || null,
    garantite: stato === 'revocato' || stato === 'rimosso' || stato === 'concluso' ? null : (s.garantite || null),
    etichette,
    note,
    link,
  };
}
