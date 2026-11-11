#!/usr/bin/env node
// Apre il sito generato in un browser senza finestra (Chromium), a 360 px e a dimensione desktop, salva le schermate
// e controlla errori in console, violazioni della Content-Security-Policy e richieste fallite.
// Uso: node scripts/screenshot.mjs [cartella-schermate]   (CARTELLA=... per provare un sito generato altrove)
// Serve Chromium installato: imposta CHROME_PATH se non è in un percorso standard.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { avviaServer } from './servi.mjs';

const puppeteer = (await import('puppeteer-core')).default;
const uscita = process.argv[2] || 'schermate';
mkdirSync(uscita, { recursive: true });
const percorsiChrome = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/sbin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = percorsiChrome.find((p) => existsSync(p));
if (!chrome) { console.error('Chromium non trovato: imposta CHROME_PATH.'); process.exit(2); }

const porta = 8000 + Math.floor(Math.random() * 900);
const server = await avviaServer({ porta, cartella: process.env.CARTELLA || 'public' });
const base = `http://127.0.0.1:${porta}`;
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const problemi = [];

const pagine = (process.env.PAGINE || '/,/sciopero/__PRIMO__/,/citta/napoli/,/assistente/,/calendario/,/widget/milano/,/come-funziona/,/stato/').split(',');
const elenco = await (await fetch(`${base}/dati/scioperi.json`)).json();
const primo = elenco.scioperi.find((s) => s.settore === 'aerei') || elenco.scioperi[0];
const viste = [
  { nome: 'telefono', larghezza: 360, altezza: 780, mobile: true },
  { nome: 'desktop', larghezza: 1280, altezza: 900, mobile: false },
];

async function apri(percorso, vista, { tema = 'light', azione = null, suffisso = '' } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: vista.larghezza, height: vista.altezza, deviceScaleFactor: 1, isMobile: vista.mobile, hasTouch: vista.mobile });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: tema }]);
  await p.evaluateOnNewDocument(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`VIOLAZIONE-CSP ${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`));
  });
  const registro = [];
  p.on('console', (m) => { if (['error', 'warning', 'warn'].includes(m.type())) registro.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => registro.push(`pageerror: ${e.message}`));
  p.on('requestfailed', (r) => registro.push(`richiesta fallita: ${r.url()} ${r.failure()?.errorText}`));
  p.on('response', (r) => { if (r.status() >= 400) registro.push(`HTTP ${r.status()}: ${r.url()}`); });
  const url = `${base}${percorso.replace('__PRIMO__', primo.slug)}`;
  await p.goto(url, { waitUntil: 'networkidle0' });
  if (azione) await azione(p);
  await new Promise((r) => setTimeout(r, 300));
  const larghezzaContenuto = await p.evaluate(() => document.documentElement.scrollWidth);
  if (larghezzaContenuto > vista.larghezza + 1) registro.push(`scorrimento orizzontale: contenuto largo ${larghezzaContenuto}px`);
  const nome = `${percorso.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}${suffisso}-${vista.nome}-${tema}.png`;
  await p.screenshot({ path: join(uscita, nome), fullPage: true });
  await p.close();
  for (const r of registro) problemi.push(`${percorso}${suffisso} [${vista.nome}, ${tema}] ${r}`);
  return nome;
}

const fatte = [];
for (const v of viste) for (const percorso of pagine) fatte.push(await apri(percorso, v));
// Tema scuro sulla home e su uno sciopero
fatte.push(await apri('/', viste[0], { tema: 'dark' }));
fatte.push(await apri('/sciopero/__PRIMO__/', viste[0], { tema: 'dark' }));
// Interazioni: scelta della città e assistente
fatte.push(await apri('/', viste[0], {
  suffisso: '-napoli',
  azione: async (p) => {
    await p.select('#scegli-luogo', 'c:napoli');
    await p.waitForFunction(() => document.getElementById('vista-nome')?.textContent === 'Napoli');
  },
}));
const domande = ["c'è sciopero domani a milano?", 'fasce garantite roma', 'sciopero bus napoli lunedi'];
fatte.push(await apri('/assistente/', viste[0], {
  suffisso: '-domande',
  azione: async (p) => {
    for (const d of domande) {
      await p.type('#chat-domanda', d);
      await p.keyboard.press('Enter');
      await p.waitForFunction((n) => document.querySelectorAll('#chat-risposte .msg-bot').length >= n, {}, domande.indexOf(d) + 1);
    }
    const risposte = await p.$$eval('#chat-risposte .msg-bot', (els) => els.map((e) => e.textContent.slice(0, 160)));
    console.log('Risposte dell\'assistente nel browser:\n- ' + risposte.join('\n- '));
  },
}));
await browser.close();
server.close();
writeFileSync(join(uscita, 'rapporto.json'), JSON.stringify({ schermate: fatte, problemi }, null, 1));
console.log(`Schermate salvate in ${uscita}: ${fatte.length}`);
if (problemi.length) { console.log(`Problemi trovati (${problemi.length}):\n- ${problemi.join('\n- ')}`); process.exit(1); }
console.log('Nessun errore in console, nessuna violazione CSP, nessuna richiesta fallita, nessuno scorrimento orizzontale.');
