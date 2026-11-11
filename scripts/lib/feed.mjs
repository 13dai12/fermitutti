// Lettura del feed RSS ufficiale del Ministero (scioperi.mit.gov.it/mit2/public/scioperi/rss).
// Il feed è semplice: un <item> per sciopero, con i dati nel titolo e nella descrizione
// (righe "Chiave: valore" separate da <br/>).
// Tutto ciò che arriva è considerato NON fidato: il testo viene ripulito da tag, entità e caratteri invisibili,
// e ogni campo che conteneva markup inatteso viene segnalato, così la validazione può rifiutare l'aggiornamento.

export class ErroreFeed extends Error {
  constructor(codice, messaggio) {
    super(messaggio);
    this.name = 'ErroreFeed';
    this.codice = codice;
  }
}

const ENTITA = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù', deg: '°', euro: '€',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '-', mdash: '-',
};

/** Decodifica le entità XML/HTML più comuni e quelle numeriche. */
export function decodificaEntita(testo) {
  return testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (intero, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
      return String.fromCodePoint(n);
    }
    const k = e.toLowerCase();
    return k in ENTITA ? ENTITA[k] : intero;
  });
}

// Caratteri di controllo, separatori di riga Unicode, caratteri invisibili e di direzione del testo
// (usati negli attacchi "bidi"). Costruiti con codici numerici per non dipendere dalla codifica del sorgente.
const INVISIBILI = [
  [0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x9f], [0xad, 0xad],
  [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f], [0xfdd0, 0xfdef], [0xfeff, 0xfeff], [0xfff9, 0xfffb],
  [0xfffe, 0xffff],
];
const RE_INVISIBILI = new RegExp('[' + INVISIBILI.map(([a, b]) => {
  const h = (n) => '\\u' + n.toString(16).padStart(4, '0');
  return a === b ? h(a) : h(a) + '-' + h(b);
}).join('') + ']', 'g');

/** Toglie i tag, decodifica le entità, elimina i caratteri invisibili e normalizza gli spazi.
 * La forma /<[^<>]*>/ ha tempo lineare anche con migliaia di '<' non chiusi. */
export function pulisciTesto(testo) {
  let t = String(testo ?? '').replace(/<[^<>]*>/g, ' ');
  t = decodificaEntita(t);
  // Seconda passata: entità che nascondevano tag (es. &lt;script&gt;).
  t = t.replace(/<[^<>]*>/g, ' ');
  t = t.normalize('NFC').replace(RE_INVISIBILI, '');
  return t.replace(/\s+/g, ' ').trim();
}

/** Vero se il testo (prima della pulizia) contiene markup o schemi che il Ministero non usa mai nei valori. */
export function contieneMarkup(grezzo) {
  const decodificato = decodificaEntita(String(grezzo ?? ''));
  return /[<>]/.test(decodificato) || /javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i.test(decodificato);
}

/**
 * Contenuti dei blocchi <tag ...>…</tag> (non annidati), cercati con indexOf: tempo lineare anche con input ostili.
 * Si ferma al primo blocco senza chiusura.
 */
export function blocchi(testo, tag, massimo = Infinity) {
  const basso = testo.toLowerCase();
  const apre = `<${tag}`, chiude = `</${tag}>`;
  const risultati = [];
  let da = 0;
  while (risultati.length < massimo) {
    let i = basso.indexOf(apre, da);
    // Deve essere proprio quel tag (non <items o <itemx): dopo il nome serve '>' o uno spazio.
    while (i >= 0 && !/[\s>]/.test(basso[i + apre.length] || '')) i = basso.indexOf(apre, i + 1);
    if (i < 0) break;
    const fineApertura = basso.indexOf('>', i);
    if (fineApertura < 0) break;
    const j = basso.indexOf(chiude, fineApertura + 1);
    if (j < 0) break;
    risultati.push(testo.slice(fineApertura + 1, j));
    da = j + chiude.length;
  }
  return risultati;
}

function estrai(blocco, tag) {
  const [v] = blocchi(blocco, tag, 1);
  if (v === undefined) return null;
  const t = v.trim();
  if (t.startsWith('<![CDATA[') && t.endsWith(']]>')) return t.slice(9, -3);
  return v;
}

const MAPPA_CHIAVI = {
  'modalita': 'modalita', 'data inizio': 'inizio', 'data fine': 'fine', 'settore': 'settore', 'rilevanza': 'rilevanza',
  'regione': 'regione', 'provincia': 'provincia', 'sindacati': 'sindacati', 'categoria interessata': 'categoria',
  'data proclamazione': 'proclamazione', 'data ricezione': 'ricezione', 'note': 'note',
};

function chiaveCampo(s) {
  const k = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  return MAPPA_CHIAVI[k] || null;
}

// Il feed reale pesa circa 25 KB: un megabyte è un limite largo ma che tiene bassi i tempi nei casi ostili.
export const DIMENSIONE_MASSIMA = 1_000_000;
const LUNGHEZZA_MASSIMA_TITOLO = 400;

/**
 * Analizza il testo XML del feed e restituisce { canale, elementi }.
 * Ogni elemento ha: guid, titolo, pubDate, campi (chiavi normalizzate: inizio, fine, settore, ...) e
 * sospetti (nomi dei campi che contenevano markup o schemi pericolosi).
 * Lancia ErroreFeed se la risposta non sembra il feed atteso.
 */
export function analizzaFeed(testoXml) {
  if (typeof testoXml !== 'string') throw new ErroreFeed('non-testo', 'la risposta non è testo');
  if (testoXml.length > DIMENSIONE_MASSIMA) throw new ErroreFeed('troppo-grande', `risposta troppo grande (${testoXml.length} caratteri)`);
  if (!/<rss[\s>]/i.test(testoXml.slice(0, 4000)) || !/<channel[\s>]/i.test(testoXml)) {
    throw new ErroreFeed('non-rss', 'la risposta non è un feed RSS');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(testoXml)) throw new ErroreFeed('dtd', 'il feed contiene dichiarazioni DOCTYPE o ENTITY non attese');
  const blocchiItem = blocchi(testoXml, 'item', 5000);
  const primoItem = testoXml.toLowerCase().search(/<item[\s>]/);
  const bloccoCanale = primoItem >= 0 ? testoXml.slice(0, primoItem) : testoXml;
  const canale = {
    titolo: pulisciTesto(estrai(bloccoCanale, 'title') || ''),
    descrizione: pulisciTesto(estrai(bloccoCanale, 'description') || ''),
    aggiornatoAl: null,
  };
  const ma = /aggiornat[oa] alla data:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(canale.descrizione);
  if (ma) canale.aggiornatoAl = ma[1];

  const elementi = blocchiItem.map((b) => {
    const sospetti = [];
    const titoloGrezzo = estrai(b, 'title') || '';
    // Nel titolo XML il Ministero non usa CDATA né tag: qualunque markup decodificato è sospetto.
    if (contieneMarkup(titoloGrezzo)) sospetti.push('titolo');
    const titolo = pulisciTesto(titoloGrezzo);
    const guid = pulisciTesto(estrai(b, 'guid') || '');
    const pubDate = pulisciTesto(estrai(b, 'pubDate') || '');
    const campi = {};
    // La regex del titolo si usa solo su titoli di lunghezza normale (quelli veri sono sotto i 200 caratteri).
    if (titolo.length > LUNGHEZZA_MASSIMA_TITOLO) sospetti.push('titolo');
    const t = titolo.length > LUNGHEZZA_MASSIMA_TITOLO ? null : /^Data inizio:\s*(.*?)\s*-\s*Settore:\s*(.*?)\s*-\s*Rilevanza:\s*(.*?)\s*-\s*Regione:\s*(.*?)\s*-\s*Provincia:\s*(.*)$/i.exec(titolo);
    if (t) {
      campi.inizio = t[1].trim(); campi.settore = t[2].trim(); campi.rilevanza = t[3].trim();
      campi.regione = t[4].trim(); campi.provincia = t[5].trim();
    }
    const descrizione = estrai(b, 'description') || '';
    for (const riga of descrizione.split(/<br\s{0,5}\/?>/i)) {
      const r = pulisciTesto(riga);
      if (!r) continue;
      const i = r.indexOf(':');
      if (i < 0) continue;
      const chiave = chiaveCampo(r.slice(0, i));
      if (!chiave) continue;
      if (contieneMarkup(riga)) sospetti.push(chiave);
      const valore = r.slice(i + 1).trim();
      if (!(chiave in campi)) campi[chiave] = valore;
    }
    return { guid, titolo, pubDate, campi, sospetti };
  });
  return { canale, elementi };
}
