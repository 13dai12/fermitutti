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
//   ACCETTA_VARIAZIONE "1" per accettare un calo o un aumento improvviso del numero di scioperi (dopo un controllo a mano)
//
// Codici di uscita: 0 = tutto bene (dati cambiati o no), 3 = fonte guasta o dati anomali: i dati NON sono stati toccati.
// Il risultato viene anche scritto in $GITHUB_OUTPUT (esito, pubblica, motivo, riassunto) per il workflow.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analizzaFeed, ErroreFeed } from './lib/feed.mjs';
import { validaElementi } from './lib/valida.mjs';
import { normalizza } from './lib/normalizza.mjs';
import { unisci, archivioVuoto, attesiNelFeed } from './lib/archivio.mjs';
import { estraiNoteDaHtml, applicaNote } from './lib/arricchisci.mjs';
import { oggiRoma } from './lib/date.mjs';
import { provaCostruzione } from './lib/prova-costruzione.mjs';

export const FONTE_URL_UFFICIALE = 'https://scioperi.mit.gov.it/mit2/public/scioperi/rss';
export const FONTE_HTML_UFFICIALE = 'https://scioperi.mit.gov.it/mit2/public/scioperi';
// Ogni quante ore pubblicare comunque (così il sito mostra che il controllo è vivo).
export const ORE_BATTITO = 6;
// Limiti di dimensione: il feed reale pesa circa 25 KB, la pagina HTML circa 315 KB.
const LIMITE_FEED = 1_000_000;
const LIMITE_PAGINA = 2_000_000;
// Difese contro una fonte che "inonda" il sito: in un aggiornamento normale arrivano pochi scioperi nuovi,
// e con 60 giorni di conservazione l'archivio resta sotto i 300.
export const MASSIMO_NUOVI = 100;
export const MASSIMO_ARCHIVIO = 1500;
const UA = 'FermiTutti/1.0 (sito statico di avvisi sugli scioperi; aggiornamento automatico)';

class ErroreDati extends Error {
  constructor(errori, avvisi = []) { super(errori.join('; ')); this.name = 'ErroreDati'; this.errori = errori; this.avvisi = avvisi; }
}

/**
 * Toglie indirizzi web ed email dai messaggi: possono contenere testo della fonte e finiscono nelle segnalazioni
 * via email e nei registri pubblici (un link ingannevole lì sembrerebbe arrivare dal tuo repository).
 */
export function senzaIndirizzi(testo) {
  return String(testo ?? '')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, '[indirizzo tolto]')
    .replace(/\bwww\.\S+/gi, '[indirizzo tolto]')
    .replace(/\S+@\S+\.\S+/g, '[indirizzo tolto]');
}

/** Un reindirizzamento è ammesso solo verso lo stesso host (e in https, salvo i test in locale). */
function reindirizzamentoAmmesso(destinazione, origine) {
  const d = new URL(destinazione), o = new URL(origine);
  if (o.hostname === '127.0.0.1' || o.hostname === 'localhost') return d.hostname === o.hostname && d.protocol === o.protocol;
  return d.protocol === 'https:' && d.hostname === o.hostname;
}

export async function scarica(url, { timeoutMs = 20000, accept = '*/*', limite = LIMITE_FEED } = {}) {
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
    if (dichiarata > limite) throw new Error(`risposta troppo grande (${dichiarata} byte)`);
    // Lettura a pezzi, interrotta se supera il limite (anche senza content-length).
    const pezzi = [];
    let totale = 0;
    for await (const pezzo of risposta.body) {
      totale += pezzo.length;
      if (totale > limite) { controllo.abort(); throw new Error(`risposta troppo grande (oltre ${limite} byte)`); }
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
  return senzaIndirizzi(String(v)).replace(/[\r\n]+/g, ' ').replace(/[^\p{L}\p{N} .,;:()'"/%+=_\[\]-]/gu, '').slice(0, 900);
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

export async function aggiorna({ fonteUrl, fonteHtmlUrl, dataDir, forza = false, accettaVariazione = false, timeoutMs = 20000, tentativi = 4, attesaMs = 30000, adesso = new Date(), log = console.error } = {}) {
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
    const esito = validaElementi(feed.elementi, { oggi, attesiMinimi: attesi, accettaVariazione });
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
        const pagina = await scarica(fonteHtmlUrl, { timeoutMs, accept: 'text/html', limite: LIMITE_PAGINA });
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
    if (!accettaVariazione && diff.aggiunti.length > MASSIMO_NUOVI) throw new ErroreDati([`troppi scioperi nuovi in un solo aggiornamento: ${diff.aggiunti.length}`]);
    if (archivio.scioperi.length > MASSIMO_ARCHIVIO) throw new ErroreDati([`archivio troppo grande: ${archivio.scioperi.length} scioperi`]);
    // Prima di salvare: i dati nuovi devono poter diventare pagine, calendari e anteprime. Se no, non si salva nulla.
    try {
      provaCostruzione(archivio, { oggi });
    } catch (e) {
      throw new ErroreDati([`i dati nuovi non si possono pubblicare (${e.message.split('\n').slice(0, 3).join('; ')})`]);
    }
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
      avvisi: avvisi.slice(0, 30).map(senzaIndirizzi),
    };
    if (cambiato) scriviJson(fileArchivio, archivio);
    scriviJson(fileStato, stato);
    const riassunto = `feed: ${nuovi.length} scioperi; nuovi ${diff.aggiunti.length}, modificati ${diff.modificati.length}, revocati o tolti ${diff.rimossi.length}, rinviati ${diff.rinviati.length}, ripristinati ${diff.ripristinati.length}, conclusi ${diff.conclusi.length}${avvisi.length ? `; avvisi: ${avvisi.length}` : ''}${eraGuasta ? '; la fonte funziona di nuovo' : ''}`;
    for (const a of avvisi) log(`avviso: ${senzaIndirizzi(a)}`);
    log(riassunto);
    emettiOutput({ esito: 'ok', pubblica: decisione.pubblica, motivo: decisione.motivo, dati_cambiati: cambiato, urgente, fonte_ripristinata: eraGuasta, riassunto });
    return { ok: true, ...decisione, cambiato, urgente, diff, avvisi, archivio, stato };
  } catch (e) {
    const causa = e?.cause?.code ? ` (${String(e.cause.code).replace(/[^A-Z0-9_]/gi, '').slice(0, 40)})` : '';
    const messaggio = senzaIndirizzi(e instanceof ErroreDati ? `dati anomali: ${e.message}` : (e instanceof ErroreFeed ? `feed non valido: ${e.message}` : `fonte non raggiungibile: ${e.message}${causa}`));
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

/** Ore senza una verifica riuscita dopo le quali la sorveglianza considera fermo l'aggiornamento: più delle 6 del battito. */
export const ORE_SORVEGLIANZA = 9;

/**
 * Sorveglianza da GitHub, senza scaricare niente. Il server del Ministero accetta solo connessioni dall'Italia (verificato
 * l'11 novembre 2026), quindi l'aggiornamento vero gira su un computer in Italia (scripts/aggiorna-italia.sh), che pubblica
 * data/stato.json. Qui si legge quello stato. Se è recente e la fonte funziona non si tocca nulla. Se il computer in Italia
 * vede la fonte guasta si avvisa il proprietario. Se da troppe ore non arriva una verifica riuscita si segna la fonte
 * come guasta: il sito mostra l'avviso ai visitatori e il proprietario riceve una segnalazione.
 */
export function sorveglia({ dataDir, adesso = new Date(), oreMassime = ORE_SORVEGLIANZA, log = console.error } = {}) {
  const fileStato = join(dataDir, 'stato.json');
  const statoPrecedente = leggiJson(fileStato, {});
  const istante = adesso.toISOString();
  const eraGuasta = statoPrecedente.fonte_guasta_dal != null;
  const ultima = statoPrecedente.ultima_verifica_riuscita ? new Date(statoPrecedente.ultima_verifica_riuscita) : null;
  const ore = ultima ? (adesso - ultima) / 3600000 : Infinity;
  if (ore <= oreMassime) {
    if (eraGuasta) {
      const messaggio = statoPrecedente.ultimo_errore?.messaggio ?? 'fonte guasta';
      log(`Il computer in Italia vede la fonte guasta: ${messaggio}`);
      emettiOutput({ esito: 'guasta', pubblica: false, motivo: 'fonte guasta vista dal computer in Italia', dati_cambiati: false, urgente: false, prima_segnalazione: false, riassunto: messaggio });
      return { ok: false, pubblica: false, motivo: 'fonte guasta vista dal computer in Italia' };
    }
    const riassunto = `ultima verifica riuscita ${Math.floor(ore * 10) / 10} ore fa`;
    log(`Aggiornamento regolare: ${riassunto}.`);
    emettiOutput({ esito: 'ok', pubblica: false, motivo: 'aggiornamento regolare', dati_cambiati: false, urgente: false, fonte_ripristinata: true, riassunto });
    return { ok: true, pubblica: false, motivo: 'aggiornamento regolare' };
  }
  const quando = Number.isFinite(ore) ? `l'ultima verifica riuscita della fonte è di ${Math.floor(ore)} ore fa` : 'non risulta nessuna verifica riuscita della fonte';
  const messaggio = `${quando}: il computer in Italia che aggiorna i dati è spento o bloccato, oppure il calendario del Ministero non risponde`;
  const decisione = decidiPubblicazione({ cambiato: false, eraGuasta, guasta: true, forza: false, statoPrecedente, adesso });
  const stato = {
    ...statoPrecedente,
    ultima_pubblicazione: decisione.pubblica ? istante : (statoPrecedente.ultima_pubblicazione ?? null),
    fonte_guasta_dal: statoPrecedente.fonte_guasta_dal ?? istante,
    ultimo_errore: { quando: istante, messaggio },
  };
  scriviJson(fileStato, stato);
  log(`ERRORE: ${messaggio}`);
  emettiOutput({ esito: 'guasta', pubblica: decisione.pubblica, motivo: decisione.motivo, dati_cambiati: false, urgente: false, prima_segnalazione: !eraGuasta, riassunto: messaggio });
  return { ok: false, ...decisione, messaggio, stato };
}

// Avviato come programma: si confrontano i percorsi reali, così funziona anche passando da un collegamento simbolico.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const dataDir = process.env.DATA_DIR || new URL('../data', import.meta.url).pathname;
  // ADESSO serve solo alle prove: fissa l'ora di riferimento.
  const adesso = process.env.ADESSO ? new Date(process.env.ADESSO) : new Date();
  if (Number.isNaN(adesso.getTime())) throw new Error('ADESSO non è una data valida');
  if (process.argv.includes('--sorveglia')) {
    const s = sorveglia({ dataDir, adesso });
    process.exit(s.ok ? 0 : 3);
  }
  const usaFonteDiProva = Boolean(process.env.FONTE_URL);
  const fonteHtml = process.env.FONTE_HTML_URL !== undefined ? process.env.FONTE_HTML_URL : (usaFonteDiProva ? '' : FONTE_HTML_UFFICIALE);
  const r = await aggiorna({
    fonteUrl: process.env.FONTE_URL || FONTE_URL_UFFICIALE,
    fonteHtmlUrl: fonteHtml,
    dataDir,
    adesso,
    forza: process.argv.includes('--forza'),
    accettaVariazione: process.env.ACCETTA_VARIAZIONE === '1',
    timeoutMs: Number(process.env.TIMEOUT_MS || 20000),
    tentativi: Number(process.env.TENTATIVI || 4),
    attesaMs: Number(process.env.ATTESA_MS || 30000),
  });
  process.exit(r.ok ? 0 : 3);
}
