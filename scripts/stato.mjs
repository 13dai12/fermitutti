#!/usr/bin/env node
// Come sta l'aggiornamento automatico? Risponde in parole semplici e non modifica niente.
// Uso, dalla cartella del progetto sul computer in Italia:  npm run stato
// Legge il timer di systemd, il registro dell'ultimo giro, i dati nella copia usata dal timer (~/.local/share/fermitutti)
// e l'ora dell'ultimo controllo che il sito mostra ai visitatori.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sito from '../config/sito.mjs';

const PROGETTO = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.env.FERMITUTTI_BASE || join(homedir(), '.local', 'share', 'fermitutti');
const UNITA = 'fermitutti-aggiorna';
// Codice di uscita di scripts/aggiorna-italia.sh quando manca la connessione a internet.
const SENZA_RETE = 75;
// Oltre quest'ora senza un controllo riuscito qualcosa non va: il timer controlla ogni 30 minuti.
const ORE_RITARDO = 1.5;

/** Esegue un comando e restituisce l'output, oppure null se il comando manca o fallisce. */
function esegui(comando, argomenti) {
  try {
    return execFileSync(comando, argomenti, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim();
  } catch {
    return null;
  }
}

/** Le righe «CHIAVE=valore» di systemctl show e loginctl show-user. */
function proprieta(testo) {
  const p = {};
  for (const riga of String(testo || '').split('\n')) {
    const i = riga.indexOf('=');
    if (i > 0) p[riga.slice(0, i)] = riga.slice(i + 1);
  }
  return p;
}

/** Data da «@1795203466» (systemctl --timestamp=unix); null se manca. */
function daUnix(valore) {
  const m = /^@(\d+)$/.exec(valore || '');
  return m && m[1] !== '0' ? new Date(Number(m[1]) * 1000) : null;
}

function daIso(valore) {
  const d = valore ? new Date(valore) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const ADESSO = new Date();
const giorno = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });
const ora = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const dataEOra = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** «oggi alle 16:38», «ieri alle 23:07», «domani alle 00:07» oppure la data completa. */
function quando(data) {
  const g = giorno.format(data);
  if (g === giorno.format(ADESSO)) return `oggi alle ${ora.format(data)}`;
  if (g === giorno.format(new Date(ADESSO.getTime() - 86400000))) return `ieri alle ${ora.format(data)}`;
  if (g === giorno.format(new Date(ADESSO.getTime() + 86400000))) return `domani alle ${ora.format(data)}`;
  return dataEOra.format(data);
}

/** «4 ore e 37 minuti fa». */
function quantoFa(data) {
  const minuti = Math.max(0, Math.round((ADESSO - data) / 60000));
  const plurale = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
  if (minuti < 60) return minuti < 1 ? 'meno di un minuto fa' : `${plurale(minuti, 'minuto', 'minuti')} fa`;
  const ore = Math.floor(minuti / 60);
  if (ore >= 48) return `${plurale(Math.floor(ore / 24), 'giorno', 'giorni')} fa`;
  const resto = minuti % 60;
  return `${plurale(ore, 'ora', 'ore')}${resto ? ` e ${plurale(resto, 'minuto', 'minuti')}` : ''} fa`;
}

const righe = [];
const problemi = [];
const bene = (testo) => righe.push(`✔ ${testo}`);
const male = (testo, cosaFare) => { righe.push(`✘ ${testo}`); if (cosaFare) problemi.push(cosaFare); };
const info = (testo) => righe.push(`  ${testo}`);

// 1. Il timer di systemd
const timer = proprieta(esegui('systemctl', ['--user', 'show', `${UNITA}.timer`, '--timestamp=unix', '-p', 'LoadState,ActiveState,UnitFileState,NextElapseUSecRealtime']));
let timerAttivo = false;
if (!timer.LoadState) {
  male('Non riesco a leggere i timer di systemd su questo computer.', 'Questo comando va usato sul computer Linux in Italia che aggiorna i dati.');
} else if (timer.LoadState !== 'loaded') {
  male('L\'aggiornamento automatico non è installato su questo computer.', 'Per installarlo: sh scripts/installa-aggiornamento-italia.sh');
} else if (timer.ActiveState !== 'active' || timer.UnitFileState !== 'enabled') {
  male('Il timer è spento: i dati non si aggiornano.', 'Per riaccenderlo: systemctl --user enable --now fermitutti-aggiorna.timer');
} else {
  timerAttivo = true;
  const prossimo = daUnix(timer.NextElapseUSecRealtime);
  bene(`Timer acceso${prossimo ? `: il prossimo controllo è ${quando(prossimo)}` : ''}.`);
}

// 2. Avvio anche senza nessuno collegato (linger)
if (timerAttivo) {
  const linger = proprieta(esegui('loginctl', ['show-user', userInfo().username, '-p', 'Linger'])).Linger;
  if (linger === 'yes') bene('Gira anche quando nessuno è collegato al computer.');
  else if (linger === 'no') male('Il timer gira solo mentre sei collegato al computer.', 'Perché giri sempre, anche dopo un riavvio senza accesso: loginctl enable-linger');
}

// 3. L'ultimo giro: esito e messaggi dal registro
const servizio = proprieta(esegui('systemctl', ['--user', 'show', `${UNITA}.service`, '--timestamp=unix', '-p', 'ActiveState,Result,ExecMainStatus,ExecMainExitTimestamp,InvocationID']));
let ultimoGiroSenzaRete = false;
if (servizio.ActiveState === 'activating') {
  info('Un controllo è in corso proprio adesso.');
} else if (servizio.ActiveState) {
  const fine = daUnix(servizio.ExecMainExitTimestamp);
  const messaggi = [];
  if (servizio.InvocationID) {
    const registro = esegui('journalctl', ['--user-unit', `${UNITA}.service`, '-n', '300', '--no-pager', '-o', 'json']) || '';
    for (const riga of registro.split('\n')) {
      try {
        const voce = JSON.parse(riga);
        if (voce._SYSTEMD_INVOCATION_ID === servizio.InvocationID && voce.SYSLOG_IDENTIFIER !== 'systemd' && typeof voce.MESSAGE === 'string') messaggi.push(voce.MESSAGE);
      } catch { /* riga non JSON: si salta */ }
    }
  }
  const utili = messaggi.filter((m) => !m.startsWith('RISULTATO '));
  const quandoFine = fine ? `, ${quando(fine)}` : '';
  if (!fine) {
    info('Il timer non ha ancora fatto nessun giro dall\'ultima accensione del computer.');
  } else if (servizio.Result === 'success') {
    const esito = utili.filter((m) => /^(Pubblicato|Niente da pubblicare|Nessun file cambiato)/.test(m)).pop();
    bene(`Ultimo giro riuscito${quandoFine}${esito ? `: ${esito.replace(/[.]$/, '').toLowerCase()}` : ''}.`);
  } else if (Number(servizio.ExecMainStatus) === SENZA_RETE) {
    ultimoGiroSenzaRete = true;
    male(`Ultimo giro${quandoFine}: il computer era senza internet. Non ha toccato niente.`,
      'Controlla la connessione del computer. Quando internet torna, il timer riparte da solo al giro successivo.');
  } else {
    male(`Ultimo giro${quandoFine}: non riuscito (codice ${servizio.ExecMainStatus || '?'}).`,
      'Leggi il registro completo con: journalctl --user-unit fermitutti-aggiorna -n 40');
    for (const m of utili.slice(-4)) info(`│ ${m.slice(0, 160)}`);
  }
}

// 4. I dati nella copia usata dal timer
const stato = (() => {
  try { return JSON.parse(readFileSync(join(BASE, 'repo', 'data', 'stato.json'), 'utf8')); } catch { return null; }
})();
if (stato) {
  const riuscita = daIso(stato.ultima_verifica_riuscita);
  if (!riuscita) {
    male('Non risulta nessun controllo riuscito del calendario del Ministero.');
  } else if ((ADESSO - riuscita) / 3600000 > ORE_RITARDO) {
    male(`Ultimo controllo riuscito del Ministero: ${quando(riuscita)} (${quantoFa(riuscita)}).`,
      ultimoGiroSenzaRete ? null : 'I controlli si sono fermati: guarda le righe qui sopra per capire perché.');
  } else {
    bene(`Ultimo controllo riuscito del Ministero: ${quando(riuscita)} (${quantoFa(riuscita)}).`);
  }
  const guasta = daIso(stato.fonte_guasta_dal);
  if (guasta) {
    male(`La fonte del Ministero risulta guasta da ${quando(guasta)}: ${String(stato.ultimo_errore?.messaggio || 'motivo sconosciuto').slice(0, 160)}.`,
      'Se il Ministero non risponde non serve fare niente: il sito mostra un avviso e i dati tornano da soli quando la fonte funziona di nuovo.');
  } else if (riuscita) {
    bene(`La fonte del Ministero funziona${Number.isInteger(stato.scioperi_nel_feed) ? ` (${stato.scioperi_nel_feed} scioperi nel calendario ufficiale)` : ''}.`);
  }
  const pubblicazione = daIso(stato.ultima_pubblicazione);
  if (pubblicazione) info(`Ultima ripubblicazione del sito: ${quando(pubblicazione)}. Il sito si ripubblica quando i dati cambiano, a mezzanotte e almeno ogni 6 ore.`);
} else if (timerAttivo) {
  male(`Non trovo i dati del timer in ${join(BASE, 'repo')}.`, 'Rilancia l\'installazione: sh scripts/installa-aggiornamento-italia.sh');
}

// 5. Cosa vedono i visitatori del sito
try {
  const risposta = await fetch(`${sito.urlBase}/api/stato`, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'FermiTutti-stato/1.0' } });
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
  const pubblico = await risposta.json();
  const sulSito = daIso(pubblico.ultima_verifica_riuscita);
  if (sulSito) {
    const locale = daIso(stato?.ultima_verifica_riuscita);
    const indietro = locale && (locale - sulSito) / 3600000 > ORE_RITARDO;
    // L'ora nuova passa da GitHub e dalle copie in cache di Cloudflare: ai visitatori arriva qualche minuto dopo il controllo.
    const appenaFatto = locale && (ADESSO - locale) / 60000 < 10;
    if (indietro && appenaFatto) info(`Il sito mostra ancora il controllo di ${quando(sulSito)}: quello di ${quando(locale)} arriva ai visitatori entro qualche minuto.`);
    else if (indietro) male(`Il sito mostra ai visitatori un controllo più vecchio di quello fatto qui: ${quando(sulSito)}.`, 'Se succede di nuovo al prossimo giro, leggi il registro: journalctl --user-unit fermitutti-aggiorna -n 40');
    else bene(`Il sito ${sito.dominio} mostra ai visitatori il controllo di ${quando(sulSito)}.`);
  }
} catch (e) {
  male(`Non riesco a raggiungere ${sito.dominio} da questo computer (${e.name === 'TimeoutError' ? 'nessuna risposta in 10 secondi' : e.message}).`,
    'Se anche altri siti non si aprono, il problema è la connessione di questo computer, non il sito.');
}

// 6. Il timer usa il codice attuale del progetto? Si confrontano i file, non i commit: i dati cambiano ogni giorno.
const versione = (() => { try { return readFileSync(join(BASE, 'codice', 'VERSIONE'), 'utf8').trim(); } catch { return null; } })();
if (versione && existsSync(join(PROGETTO, '.git'))) {
  const confronto = spawnSync('git', ['-C', PROGETTO, 'diff', '--quiet', versione, 'HEAD', '--', '.', ':(exclude)data/scioperi.json', ':(exclude)data/stato.json'], { stdio: 'ignore' });
  if (confronto.status === 0) bene(`Il timer usa il codice attuale del progetto (versione ${versione}).`);
  else if (confronto.status === 1) male(`Il timer usa ancora il codice della versione ${versione}, ma nel progetto il codice è cambiato.`, 'Dopo una modifica al codice, rilancia: sh scripts/installa-aggiornamento-italia.sh');
}

console.log(`Fermi Tutti: stato dell'aggiornamento automatico (${dataEOra.format(ADESSO)})\n`);
console.log(righe.join('\n'));
console.log(problemi.length ? `\nCosa fare:\n${[...new Set(problemi)].map((p) => `- ${p}`).join('\n')}` : '\nTutto a posto: non serve fare niente.');
