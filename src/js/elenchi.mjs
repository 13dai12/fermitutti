// Costruzione delle sezioni "Oggi", "Domani", "Prossimi giorni" (condivisa tra build e browser).
import { aggiungiGiorni, dataMedia } from './date.mjs';
import { toccaZona, toccaSettore, toccaGiorno, ordinaScioperi, perPasseggeri, contaAttivi } from './filtri.mjs';

/** Chiave di uno sciopero per chi viaggia: due scioperi con la stessa chiave si distinguono solo per i sindacati. */
function firma(s) {
  return [s.settore, s.titolo, s.inizio, s.fine, s.da, s.a, s.orario, s.modalita, s.chi, s.stato, s.differito_a, s.inizio_precedente,
    s.garantite, s.nota_anticipo, s.esclusi_testo, s.esclude_trasporti].map((v) => (v == null ? '' : String(v))).join('|');
}

/**
 * Una scheda per gruppo di scioperi identici per chi viaggia (stesso giorno, luogo, orari e personale, sindacati diversi):
 * il primo fa da rappresentante e porta con sé l'elenco completo in `gruppo`. L'ordine resta quello di partenza.
 */
export function raggruppa(lista) {
  const perFirma = new Map();
  const uscita = [];
  for (const s of lista) {
    const k = firma(s);
    const esistente = perFirma.get(k);
    if (esistente) { esistente.gruppo.push(s); continue; }
    const voce = { ...s, gruppo: [s] };
    perFirma.set(k, voce);
    uscita.push(voce);
  }
  return uscita.map((v) => (v.gruppo.length > 1 ? v : v.gruppo[0]));
}

const raggruppati = (g) => ({ principali: raggruppa(g.principali), altri: raggruppa(g.altri) });

function dividi(lista) {
  const ordinata = ordinaScioperi(lista);
  return { principali: ordinata.filter(perPasseggeri), altri: ordinata.filter((s) => !perPasseggeri(s)) };
}

/**
 * @param {Array} scioperi - oggetti compatti
 * @param {string} oggi - YYYY-MM-DD (fuso di Roma)
 * @param {object} opzioni - { zona, settori, giorniAvanti: 7 per la home, 60 per le altre pagine }
 * @returns {{ sezioni: Array, conteggi: { oggi, domani, prossimi } }}
 */
export function costruisciElenchi(scioperi, oggi, { zona = null, settori = null, giorniAvanti = 7 } = {}) {
  const pertinenti = scioperi.filter((s) => toccaZona(s, zona) && toccaSettore(s, settori));
  const domani = aggiungiGiorni(oggi, 1);
  const fine = aggiungiGiorni(oggi, giorniAvanti);
  const diOggi = dividi(pertinenti.filter((s) => toccaGiorno(s, oggi)));
  const diDomani = dividi(pertinenti.filter((s) => toccaGiorno(s, domani)));
  // Prossimi giorni: solo ciò che non è già nelle sezioni di oggi e domani, raggruppato per primo giorno.
  const giaMostrati = new Set([...diOggi.principali, ...diOggi.altri, ...diDomani.principali, ...diDomani.altri].map((s) => s.id));
  const gruppi = new Map();
  for (const s of pertinenti) {
    if (giaMostrati.has(s.id)) continue;
    let primo = null;
    if (s.da > domani && s.da <= fine) primo = s.da;
    else if (s.stato === 'differito' && s.inizio_precedente && s.inizio_precedente > domani && s.inizio_precedente <= fine) primo = s.inizio_precedente;
    if (!primo) continue;
    if (!gruppi.has(primo)) gruppi.set(primo, []);
    gruppi.get(primo).push(s);
  }
  // I conteggi restano per singolo sciopero, come nel calendario ufficiale; le schede invece raggruppano quelli identici.
  const giorniInteri = [...gruppi.keys()].sort().map((g) => ({ giorno: g, ...dividi(gruppi.get(g)) }));
  const giorniProssimi = giorniInteri.map((g) => ({ giorno: g.giorno, ...raggruppati(g) }));
  const sezioni = [
    { id: 'oggi', titolo: 'Oggi', data: dataMedia(oggi), giorni: [{ giorno: oggi, ...raggruppati(diOggi) }], vuoto: 'Nessuno sciopero in calendario per oggi.' },
    { id: 'domani', titolo: 'Domani', data: dataMedia(domani), giorni: [{ giorno: domani, ...raggruppati(diDomani) }], vuoto: 'Nessuno sciopero in calendario per domani.' },
    {
      id: 'prossimi',
      titolo: giorniAvanti <= 7 ? 'Prossimi 7 giorni' : 'Più avanti',
      data: null,
      giorni: giorniProssimi,
      vuoto: giorniAvanti <= 7 ? 'Nessun altro sciopero in calendario nei prossimi 7 giorni.' : 'Nessun altro sciopero in calendario per ora.',
    },
  ];
  const conteggi = {
    oggi: contaAttivi(diOggi.principali),
    domani: contaAttivi(diDomani.principali),
    prossimi: giorniInteri.reduce((n, g) => n + contaAttivi(g.principali), 0),
  };
  return { sezioni, conteggi };
}

/** "Nessuno sciopero" / "1 sciopero" / "3 scioperi". */
export function contaTesto(n) {
  if (n === 0) return 'nessuno sciopero';
  return n === 1 ? '1 sciopero' : `${n} scioperi`;
}
