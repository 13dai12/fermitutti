// Immagini di anteprima (Open Graph) generate in locale: SVG disegnato a mano, convertito in PNG con resvg (WebAssembly).
import { readFile } from 'node:fs/promises';
import { e } from './html.mjs';

let Resvg = null;
let fontBold = null, fontRegular = null;

export async function preparaRenderer() {
  if (Resvg) return;
  const modulo = await import('@resvg/resvg-wasm');
  await modulo.initWasm(await readFile(new URL('../../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)));
  Resvg = modulo.Resvg;
  fontBold = await readFile(new URL('../../assets/fonts/AtkinsonHyperlegible-Bold.ttf', import.meta.url));
  fontRegular = await readFile(new URL('../../assets/fonts/AtkinsonHyperlegible-Regular.ttf', import.meta.url));
}

export function pngDaSvg(svg) {
  if (!Resvg) throw new Error('chiama preparaRenderer() prima');
  const r = new Resvg(svg, { font: { fontBuffers: [fontBold, fontRegular], loadSystemFonts: false, defaultFontFamily: 'Atkinson Hyperlegible' } });
  return Buffer.from(r.render().asPng());
}

/** Vero se il testo contiene solo caratteri ammessi in XML 1.0 (resvg rifiuta gli altri). */
export function xmlValido(t) {
  for (const ch of String(t)) {
    const c = ch.codePointAt(0);
    const ok = c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);
    if (!ok) return false;
  }
  return true;
}

/** Toglie i caratteri non ammessi in XML (per esempio U+FFFF) prima di metterli in un'immagine. */
export function soloXml(t) {
  let out = '';
  for (const ch of String(t ?? '')) if (xmlValido(ch)) out += ch;
  return out;
}

/** Spezza un testo in righe di al massimo `max` caratteri (per parole), al massimo `righeMax` righe. */
export function spezza(testo, max, righeMax) {
  const parole = String(testo ?? '').split(/\s+/).filter(Boolean);
  const righe = [];
  let corrente = '';
  for (const p of parole) {
    const prova = corrente ? `${corrente} ${p}` : p;
    if (prova.length <= max) corrente = prova;
    else {
      if (corrente) righe.push(corrente);
      corrente = p.length > max ? p.slice(0, max - 1) + '…' : p;
    }
  }
  if (corrente) righe.push(corrente);
  if (righe.length > righeMax) {
    righe.length = righeMax;
    righe[righeMax - 1] = righe[righeMax - 1].replace(/…?$/, '…');
  }
  return righe;
}

const COLORI = {
  confermato: { banda: '#b3261e', etichetta: 'SCIOPERO' },
  differito: { banda: '#9a5b00', etichetta: 'SCIOPERO RINVIATO' },
  revocato: { banda: '#4a5560', etichetta: 'SCIOPERO REVOCATO' },
  rimosso: { banda: '#4a5560', etichetta: 'RIMOSSO DAL CALENDARIO' },
  concluso: { banda: '#4a5560', etichetta: 'SCIOPERO CONCLUSO' },
};

/**
 * SVG dell'anteprima 1200x630.
 * @param {object} p - { stato, titolo, data, dettaglio, sito }
 */
export function svgAnteprima(p) {
  p = { ...p, titolo: soloXml(p.titolo), data: soloXml(p.data), dettaglio: soloXml(p.dettaglio) };
  const c = COLORI[p.stato] || COLORI.confermato;
  const righeTitolo = spezza(p.titolo, 26, 2);
  const righeDettaglio = spezza(p.dettaglio || '', 52, 2);
  const yTitolo = 250;
  const titolo = righeTitolo.map((r, i) => `<text x="80" y="${yTitolo + i * 80}" font-size="68" font-weight="700" fill="#1b1b1b">${e(r)}</text>`).join('');
  const yDettaglio = yTitolo + righeTitolo.length * 80 + 10;
  const dettaglio = righeDettaglio.map((r, i) => `<text x="80" y="${yDettaglio + i * 44}" font-size="32" fill="#3c3c3c">${e(r)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Atkinson Hyperlegible">
<rect width="1200" height="630" fill="#fff8f0"/>
<rect width="1200" height="120" fill="${c.banda}"/>
<circle cx="90" cy="60" r="34" fill="#fff"/><rect x="70" y="53" width="40" height="14" rx="3" fill="${c.banda}"/>
<text x="150" y="78" font-size="46" font-weight="700" fill="#fff">${e(c.etichetta)}</text>
<text x="80" y="180" font-size="40" fill="${c.banda}" font-weight="700">${e(p.data)}</text>
${titolo}
${dettaglio}
<rect x="0" y="560" width="1200" height="70" fill="#1b1b1b"/>
<text x="80" y="606" font-size="30" fill="#fff" font-weight="700">${e(p.sito.dominio)}</text>
<text x="1120" y="606" font-size="26" fill="#d6d6d6" text-anchor="end">Dati ufficiali del Ministero dei Trasporti</text>
</svg>`;
}

/** SVG generico per le pagine senza sciopero. */
export function svgPredefinita(sito) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Atkinson Hyperlegible">
<rect width="1200" height="630" fill="#b3261e"/>
<circle cx="600" cy="230" r="110" fill="#fff"/><rect x="535" y="208" width="130" height="44" rx="8" fill="#b3261e"/>
<text x="600" y="430" font-size="96" font-weight="700" fill="#fff" text-anchor="middle">${e(sito.nome)}</text>
<text x="600" y="510" font-size="40" fill="#ffe5e0" text-anchor="middle">${e(sito.slogan)}</text>
<text x="600" y="590" font-size="30" fill="#ffe5e0" text-anchor="middle">${e(sito.dominio)}</text>
</svg>`;
}

/** Icona del sito in PNG (per apple-touch-icon). */
export function svgIcona(dim = 180) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#b3261e"/><rect x="14" y="26" width="36" height="12" rx="3" fill="#fff"/></svg>`;
}
