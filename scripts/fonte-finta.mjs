#!/usr/bin/env node
// Un finto Ministero per i test: serve il feed salvato oppure versioni guaste.
// Uso: node scripts/fonte-finta.mjs [porta]   poi FONTE_URL=http://127.0.0.1:PORTA/rss?scenario=NOME
// Scenari: ok, vuoto, html, errore500, lentissimo, campi-mancanti, date-rotte, script, script-titolo, crlf, unicode, doctype,
// redirect (verso un altro sito), enorme, meta (solo un terzo degli scioperi). La pagina HTML con le note è su /pagina.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const feedOk = readFileSync(new URL('../test/fixtures/feed-reale.xml', import.meta.url), 'utf8');
const paginaHtml = readFileSync(new URL('../test/fixtures/pagina-reale.html', import.meta.url), 'utf8');

export function feedPerScenario(scenario) {
  switch (scenario) {
    case 'ok': return { stato: 200, tipo: 'application/rss+xml; charset=UTF-8', corpo: feedOk };
    case 'vuoto': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace(/<item>[\s\S]*<\/item>/, '') };
    case 'html': return { stato: 200, tipo: 'text/html', corpo: '<!doctype html><html><body><h1>Manutenzione in corso</h1></body></html>' };
    case 'errore500': return { stato: 500, tipo: 'text/html', corpo: 'Internal Server Error' };
    case 'campi-mancanti': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace(/Data fine: [^<]*<br\/>/g, '') };
    case 'date-rotte': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace(/Data inizio: \d\d\/\d\d\/\d{4}/g, 'Data inizio: 31/02/2026') };
    case 'script': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace(/PERSONALE SOC\. ANM DI NAPOLI/g, '<script>alert(1)</script>PERSONALE <img src=x onerror=alert(1)> "javascript:alert(1)"') };
    case 'script-titolo': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace('Provincia: Cosenza</title>', 'Provincia: &lt;img src=x onerror=alert(1)&gt;</title>') };
    case 'crlf': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace('PERSONALE SOC. ATVO DI VENEZIA', 'ATVO\r\nBEGIN:VEVENT\r\nSUMMARY:finto') };
    case 'unicode': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace('PERSONALE SOC. ATVO DI VENEZIA', 'ATVO \u202eozzepep\u200b\u2028 \ud83d\ude8c') };
    case 'doctype': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace('<rss', '<!DOCTYPE rss [<!ENTITY x "y">]><rss') };
    case 'redirect': return { stato: 302, tipo: 'text/plain', corpo: '', location: 'https://example.com/rss' };
    case 'enorme': return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace('PERSONALE SOC. ANM DI NAPOLI', 'X'.repeat(20000)) };
    case 'meta': {
      const items = feedOk.match(/<item>[\s\S]*?<\/item>/g);
      const tenuti = items.slice(0, Math.floor(items.length / 3));
      return { stato: 200, tipo: 'application/rss+xml', corpo: feedOk.replace(/<item>[\s\S]*<\/item>/, tenuti.join('\n')) };
    }
    default: return { stato: 404, tipo: 'text/plain', corpo: 'scenario sconosciuto' };
  }
}

export function avviaFonteFinta(porta = 0) {
  return new Promise((risolvi) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const scenario = url.searchParams.get('scenario') || 'ok';
      if (url.pathname === '/pagina') {
        res.writeHead(200, { 'content-type': 'text/html; charset=UTF-8' });
        res.end(paginaHtml);
        return;
      }
      if (scenario === 'lentissimo') return; // non risponde mai
      const { stato, tipo, corpo, location } = feedPerScenario(scenario);
      res.writeHead(stato, location ? { 'content-type': tipo, location } : { 'content-type': tipo });
      res.end(corpo);
    });
    server.listen(porta, '127.0.0.1', () => risolvi({ server, porta: server.address().port, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { url } = await avviaFonteFinta(Number(process.argv[2] || 8787));
  console.log(`Fonte finta in ascolto su ${url}/rss?scenario=ok (scenari: ok, vuoto, html, errore500, lentissimo, campi-mancanti, date-rotte, script, script-titolo, crlf, unicode, doctype, redirect, enorme, meta)`);
}
