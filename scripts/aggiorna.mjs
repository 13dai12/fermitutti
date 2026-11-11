#!/usr/bin/env node
// Scarica il calendario ufficiale degli scioperi, lo valida e aggiorna data/scioperi.json e data/stato.json.
// Non usa dipendenze esterne: solo Node.js. Così il lavoro con permessi di scrittura non esegue codice di terzi.
//
// Uso:  node scripts/aggiorna.mjs [--forza]
//   --forza        pubblica anche se nulla è cambiato
// Variabili d'ambiente (facoltative):
//   FONTE_URL      indirizzo del feed RSS (predefinito: quello ufficiale del Ministero)
//   FONTE_HTML_URL indirizzo della pagina HTML con la colonna Note (vuoto = salta l'arricchimento)
//   DATA_DIR       cartella dei dati (predefinita: ./data)
//   TIMEOUT_MS     timeout per ogni richiesta (predefinito 20000)
//   TENTATIVI      tentativi per il feed (predefinito 4)
//   ATTESA_MS      attesa base tra i tentativi (predefinita 30000)
//   ACCETTA_CALO   "1" per accettare un calo improvviso del numero di scioperi (dopo averlo controllato a mano)
//
// Codici di uscita: 0 = tutto bene (dati cambiati o no), 3 = fonte guasta o dati anomali: i dati NON sono stati toccati.
// Il risultato viene anche scritto in $GITHUB_OUTPUT (esito, pubblica, motivo, riassunto) per il workflow.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analizzaFeed, ErroreFeed } from './lib/feed.mjs';
import { validaElementi } from './lib/valida.mjs';
import { normalizza } from './lib/normalizza.mjs';
import { unisci, archivioVuoto, attesiNelFeed } from './lib/archivio.mjs';
import { estraiNoteDaHtml, applicaNote } from './lib/arricchisci.mjs';
import { oggiRoma } from './lib/date.mjs';

export const FONTE_URL_UFFICIALE = 'https://scioperi.mit.gov.it/mit2/public/scioperi/rss';
export const FONTE_HTML_UFFICIALE = 'https://scioperi.mit.gov.it/mit2/public/scioperi';
// Ogni quante ore pubblicare comunque (così il sito mostra che il controllo è vivo).
export const ORE_BATTITO = 6;
const DIMENSIONE_MASSIMA = 5_000_000;
const UA = 'FermiTutti/1.0 (sito statico di avvisi sugli scioperi; aggiornamento automatico)';

class ErroreDati extends Error {
  constructor(errori, avvisi) { super(errori.join('; ')); this.name = 'ErroreDati'; this.errori = errori; this.avvisi = avvisi; }
}

/** Un reindirizzamento è ammesso solo verso lo stesso host (e in https, salvo i test in locale). */
function reindirizzamentoAmmesso(destinazione, origine) {
  const d = new URL(destinazione), o = new URL(origine);
  if (o.hostname === '127.0.0.1' || o.hostname === 'localhost') return d.hostname === o.hostname && d.protocol === o.protocol;
  return d.protocol === 'https:' && d.hostname === o.hostname;
}

export async function scarica(url, { timeoutMs = 20000, accept = '*/*' } = {}) {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), timeoutMs);
  try {
    let indirizzo = url;
    let risposta;
    // I reindirizzamenti si seguono a mano (al massimo 3) per non finire mai su un altro sito.
    for (let salti = 0; ; salti++) {
      risposta = await fetch(indirizzo, { signal: controllo.signal, redirect: 'manual', headers: { 'user-agent': UA, accept } });
      if (risposta.status < 300 || risposta.status > 399) break;
      const dove = risposta.headers.get('location');
      if (!dove || salti >= 3) throw new Error(`troppi reindirizzamenti o reindirizzamento senza destinazione (HTTP ${risposta.status})`);
      const prossimo = new URL(dove, indirizzo).href;
      if (!reindirizzamentoAmmesso(prossimo, url)) throw new Error('reindirizzamento verso un altro sito: ignorato');
      indirizzo = prossimo;
    }
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
    const dichiarata = Number(risposta.headers.get('content-length') || 0);
    if (dichiarata > DIMENSIONE_MASSIMA) throw new Error(`risposta troppo grande (${dichiarata} byte)`);
    // Lettura a pezzi, interrotta se supera il limite (anche senza content-length).
    const pezzi = [];
    let totale = 0;
    for await (const pezzo of risposta.body) {
      totale += pezzo.length;
      if (totale > DIMENSIONE_MASSIMA) { controllo.abort(); throw new Error(`risposta troppo grande (oltre ${DIMENSIONE_MASSIMA} byte)`); }
      pezzi.push(pezzo);
    }
    return { testo: Buffer.concat(pezzi).toString('utf8'), tipo: risposta.headers.get('content-type') || '' };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`nessuna risposta entro ${timeoutMs / 1000} secondi`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function conTentativi(fn, tentativi, attesaMs, log) {
  let ultimo;
  for (let i = 1; i <= tentativi; i++) {
    try { return await fn(); } catch (e) {
      ultimo = e;
      log(`tentativo ${i} di ${tentativi} fallito: ${e.message}`);
      if (i < tentativi) await new Promise((r) => setTimeout(r, attesaMs * i));
    }
  }
  throw ultimo;
}

function leggiJson(percorso, predefinito) {
  if (!existsSync(percorso)) return predefinito;
  return JSON.parse(readFileSync(percorso, 'utf8'));
}

function scriviJson(percorso, dati) {
  writeFileSync(percorso, JSON.stringify(dati, null, 1) + '\n');
}

/** Testo sicuro per gli output del workflow: una riga, niente caratteri speciali, lunghezza limitata. */
function perOutput(v) {
  return String(v).replace(/[\r\n]+/g, ' ').replace(/[^\p{L}\p{N} .,;:()'"/%+=_-]/gu, '').slice(0, 900);
}

function emettiOutput(valori) {
  const righe = Object.entries(valori).map(([k, v]) => `${k}=${perOutput(v)}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, righe.join('\n') + '\n');
  console.log('RISULTATO ' + righe.join(' | '));
}

/** Decide se pubblicare e perché. */
export function decidiPubblicazione({ cambiato, eraGuasta, guasta, forza, statoPrecedente, adesso }) {
  const ultima = statoPrecedente.ultima_pubblicazione ? new Date(statoPrecedente.ultima_pubblicazione) : null;
  const giornoCambiato = !ultima || oggiRoma(ultima) !== oggiRoma(adesso);
  const battito = !ultima || (adesso - ultima) / 3600000 >= ORE_BATTITO;
  if (guasta) {
    if (!eraGuasta) return { pubblica: true, motivo: 'fonte guasta' };
    if (giornoCambiato) return { pubblica: true, motivo: 'nuovo giorno' };
    if (battito) return { pubblica: true, motivo: 'controllo periodico' };
    return { pubblica: false, motivo: 'fonte ancora guasta' };
  }
  if (cambiato) return { pubblica: true, motivo: 'dati cambiati' };
  if (eraGuasta) return { pubblica: true, motivo: 'fonte di nuovo funzionante' };
  if (forza) return { pubblica: true, motivo: 'richiesta manuale' };
  if (giornoCambiato) return { pubblica: true, motivo: 'nuovo giorno' };
  if (battito) return { pubblica: true, motivo: 'controllo periodico' };
  return { pubblica: false, motivo: 'nessuna novità' };
}

export async function aggiorna({ fonteUrl, fonteHtmlUrl, dataDir, forza = false, accettaCalo = false, timeoutMs = 20000, tentativi = 4, attesaMs = 30000, adesso = new Date(), log = console.error } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const fileArchivio = join(dataDir, 'scioperi.json');
  const fileStato = join(dataDir, 'stato.json');
  const precedente = leggiJson(fileArchivio, archivioVuoto());
  const statoPrecedente = leggiJson(fileStato, {});
  const istante = adesso.toISOString();
  const oggi = oggiRoma(adesso);
  const eraGuasta = statoPrecedente.fonte_guasta_dal != null;

  try {
    const { testo } = await conTentativi(() => scarica(fonteUrl, { timeoutMs, accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1' }), tentativi, attesaMs, log);
    const feed = analizzaFeed(testo);
    const attesi = attesiNelFeed(precedente, oggi);
    const esito = validaElementi(feed.elementi, { oggi, attesiMinimi: attesi, accettaCalo });
    if (!esito.ok) throw new ErroreDati(esito.errori, esito.avvisi);
    let record = esito.record;
    const avvisi = [...esito.avvisi];
    const impronta = createHash('sha256').update(testo).digest('hex').slice(0, 16);
    // Le note stanno solo nella pagina HTML (più pesante): la si scarica solo quando il feed è cambiato.
    // Altrimenti, o se la pagina non risponde, si tengono le note già note per gli stessi scioperi.
    const notePrecedenti = new Map((precedente.scioperi || []).filter((s) => s.note).map((s) => [s.id, s.note]));
    let noteApplicate = false;
    if (fonteHtmlUrl && (impronta !== statoPrecedente.impronta_feed || forza)) {
      try {
        const pagina = await scarica(fonteHtmlUrl, { timeoutMs, accept: 'text/html' });
        const note = estraiNoteDaHtml(pagina.testo);
        if (note) { record = applicaNote(record, note); noteApplicate = true; } else avvisi.push('pagina HTML del Ministero non riconosciuta: note non aggiornate');
      } catch (e) {
        avvisi.push(`note non aggiornate: ${e.message}`);
      }
    }
    if (!noteApplicate) record = record.map((r) => (!r.note && notePrecedenti.has(r.id) ? { ...r, note: notePrecedenti.get(r.id) } : r));

    const nuovi = record.map(normalizza);
    const { archivio, diff, urgente, cambiato } = unisci(precedente, nuovi, {
      adesso: istante, oggi, fonte: { url: fonteUrl, aggiornato_al: feed.canale.aggiornatoAl },
    });
    const decisione = decidiPubblicazione({ cambiato, eraGuasta, guasta: false, forza, statoPrecedente, adesso });
    const stato = {
      ultima_verifica_riuscita: istante,
      ultimo_tentativo: istante,
      ultima_modifica_dati: cambiato ? istante : (statoPrecedente.ultima_modifica_dati ?? istante),
      ultima_pubblicazione: decisione.pubblica ? istante : (statoPrecedente.ultima_pubblicazione ?? null),
      fonte_guasta_dal: null,
      ultimo_errore: statoPrecedente.ultimo_errore ? { ...statoPrecedente.ultimo_errore, risolto_il: statoPrecedente.ultimo_errore.risolto_il ?? istante } : null,
      fonte_aggiornata_al: feed.canale.aggiornatoAl,
      impronta_feed: impronta,
      scioperi_in_archivio: archivio.scioperi.length,
      scioperi_nel_feed: nuovi.length,
      avvisi: avvisi.slice(0, 30),
    };
    if (cambiato) scriviJson(fileArchivio, archivio);
    scriviJson(fileStato, stato);
    const riassunto = `feed: ${nuovi.length} scioperi; nuovi ${diff.aggiunti.length}, modificati ${diff.modificati.length}, revocati o tolti ${diff.rimossi.length}, rinviati ${diff.rinviati.length}, ripristinati ${diff.ripristinati.length}, conclusi ${diff.conclusi.length}${avvisi.length ? `; avvisi: ${avvisi.length}` : ''}${eraGuasta ? '; la fonte funziona di nuovo' : ''}`;
    for (const a of avvisi) log(`avviso: ${a}`);
    log(riassunto);
    emettiOutput({ esito: 'ok', pubblica: decisione.pubblica, motivo: decisione.motivo, dati_cambiati: cambiato, urgente, fonte_ripristinata: eraGuasta, riassunto });
    return { ok: true, ...decisione, cambiato, urgente, diff, avvisi, archivio, stato };
  } catch (e) {
    const messaggio = e instanceof ErroreDati ? `dati anomali: ${e.message}` : (e instanceof ErroreFeed ? `feed non valido: ${e.message}` : `fonte non raggiungibile: ${e.message}`);
    const decisione = decidiPubblicazione({ cambiato: false, eraGuasta, guasta: true, forza, statoPrecedente, adesso });
    const stato = {
      ...statoPrecedente,
      ultimo_tentativo: istante,
      ultima_pubblicazione: decisione.pubblica ? istante : (statoPrecedente.ultima_pubblicazione ?? null),
      fonte_guasta_dal: statoPrecedente.fonte_guasta_dal ?? istante,
      ultimo_errore: { quando: istante, messaggio: messaggio.slice(0, 500) },
    };
    scriviJson(fileStato, stato);
    log(`ERRORE: ${messaggio}`);
    log('I dati degli scioperi restano quelli dell\'ultima verifica riuscita.');
    emettiOutput({ esito: 'guasta', pubblica: decisione.pubblica, motivo: decisione.motivo, dati_cambiati: false, urgente: false, prima_segnalazione: !eraGuasta, riassunto: messaggio });
    return { ok: false, ...decisione, messaggio, stato };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const usaFonteDiProva = Boolean(process.env.FONTE_URL);
  const fonteHtml = process.env.FONTE_HTML_URL !== undefined ? process.env.FONTE_HTML_URL : (usaFonteDiProva ? '' : FONTE_HTML_UFFICIALE);
  const r = await aggiorna({
    fonteUrl: process.env.FONTE_URL || FONTE_URL_UFFICIALE,
    fonteHtmlUrl: fonteHtml,
    dataDir: process.env.DATA_DIR || new URL('../data', import.meta.url).pathname,
    forza: process.argv.includes('--forza'),
    accettaCalo: process.env.ACCETTA_CALO === '1',
    timeoutMs: Number(process.env.TIMEOUT_MS || 20000),
    tentativi: Number(process.env.TENTATIVI || 4),
    attesaMs: Number(process.env.ATTESA_MS || 30000),
  });
  process.exit(r.ok ? 0 : 3);
}
