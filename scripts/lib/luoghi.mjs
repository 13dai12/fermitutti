// Regioni e città (data/luoghi.json): abbinamento tra i nomi usati dal Ministero e le pagine del sito.
import { readFileSync } from 'node:fs';
import { chiaveLuogo, stessaProvincia } from '../../src/js/filtri.mjs';

const luoghi = JSON.parse(readFileSync(new URL('../../data/luoghi.json', import.meta.url), 'utf8'));

export { chiaveLuogo };
export const REGIONI = luoghi.regioni;
export const CITTA = luoghi.citta;

const regioniPerChiave = new Map();
for (const r of REGIONI) for (const k of [r.nome, ...r.alias]) regioniPerChiave.set(chiaveLuogo(k), r);
const cittaPerChiave = new Map();
for (const c of CITTA) for (const k of [c.nome, c.provincia, ...c.alias]) if (!cittaPerChiave.has(chiaveLuogo(k))) cittaPerChiave.set(chiaveLuogo(k), c);

export function regioneDaNome(nome) { return regioniPerChiave.get(chiaveLuogo(nome)) || null; }

/** Città principale della provincia indicata dal Ministero (con tolleranza sui nomi composti). */
export function cittaDaProvincia(provincia) {
  if (!provincia) return null;
  const esatta = cittaPerChiave.get(chiaveLuogo(provincia));
  if (esatta) return esatta;
  const candidate = CITTA.filter((c) => stessaProvincia(provincia, c.provincia));
  return candidate.length === 1 ? candidate[0] : null;
}
export function cittaDellaRegione(regione) { return regione ? CITTA.filter((c) => c.regione === regione.nome) : []; }
