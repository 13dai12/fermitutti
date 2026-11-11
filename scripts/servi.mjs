#!/usr/bin/env node
// Server locale per provare il sito generato (public/), con le intestazioni di src/_headers applicate
// come fa Cloudflare Pages: le regole che corrispondono si sommano; "! Nome" toglie un'intestazione.
// Uso: node scripts/servi.mjs [porta] [cartella]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ics': 'text/calendar; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

/** Legge il file _headers: [{ schema, imposta: [[nome, valore]], togli: [nome] }]. */
export function leggiHeaders(testo) {
  const regole = [];
  let corrente = null;
  for (const riga of testo.split(/\r?\n/)) {
    if (!riga.trim() || riga.trim().startsWith('#')) continue;
    if (!/^\s/.test(riga)) { corrente = { schema: riga.trim(), imposta: [], togli: [] }; regole.push(corrente); continue; }
    if (!corrente) continue;
    const t = riga.trim();
    if (t.startsWith('!')) { corrente.togli.push(t.slice(1).trim().toLowerCase()); continue; }
    const i = t.indexOf(':');
    if (i > 0) corrente.imposta.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]);
  }
  return regole;
}

function corrisponde(schema, percorso) {
  const re = new RegExp('^' + schema.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]\w*/g, '[^/]+')).join('.*') + '$');
  return re.test(percorso);
}

/** Intestazioni finali per un percorso: i valori delle regole che corrispondono si sommano, poi si tolgono quelli con "!". */
export function intestazioniPer(regole, percorso) {
  const valori = new Map();
  const tolti = new Set();
  for (const r of regole) {
    if (!corrisponde(r.schema, percorso)) continue;
    for (const nome of r.togli) tolti.add(nome);
    for (const [nome, valore] of r.imposta) {
      const k = nome.toLowerCase();
      const prima = valori.get(k);
      valori.set(k, prima ? [prima[0], `${prima[1]}, ${valore}`] : [nome, valore]);
    }
  }
  for (const k of tolti) valori.delete(k);
  return Object.fromEntries([...valori.values()]);
}

export function avviaServer({ porta = 8080, cartella = 'public' } = {}) {
  const radice = normalize(cartella);
  const regole = existsSync(join(radice, '_headers')) ? leggiHeaders(readFileSync(join(radice, '_headers'), 'utf8')) : [];
  const radiceAssoluta = resolve(radice);
  const server = createServer((req, res) => {
    // Solo richieste per questo computer: blocca il "DNS rebinding" da pagine web malevole.
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    if (host !== '127.0.0.1' && host !== 'localhost') { res.writeHead(421); res.end(); return; }
    let percorso;
    try { percorso = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
    if (/[\0\\]/.test(percorso) || percorso.split('/').includes('..')) { res.writeHead(400); res.end(); return; }
    let file = resolve(radiceAssoluta, '.' + percorso);
    if (file !== radiceAssoluta && !file.startsWith(radiceAssoluta + sep)) { res.writeHead(400); res.end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!percorso.endsWith('/')) { res.writeHead(308, { location: '/' + percorso.replace(/^\/+/, '') + '/' }); res.end(); return; }
      file = join(file, 'index.html');
    }
    let stato = 200;
    if (!existsSync(file) || percorso.endsWith('/_headers')) { file = join(radiceAssoluta, '404.html'); stato = 404; }
    const intestazioni = { 'content-type': TIPI[extname(file)] || 'application/octet-stream' };
    // Come su Cloudflare: le intestazioni dipendono dall'indirizzo richiesto, anche quando si risponde con la 404.
    for (const [k, v] of Object.entries(intestazioniPer(regole, percorso))) intestazioni[k.toLowerCase()] = v;
    res.writeHead(stato, intestazioni);
    res.end(readFileSync(file));
  });
  return new Promise((risolvi) => server.listen(porta, '127.0.0.1', () => risolvi(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const porta = Number(process.argv[2] || 8080);
  await avviaServer({ porta, cartella: process.argv[3] || 'public' });
  console.log(`Sito in prova su http://127.0.0.1:${porta}/ (Ctrl+C per fermare)`);
}
