// Arricchimento facoltativo: la pagina HTML del Ministero ha una colonna "Note" che il feed RSS non ha
// (es. "GARANTITI I VOLI DA E PER L'AEROPORTO DI BARI"). Si legge la tabella e si abbinano le righe
// agli scioperi del feed per data, settore, categoria e modalità. Se qualcosa non torna, si rinuncia: non è mai fatale.
import { pulisciTesto, blocchi } from './feed.mjs';
import { daItaliana } from './date.mjs';

const INTESTAZIONE_ATTESA = ['inizio', 'fine', 'sindacati', 'settore', 'categoria', 'modalita', 'rilevanza', 'note', 'data proclamazione', 'regione', 'provincia', 'data ricezione'];
const LIMITE_NOTE = 700;

function normalizzaChiave(s) {
  return String(s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
}

export function chiaveAbbinamento({ inizio, fine, settore, categoria, modalita }) {
  return [inizio, fine, normalizzaChiave(settore), normalizzaChiave(categoria), normalizzaChiave(modalita)].join('|');
}

/** Estrae dalla pagina HTML una mappa chiave -> nota. Restituisce null se la struttura non è quella attesa. */
export function estraiNoteDaHtml(html) {
  if (typeof html !== 'string' || html.length > 2_000_000) return null;
  // Estrazione con indexOf (blocchi): tempo lineare anche con migliaia di tag non chiusi.
  const tabelle = blocchi(html, 'table', 200);
  for (const tabella of tabelle) {
    const intestazioni = blocchi(tabella, 'th', 100).map((h) => normalizzaChiave(pulisciTesto(h)).toLowerCase().replace(/\*/g, '').trim());
    const pulite = intestazioni.filter(Boolean);
    const corrisponde = INTESTAZIONE_ATTESA.every((h) => pulite.includes(h));
    if (!corrisponde) continue;
    const idx = Object.fromEntries(INTESTAZIONE_ATTESA.map((h) => [h, intestazioni.indexOf(h)]));
    const note = new Map();
    for (const riga of blocchi(tabella, 'tr', 3000)) {
      const celle = blocchi(riga, 'td', 50).map((c) => pulisciTesto(c));
      if (celle.length < intestazioni.length) continue;
      const inizio = daItaliana(celle[idx.inizio]), fine = daItaliana(celle[idx.fine]);
      if (!inizio || !fine) continue;
      const nota = celle[idx.note];
      if (!nota || nota.length > LIMITE_NOTE || /[<>]/.test(nota)) continue;
      const chiave = chiaveAbbinamento({ inizio, fine, settore: celle[idx.settore], categoria: celle[idx.categoria], modalita: celle[idx.modalita] });
      if (!note.has(chiave)) note.set(chiave, nota);
    }
    return note;
  }
  return null;
}

/** Applica le note ai record validati (copia). */
export function applicaNote(record, note) {
  if (!note) return record;
  return record.map((r) => {
    const n = note.get(chiaveAbbinamento(r));
    return n && !r.note ? { ...r, note: n } : r;
  });
}
