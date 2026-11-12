// Costruzione dell'HTML: escape per ogni contesto e impaginazione comune.
// Regola d'oro: ogni valore che viene dai dati passa da e() (testo e attributi) o da urlSicuro() (link).

const MAPPA_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape per testo e attributi HTML. */
export function e(valore) {
  return String(valore ?? '').replace(/[&<>"']/g, (c) => MAPPA_ESCAPE[c]);
}

/**
 * Accetta solo indirizzi relativi al sito (/…), ancore (#…), mailto:, https:// e webcal:// (eventualmente solo verso host indicati).
 * Tutto il resto (javascript:, data:, http:, indirizzi malformati) diventa "#".
 */
export function urlSicuro(url, hostAmmessi = null) {
  const s = String(url ?? '').trim();
  if (/^\/(?!\/)[^\s<>"'\\]*$/.test(s)) return e(s);
  if (/^#[\w-]*$/.test(s)) return e(s);
  if (/^mailto:[^\s<>"'\\]+$/i.test(s)) return e(s);
  let u;
  try { u = new URL(s); } catch { return '#'; }
  if (u.protocol !== 'https:' && u.protocol !== 'webcal:') return '#';
  if (u.username || u.password) return '#';
  if (hostAmmessi && !hostAmmessi.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return '#';
  return e(u.href);
}

/** JSON sicuro dentro <script type="application/ld+json"> (niente chiusure di tag né separatori di riga Unicode). */
export function jsonPerScript(oggetto) {
  const sep1 = String.fromCharCode(0x2028), sep2 = String.fromCharCode(0x2029);
  return JSON.stringify(oggetto).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .split(sep1).join('\\u2028').split(sep2).join('\\u2029');
}

export const ICONA_SVG = '<svg class="marchio-icona" viewBox="0 0 64 64" width="36" height="36" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="#b3261e"/><rect x="14" y="26" width="36" height="12" rx="3" fill="#fff"/></svg>';

const VOCI_MENU = [
  ['/', 'Oggi'],
  ['/citta/', 'Città'],
  ['/settore/', 'Settori', 'solo-largo'],
  ['/calendario/', 'Calendario'],
  ['/assistente/', 'Chiedi'],
];

function navigazione(percorso) {
  return `<nav class="nav" aria-label="Sezioni del sito"><ul>${VOCI_MENU.map(([href, testo, classe]) => {
    const attuale = href === '/' ? percorso === '/' : percorso.startsWith(href) || (href === '/citta/' && percorso.startsWith('/regione/'));
    return `<li${classe ? ` class="${classe}"` : ''}><a href="${href}"${attuale ? ' aria-current="page"' : ''}>${testo}</a></li>`;
  }).join('')}</ul></nav>`;
}

/**
 * Impaginazione comune a tutte le pagine.
 * @param {object} p - { sito, versione, titolo, titoloCompleto, descrizione, percorso, corpo, ogImmagine, ogAlt, ogTipo, jsonLd, noindex, tipoPagina, attributi }
 */
export function pagina(p) {
  const { sito } = p;
  const titoloCompleto = p.titoloCompleto || (p.percorso === '/' ? `${sito.nome}: ${p.titolo}` : `${p.titolo} | ${sito.nome}`);
  const canonical = `${sito.urlBase}${p.percorso}`;
  const immagine = `${sito.urlBase}${p.ogImmagine || '/og/predefinita.png'}`;
  const v = p.versione ? `?v=${p.versione}` : '';
  const jsonLd = p.jsonLd ? `<script type="application/ld+json">${jsonPerScript(p.jsonLd)}</script>\n` : '';
  const attributi = Object.entries(p.attributi || {}).map(([k, val]) => ` data-${e(k)}="${e(val)}"`).join('');
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${p.cspMeta ? `<meta http-equiv="Content-Security-Policy" content="${e(p.cspMeta).replace(/&#39;/g, "'")}">\n` : ''}<title>${e(titoloCompleto)}</title>
<meta name="description" content="${e(p.descrizione)}">
${p.robots ? `<meta name="robots" content="${e(p.robots)}">\n` : (p.noindex ? '<meta name="robots" content="noindex">\n' : '')}<link rel="canonical" href="${e(canonical)}">
<meta property="og:site_name" content="${e(sito.nome)}">
<meta property="og:locale" content="it_IT">
<meta property="og:type" content="${e(p.ogTipo || 'website')}">
<meta property="og:title" content="${e(p.ogTitolo || p.titolo)}">
<meta property="og:description" content="${e(p.descrizione)}">
<meta property="og:url" content="${e(canonical)}">
<meta property="og:image" content="${e(immagine)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(p.ogAlt || p.titolo)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1b1c21" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icona.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icona-180.png">
<link rel="preload" href="/caratteri/atkinson-regolare.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/stile.css${v}">
<script src="/tema.js${v}"></script>
${jsonLd}</head>
<body data-pagina="${e(p.tipoPagina || '')}"${attributi}>
<a class="salta" href="#contenuto">Vai al contenuto</a>
<header class="testata">
<a class="marchio" href="/">${ICONA_SVG}<span>${e(sito.nome)}</span></a>
<button type="button" class="tema-btn" id="tema-btn" aria-label="Cambia tema: chiaro o scuro"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 0 0 18V3z" fill="currentColor"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
${navigazione(p.percorso)}
</header>
<div id="avviso-dati" class="avviso avviso-attenzione" role="status" hidden>
<strong>Attenzione:</strong> <span id="avviso-dati-testo">i dati potrebbero non essere aggiornati.</span> <a href="/stato/">Stato degli aggiornamenti</a>
</div>
<main id="contenuto" class="contenuto">
${p.corpo}
</main>
<footer class="pie">
<p><strong>${e(sito.nome)}</strong> non è un sito ufficiale e non è collegato al Ministero né alla Commissione di garanzia scioperi. I dati vengono dal <a href="https://scioperi.mit.gov.it/mit2/public/scioperi" rel="noopener">calendario degli scioperi del Ministero delle Infrastrutture e dei Trasporti</a> e possono cambiare: prima di partire verifica sempre con la tua azienda di trasporto.</p>
<ul class="pie-link">
<li><a href="/settore/">Scioperi per settore</a></li>
<li><a href="/come-funziona/">Come funziona</a></li>
<li><a href="/fonti/">Fonti dei dati</a></li>
<li><a href="/stato/">Stato degli aggiornamenti</a></li>
<li><a href="/incorpora/">Widget per il tuo sito</a></li>
<li><a href="/privacy/">Privacy</a></li>
<li><a href="/note-legali/">Note legali</a></li>
<li><a href="/contatti/">Contatti</a></li>
</ul>
<p class="pie-piccolo">Nessun cookie, nessun tracciamento, nessun dato personale raccolto. I link di affiliazione sono sempre segnalati.</p>
</footer>
<script type="module" src="/js/app.js${v}"></script>
</body>
</html>
`;
}
