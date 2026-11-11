#!/usr/bin/env node
// Controlli dopo la pubblicazione: HTTPS, reindirizzamenti, intestazioni di sicurezza, DNS (DNSSEC, SPF, DMARC, MX nullo, CAA),
// calendari, security.txt e freschezza dei dati.
// Uso: npm run verifica-online -- fermitutti.it
// Le domande DNS passano dal servizio DNS-over-HTTPS di Cloudflare (1.1.1.1), che verifica anche il DNSSEC.
import tls from 'node:tls';

const dominio = String(process.argv[2] || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) {
  console.error('Uso: npm run verifica-online -- tuodominio.it');
  process.exit(2);
}
const risultati = [];
const ok = (nome, dettaglio = '') => risultati.push({ esito: 'OK', nome, dettaglio });
const ko = (nome, dettaglio = '') => risultati.push({ esito: 'NO', nome, dettaglio });
const forse = (nome, dettaglio = '') => risultati.push({ esito: '??', nome, dettaglio });

async function richiesta(url, opzioni = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    return await fetch(url, { redirect: 'manual', signal: c.signal, headers: { 'user-agent': 'verifica-online/1.0' }, ...opzioni });
  } finally { clearTimeout(t); }
}

async function dns(nome, tipo) {
  const r = await richiesta(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nome)}&type=${tipo}&do=true`, { headers: { accept: 'application/dns-json' } });
  if (!r.ok) throw new Error(`DNS HTTP ${r.status}`);
  return r.json();
}
const valori = (risposta, tipo) => (risposta.Answer || []).filter((a) => a.type === tipo).map((a) => String(a.data).replace(/^"|"$/g, '').replace(/" "/g, ''));

async function controlla(nome, fn) {
  try { await fn(); } catch (e) { ko(nome, `errore: ${e.message}`); }
}

await controlla('HTTPS risponde con un certificato valido', async () => {
  const r = await richiesta(`https://${dominio}/`);
  if (r.status === 200) ok('HTTPS risponde con un certificato valido', `https://${dominio}/ -> 200`);
  else ko('HTTPS risponde con un certificato valido', `stato ${r.status}`);
  const h = (n) => r.headers.get(n) || '';
  const csp = h('content-security-policy');
  const richieste = ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'none'"];
  const mancanti = richieste.filter((d) => !csp.includes(d));
  if (csp && !mancanti.length && !/unsafe-inline|unsafe-eval/.test(csp)) ok('Content-Security-Policy rigida');
  else ko('Content-Security-Policy rigida', csp ? `mancano: ${mancanti.join(', ') || 'nessuna'}${/unsafe/.test(csp) ? '; contiene unsafe-*' : ''}` : 'assente');
  const hsts = /max-age=(\d+)/.exec(h('strict-transport-security'));
  if (hsts && +hsts[1] >= 63072000) ok('HSTS di almeno 2 anni', h('strict-transport-security'));
  else ko('HSTS di almeno 2 anni', h('strict-transport-security') || 'assente');
  for (const [nome, atteso] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'strict-origin-when-cross-origin'], ['cross-origin-opener-policy', 'same-origin']]) {
    if (h(nome).toLowerCase() === atteso.toLowerCase()) ok(`Intestazione ${nome}`); else ko(`Intestazione ${nome}`, h(nome) || 'assente');
  }
  if (/camera=\(\)/.test(h('permissions-policy'))) ok('Intestazione permissions-policy'); else ko('Intestazione permissions-policy', h('permissions-policy') || 'assente');
});

await controlla('HTTP porta subito a HTTPS', async () => {
  const r = await richiesta(`http://${dominio}/`);
  const dove = r.headers.get('location') || '';
  if ([301, 308].includes(r.status) && dove.startsWith(`https://${dominio}`)) ok('HTTP porta subito a HTTPS', `${r.status} -> ${dove}`);
  else ko('HTTP porta subito a HTTPS', `stato ${r.status} ${dove}`);
});

await controlla('www porta al dominio principale con un solo passaggio', async () => {
  const r = await richiesta(`https://www.${dominio}/prova?x=1`);
  const dove = r.headers.get('location') || '';
  if (r.status === 301 && dove === `https://${dominio}/prova?x=1`) {
    const r2 = await richiesta(dove);
    if (r2.status === 404 || r2.status === 200) ok('www porta al dominio principale con un solo passaggio', `${r.status} -> ${dove}`);
    else ko('www porta al dominio principale con un solo passaggio', `secondo passaggio: ${r2.status}`);
  } else ko('www porta al dominio principale con un solo passaggio', `stato ${r.status} ${dove}`);
});

await controlla('Il widget si può incorporare', async () => {
  const r = await richiesta(`https://${dominio}/widget/milano/`);
  const csp = r.headers.get('content-security-policy') || '';
  const testo = await r.text();
  if (r.status === 200 && !csp.includes("frame-ancestors 'none'") && !r.headers.get('x-frame-options') && testo.includes('http-equiv="Content-Security-Policy"')) ok('Il widget si può incorporare e ha la sua politica di sicurezza');
  else ko('Il widget si può incorporare', `stato ${r.status}; CSP: ${csp || 'nessuna'}; X-Frame-Options: ${r.headers.get('x-frame-options') || 'nessuno'}`);
});

await controlla('Una pagina inesistente sotto /widget/ ha comunque una politica di sicurezza', async () => {
  const r = await richiesta(`https://${dominio}/widget/pagina-che-non-esiste/`);
  const testo = await r.text();
  const meta = /<meta http-equiv="Content-Security-Policy" content="[^"]*object-src 'none'/.test(testo);
  if (r.status === 404 && (meta || (r.headers.get('content-security-policy') || '').includes("object-src 'none'"))) ok('Una pagina inesistente sotto /widget/ ha comunque una politica di sicurezza');
  else ko('Una pagina inesistente sotto /widget/ ha comunque una politica di sicurezza', `stato ${r.status}`);
});

await controlla('Cloudflare non modifica le pagine', async () => {
  const pagine = ['/', '/contatti/', '/privacy/'];
  const trovati = [];
  for (const p of pagine) {
    const t = await (await richiesta(`https://${dominio}${p}`)).text();
    if (/\/cdn-cgi\/|__cf_email__|data-cfemail|rocket-loader/i.test(t)) trovati.push(p);
  }
  if (!trovati.length) ok('Cloudflare non modifica le pagine (niente script aggiunti né email offuscate)');
  else ko('Cloudflare non modifica le pagine', `script o email offuscate in: ${trovati.join(', ')} (spegni Email Address Obfuscation e Rocket Loader)`);
});

for (const percorso of ['/ics/italia.ics', '/ics/citta-roma.ics']) {
  await controlla(`Calendario ${percorso}`, async () => {
    const r = await richiesta(`https://${dominio}${percorso}`);
    const corpo = await r.text();
    if (r.status === 200 && /text\/calendar/.test(r.headers.get('content-type') || '') && corpo.startsWith('BEGIN:VCALENDAR')) ok(`Calendario ${percorso}`, r.headers.get('content-type'));
    else ko(`Calendario ${percorso}`, `stato ${r.status}, tipo ${r.headers.get('content-type')}`);
  });
}

await controlla('security.txt', async () => {
  const r = await richiesta(`https://${dominio}/.well-known/security.txt`);
  const t = await r.text();
  const scade = /^Expires: (.+)$/m.exec(t);
  if (r.status === 200 && /^Contact: mailto:[^\s[]+@[^\s\]]+$/m.test(t) && scade && Date.parse(scade[1]) > Date.now()) ok('security.txt con contatto e scadenza futura');
  else ko('security.txt con contatto e scadenza futura', /\[EMAIL/.test(t) ? 'il contatto è ancora un segnaposto' : `stato ${r.status}`);
});

await controlla('Dati aggiornati', async () => {
  const r = await richiesta(`https://${dominio}/dati/stato.json`);
  const s = await r.json();
  const ultima = s.ultima_pubblicazione || s.ultima_verifica_riuscita;
  const ore = ultima ? (Date.now() - Date.parse(ultima)) / 3600000 : Infinity;
  if (s.fonte_guasta_dal) ko('Dati aggiornati', `la fonte risulta guasta dal ${s.fonte_guasta_dal}`);
  else if (ore <= (s.ore_avviso || 8)) ok('Dati aggiornati', `ultima pubblicazione ${ore.toFixed(1)} ore fa`);
  else ko('Dati aggiornati', `ultima pubblicazione ${Number.isFinite(ore) ? ore.toFixed(1) + ' ore fa' : 'sconosciuta'}`);
});

await controlla('DNSSEC attivo e verificato', async () => {
  const a = await dns(dominio, 'A');
  const ds = await dns(dominio, 'DS');
  if (a.AD === true && valori(ds, 43).length) ok('DNSSEC attivo e verificato', `record DS: ${valori(ds, 43).length}`);
  else ko('DNSSEC attivo e verificato', `firma verificata: ${a.AD}; record DS presenti: ${valori(ds, 43).length}`);
});

await controlla('SPF che vieta ogni invio di email', async () => {
  const spf = valori(await dns(dominio, 'TXT'), 16).filter((v) => v.startsWith('v=spf1'));
  if (spf.length === 1 && spf[0].trim() === 'v=spf1 -all') ok('SPF che vieta ogni invio di email', spf[0]);
  else ko('SPF che vieta ogni invio di email', spf.join(' | ') || 'assente');
});

await controlla('DMARC con p=reject', async () => {
  const d = valori(await dns(`_dmarc.${dominio}`, 'TXT'), 16).filter((v) => v.startsWith('v=DMARC1'));
  if (d.length === 1 && /;\s*p=reject/.test(d[0])) ok('DMARC con p=reject', d[0]); else ko('DMARC con p=reject', d.join(' | ') || 'assente');
});

await controlla('MX nullo (il dominio non riceve email)', async () => {
  const mx = valori(await dns(dominio, 'MX'), 15);
  if (mx.length === 1 && /^0 \.?$/.test(mx[0].trim())) ok('MX nullo (il dominio non riceve email)', mx[0]); else ko('MX nullo (il dominio non riceve email)', mx.join(' | ') || 'assente');
});

await controlla('CAA: solo le autorità usate da Cloudflare', async () => {
  const caa = valori(await dns(dominio, 'CAA'), 257);
  const testo = caa.join(' ');
  if (caa.length && /letsencrypt\.org/.test(testo) && /pki\.goog/.test(testo)) ok('CAA: solo le autorità usate da Cloudflare', caa.join(' | '));
  else ko('CAA: solo le autorità usate da Cloudflare', caa.join(' | ') || 'assenti');
});

await controlla('TLS minimo 1.2', async () => {
  const prova = (versione) => new Promise((risolvi) => {
    const s = tls.connect({ host: dominio, servername: dominio, port: 443, minVersion: versione, maxVersion: versione, ciphers: 'DEFAULT@SECLEVEL=0', timeout: 10000 }, () => { s.end(); risolvi(true); });
    s.on('error', () => risolvi(false));
    s.on('timeout', () => { s.destroy(); risolvi(false); });
  });
  const v12 = await prova('TLSv1.2');
  const v11 = await prova('TLSv1.1');
  const v10 = await prova('TLSv1');
  if (v12 && !v11 && !v10) ok('TLS minimo 1.2', 'TLS 1.2 accettato, 1.0 e 1.1 rifiutati');
  else if (!v12) ko('TLS minimo 1.2', 'TLS 1.2 non accettato');
  else forse('TLS minimo 1.2', `TLS 1.1 accettato: ${v11}, TLS 1.0 accettato: ${v10} (controlla «Minimum TLS Version» in Cloudflare)`);
});

const simboli = { OK: '✔', NO: '✘', '??': '?' };
for (const r of risultati) console.log(`${simboli[r.esito]} ${r.nome}${r.dettaglio ? ` (${r.dettaglio})` : ''}`);
const falliti = risultati.filter((r) => r.esito === 'NO').length;
console.log(`\n${risultati.length - falliti} controlli superati su ${risultati.length}.`);
if (falliti) console.log('Per ogni controllo non superato trovi la soluzione in DEPLOY.md, sezione «Controllo finale».');
process.exit(falliti ? 1 : 0);
