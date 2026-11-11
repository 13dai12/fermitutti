// Dominio e indirizzo del sito letti dalla configurazione: le prove valgono per qualunque dominio.
import sito from '../config/sito.mjs';

export const DOMINIO = sito.dominio;
export const BASE = sito.urlBase;

const BARRA = String.fromCharCode(92);

/** Testo letterale per new RegExp(): lettere e cifre restano come sono, ogni altro carattere è preceduto da una barra rovesciata. */
export function letterale(testo) {
  return [...testo].map((c) => (/[a-z0-9]/i.test(c) ? c : BARRA + c)).join('');
}
