// Dati del sito letti dalla configurazione: le prove valgono per qualunque dominio e per qualunque titolare.
import sito from '../config/sito.mjs';

export const DOMINIO = sito.dominio;
export const BASE = sito.urlBase;
/** Vero se nome o email del titolare in config/sito.mjs sono ancora segnaposto (il caso consigliato: i dati veri stanno su Cloudflare). */
export const CI_SONO_SEGNAPOSTI = /\[[A-ZÀ-Ý -]+\]/.test(`${sito.titolare.nome} ${sito.titolare.email}`);

const BARRA = String.fromCharCode(92);

/** Testo letterale per new RegExp(): lettere e cifre restano come sono, ogni altro carattere è preceduto da una barra rovesciata. */
export function letterale(testo) {
  return [...testo].map((c) => (/[a-z0-9]/i.test(c) ? c : BARRA + c)).join('');
}
