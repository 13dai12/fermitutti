// Dati di prova costruiti con la pipeline vera: feed reale salvato il 10/11/2026 più scioperi inventati
// per provare revoca (9001) e rinvio con nuovo codice (9002 -> 9003).
import { readFileSync } from 'node:fs';
import { analizzaFeed } from '../scripts/lib/feed.mjs';
import { validaElementi } from '../scripts/lib/valida.mjs';
import { normalizza } from '../scripts/lib/normalizza.mjs';
import { unisci, archivioVuoto } from '../scripts/lib/archivio.mjs';
import { compatto } from '../scripts/lib/presenta.mjs';

export const FEED_REALE = readFileSync(new URL('./fixtures/feed-reale.xml', import.meta.url), 'utf8');

export function itemFinto({ id, inizio, fine = inizio, settore, rilevanza, regione, provincia, modalita, sindacati, categoria }) {
  return `<item>
  <title>Data inizio: ${inizio} - Settore: ${settore} - Rilevanza: ${rilevanza} - Regione: ${regione} - Provincia: ${provincia}</title>
  <description><![CDATA[modalità: ${modalita}<br/>Data fine: ${fine}<br/>Settore: ${settore}<br/>Rilevanza: ${rilevanza}<br/>Regione: ${regione}<br/>Provincia: ${provincia}<br/>Sindacati: ${sindacati}<br/>Categoria interessata: ${categoria}<br/>Data proclamazione: 01/11/2026<br/>Data ricezione: 01/11/2026]]></description>
  <pubDate>Mon, 09 Nov 2026 23:00:00 +0000</pubDate>
  <link>http://scioperi.mit.gov.it</link>
  <guid>http://scioperi.mit.gov.it/${id}</guid>
</item>`;
}

export const FINTI = {
  9001: itemFinto({ id: 9001, inizio: '18/11/2026', settore: 'Ferroviario', rilevanza: 'Regionale', regione: 'Lombardia', provincia: 'Tutte', modalita: '8 ORE: DALLE 09.00 ALLE 17.00', sindacati: 'OSR PROVA', categoria: 'PERSONALE SOC. TRENORD' }),
  9002: itemFinto({ id: 9002, inizio: '19/11/2026', settore: 'Trasporto pubblico locale', rilevanza: 'Locale', regione: 'Lazio', provincia: 'Roma', modalita: '4 ORE: DALLE 08.30 ALLE 12.30', sindacati: 'OSR PROVA ROMA', categoria: 'PERSONALE SOC. ATAC DI ROMA' }),
  9003: itemFinto({ id: 9003, inizio: '26/11/2026', settore: 'Trasporto pubblico locale', rilevanza: 'Locale', regione: 'Lazio', provincia: 'Roma', modalita: '4 ORE: DALLE 08.30 ALLE 12.30', sindacati: 'OSR PROVA ROMA', categoria: 'PERSONALE SOC. ATAC DI ROMA' }),
};

export function feedCon(...extra) {
  return FEED_REALE.replace('</channel>', `${extra.join('\n')}\n</channel>`);
}

export function elabora(xml, precedente, adesso) {
  const oggi = adesso.slice(0, 10);
  const f = analizzaFeed(xml);
  const v = validaElementi(f.elementi, { oggi });
  if (!v.ok) throw new Error(v.errori.join('; '));
  return unisci(precedente, v.record.map(normalizza), { adesso, oggi, fonte: { url: 'prova', aggiornato_al: f.canale.aggiornatoAl } });
}

let cache = null;
/** Archivio dopo due aggiornamenti: il 10/11 sera e l'11/11 mattina. */
export function archivioDiProva() {
  if (cache) return structuredClone(cache);
  const primo = elabora(feedCon(FINTI[9001], FINTI[9002]), archivioVuoto(), '2026-11-10T22:00:00.000Z');
  const secondo = elabora(feedCon(FINTI[9003]), primo.archivio, '2026-11-11T07:00:00.000Z');
  cache = secondo.archivio;
  return structuredClone(cache);
}

export function compattiDiProva() {
  const a = archivioDiProva();
  const perSlug = new Map(a.scioperi.map((s) => [s.slug, s]));
  return a.scioperi.map((s) => compatto(s, perSlug));
}

export function baseDiProva() {
  const leggi = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
  const luoghi = leggi('../data/luoghi.json');
  const settori = Object.entries(leggi('../data/settori.json')).filter(([k]) => !k.startsWith('_')).map(([, s]) => ({ slug: s.slug, nome: s.nome, breve: s.breve }));
  const fasce = leggi('../data/fasce_garanzia.json').fasce.filter((v) => v.mostra !== false).map((v) => ({
    tipo: v.tipo, citta: v.citta || null, regione: v.regione || (v.ambito !== 'nazionale' ? v.ambito : null), azienda: v.azienda,
    fasce: v.fasce, citazione: v.fasce_testo, fonte: v.fonte_url, avvisi: v.pagina_scioperi_url, origine: v.origine, avviso_del: v.avviso_del, verificato_il: v.verificato_il, nota: v.note || null,
  }));
  return { luoghi: { regioni: luoghi.regioni, citta: luoghi.citta }, settori, assistente: leggi('../data/assistente.json'), fasce };
}
