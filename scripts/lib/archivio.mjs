// L'archivio è il file data/scioperi.json: tutti gli scioperi visti, con stato, numero di sequenza (per i calendari)
// e storia delle modifiche.
// Il feed del Ministero non dice mai "revocato": uno sciopero revocato semplicemente sparisce dall'elenco.
// Qui si deduce lo stato in modo prudente e lo si spiega sempre all'utente.
import { differenzaGiorni } from './date.mjs';

export const VERSIONE_ARCHIVIO = 1;
export const GIORNI_CONSERVAZIONE = 60;
// Campi ufficiali: se cambiano, è una modifica vera (va nella storia).
const CAMPI_UFFICIALI = ['inizio', 'fine', 'settore', 'rilevanza', 'regione', 'provincia', 'modalita', 'sindacati', 'categoria', 'note'];
// Campi calcolati da noi: se cambiano (es. codice migliorato) si aggiornano i calendari, senza voce nella storia.
const CAMPI_DERIVATI = ['orario', 'giorno_da', 'giorno_a', 'coinvolti', 'esclusi', 'esclude_trasporti', 'settore_slug', 'zona_tipo', 'zona_nome', 'proclamazione', 'ricezione'];

export function archivioVuoto() {
  return { versione: VERSIONE_ARCHIVIO, aggiornato_il: null, fonte: { url: null, aggiornato_al: null }, scioperi: [] };
}

function slugUnico(base, occupati) {
  if (!occupati.has(base)) return base;
  let n = 2;
  while (occupati.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function ordina(scioperi) {
  return scioperi.sort((a, b) => a.inizio.localeCompare(b.inizio) || a.settore.localeCompare(b.settore) || (+a.id - +b.id));
}

const uguali = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const impronta = (s) => [s.settore, s.regione, s.provincia ?? '', s.categoria, s.sindacati].map((x) => String(x ?? '').toUpperCase().replace(/\s+/g, ' ').trim()).join('|');

function aggiungiStoria(s, voce) {
  s.storia.push(voce);
  if (s.storia.length > 20) s.storia = s.storia.slice(-20);
}

/**
 * Unisce i nuovi record (già normalizzati) con l'archivio precedente.
 * @returns {{ archivio, diff: { aggiunti, modificati, rimossi, ripristinati, conclusi, rinviati }, urgente: boolean, cambiato: boolean }}
 */
export function unisci(precedente, nuovi, { adesso, oggi, fonte = {} }) {
  const prima = precedente?.scioperi ? structuredClone(precedente.scioperi) : [];
  const perId = new Map(prima.map((s) => [s.id, s]));
  const occupati = new Set(prima.map((s) => s.slug));
  const diff = { aggiunti: [], modificati: [], rimossi: [], ripristinati: [], conclusi: [], rinviati: [] };
  const idNuovi = new Set();
  let derivatiCambiati = 0;

  for (const n of nuovi) {
    idNuovi.add(n.id);
    const { slug_base, ...dati } = n;
    const vecchio = perId.get(n.id);
    if (!vecchio) {
      const slug = slugUnico(slug_base, occupati);
      occupati.add(slug);
      perId.set(n.id, {
        ...dati, slug, stato: 'confermato', sequence: 0,
        visto_prima: adesso, visto_ultimo: adesso, modificato_il: adesso, rimosso_il: null, storia: [],
      });
      diff.aggiunti.push(n.id);
      continue;
    }
    vecchio.visto_ultimo = adesso;
    const cambi = CAMPI_UFFICIALI.filter((k) => (vecchio[k] ?? '') !== (n[k] ?? ''));
    const derivati = CAMPI_DERIVATI.filter((k) => !uguali(vecchio[k], n[k]));
    const eraRimosso = vecchio.rimosso_il != null;
    if (cambi.length === 0 && !eraRimosso) {
      if (derivati.length) {
        for (const k of derivati) vecchio[k] = n[k];
        vecchio.sequence += 1;
        vecchio.modificato_il = adesso;
        derivatiCambiati++;
      }
      continue;
    }
    const vecchioInizio = vecchio.inizio;
    Object.assign(vecchio, dati);
    vecchio.sequence += 1;
    vecchio.modificato_il = adesso;
    if (eraRimosso) {
      vecchio.rimosso_il = null;
      vecchio.stato = 'confermato';
      aggiungiStoria(vecchio, { quando: adesso, tipo: 'ripristinato', testo: 'È ricomparso nel calendario ufficiale.' });
      diff.ripristinati.push(n.id);
    }
    if (vecchioInizio !== n.inizio) {
      vecchio.stato = 'differito';
      vecchio.inizio_precedente = vecchioInizio;
      aggiungiStoria(vecchio, { quando: adesso, tipo: 'differito', testo: `Data cambiata: dal ${vecchioInizio} al ${n.inizio}.` });
      diff.rinviati.push(n.id);
    } else if (cambi.length) {
      aggiungiStoria(vecchio, { quando: adesso, tipo: 'modificato', testo: `Aggiornati dal Ministero: ${cambi.join(', ')}.` });
    }
    if (!eraRimosso || cambi.length) diff.modificati.push(n.id);
  }

  // Scioperi presenti prima e assenti ora.
  const appenaRevocati = [];
  for (const s of perId.values()) {
    if (idNuovi.has(s.id) || s.rimosso_il != null) continue;
    if (s.giorno_a < oggi) {
      // È passato: uscita naturale dall'elenco.
      s.rimosso_il = adesso;
      diff.conclusi.push(s.id);
    } else if (s.giorno_da > oggi) {
      // Sparito prima di cominciare: di norma è una revoca (o un rinvio).
      s.stato = 'revocato';
      s.rimosso_il = adesso;
      s.sequence += 1;
      s.modificato_il = adesso;
      aggiungiStoria(s, { quando: adesso, tipo: 'revocato', testo: 'Non è più presente nel calendario ufficiale del Ministero.' });
      diff.rimossi.push(s.id);
      appenaRevocati.push(s);
    } else {
      // Sparito durante i giorni dello sciopero: revoca dell'ultimo minuto o pulizia dell'elenco; non si può sapere.
      s.stato = 'rimosso';
      s.rimosso_il = adesso;
      s.sequence += 1;
      s.modificato_il = adesso;
      aggiungiStoria(s, { quando: adesso, tipo: 'rimosso', testo: 'Tolto dal calendario ufficiale durante i giorni dello sciopero.' });
      diff.rimossi.push(s.id);
    }
  }

  // Rinvio con nuovo codice: uno sciopero sparisce e nello stesso aggiornamento ne compare uno identico (stesso settore,
  // zona, categoria e sindacati) con un'altra data. Si collega solo se l'abbinamento è unico.
  const aggiunti = diff.aggiunti.map((id) => perId.get(id));
  for (const vecchio of appenaRevocati) {
    const candidati = aggiunti.filter((n) => impronta(n) === impronta(vecchio) && n.inizio !== vecchio.inizio && !n.differito_da);
    if (candidati.length !== 1) continue;
    const nuovo = candidati[0];
    vecchio.stato = 'differito';
    vecchio.differito_a = nuovo.slug;
    vecchio.storia[vecchio.storia.length - 1] = { quando: adesso, tipo: 'differito', testo: `Il Ministero lo ha tolto e ha pubblicato uno sciopero uguale per il ${nuovo.inizio}.` };
    nuovo.differito_da = vecchio.slug;
    nuovo.inizio_precedente = vecchio.inizio;
    diff.rinviati.push(vecchio.id);
  }

  // Pulizia: via gli scioperi conclusi da troppo tempo.
  const scioperi = ordina([...perId.values()].filter((s) => differenzaGiorni(s.giorno_a ?? s.fine, oggi) <= GIORNI_CONSERVAZIONE));

  const numeroModifiche = diff.aggiunti.length + diff.modificati.length + diff.rimossi.length + diff.ripristinati.length + diff.conclusi.length;
  const cambiato = numeroModifiche + derivatiCambiati > 0 || scioperi.length !== prima.length;
  const urgente = diff.rimossi.length > 0 || diff.ripristinati.length > 0 || diff.modificati.length > 0 || diff.rinviati.length > 0;
  const archivio = {
    versione: VERSIONE_ARCHIVIO,
    aggiornato_il: cambiato ? adesso : (precedente?.aggiornato_il ?? adesso),
    fonte: { url: fonte.url ?? precedente?.fonte?.url ?? null, aggiornato_al: fonte.aggiornato_al ?? precedente?.fonte?.aggiornato_al ?? null },
    scioperi,
  };
  return { archivio, diff, urgente, cambiato };
}

/** Numero di scioperi dell'archivio che il feed dovrebbe ancora contenere (non passati e non già spariti). */
export function attesiNelFeed(archivio, oggi) {
  if (!archivio?.scioperi) return 0;
  return archivio.scioperi.filter((s) => s.rimosso_il == null && (s.giorno_a ?? s.fine) >= oggi).length;
}

/** Stato da mostrare oggi: uno sciopero finito risulta "concluso" anche se il Ministero non l'ha ancora tolto. */
export function statoMostrato(s, oggi) {
  if (s.stato === 'confermato' && (s.giorno_a ?? s.fine) < oggi) return 'concluso';
  return s.stato;
}
