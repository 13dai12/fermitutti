// Ora dell'ultimo controllo del calendario ufficiale, per mostrarla senza ripubblicare il sito.
//
// Il computer in Italia controlla il Ministero ogni 30 minuti, ma il sito si ripubblica solo quando serve, per il
// limite di 500 build al mese di Cloudflare. Dopo ogni controllo il computer invia data/stato.json sull'etichetta
// «stato» del repository (scripts/aggiorna-italia.sh). Cloudflare costruisce solo i commit sui rami, quindi
// l'etichetta non consuma build. Questa funzione legge quel file da GitHub e restituisce soltanto tre date controllate.
// Non legge niente della richiesta del visitatore, non ha segreti e non salva nulla. Se GitHub non risponde, la
// pagina tiene l'ora dell'ultima pubblicazione. Gira solo su /api/stato (public/_routes.json, scritto dalla build).

const FONTE = 'https://raw.githubusercontent.com/13dai12/fermitutti/refs/tags/stato/stato.json';
const LIMITE = 16 * 1024;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
export const CAMPI = ['ultima_verifica_riuscita', 'ultima_modifica_dati', 'fonte_guasta_dal'];

/** Dal testo di stato.json alle sole date valide. null se il testo non va o manca l'ora del controllo. */
export function statoLeggero(testo) {
  if (typeof testo !== 'string' || testo.length > LIMITE) return null;
  let dati;
  try { dati = JSON.parse(testo); } catch { return null; }
  if (!dati || typeof dati !== 'object' || Array.isArray(dati)) return null;
  const uscita = {};
  for (const k of CAMPI) {
    const v = dati[k];
    uscita[k] = typeof v === 'string' && ISO.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
  }
  return uscita.ultima_verifica_riuscita ? uscita : null;
}

// Le regole di _headers non valgono per le risposte delle funzioni: le intestazioni di sicurezza si mettono qui.
const INTESTAZIONI = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex',
};

function risposta(corpo, stato, cache) {
  return new Response(JSON.stringify(corpo), { status: stato, headers: { ...INTESTAZIONI, 'Cache-Control': cache } });
}

export async function onRequestGet() {
  try {
    const r = await fetch(FONTE, {
      headers: { Accept: 'application/json, text/plain' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      // Una copia per un minuto nella cache di Cloudflare: GitHub riceve al massimo una richiesta al minuto per sede.
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (r.ok && !(Number(r.headers.get('Content-Length')) > LIMITE)) {
      const stato = statoLeggero(await r.text());
      if (stato) return risposta(stato, 200, 'public, max-age=60');
    }
  } catch { /* GitHub non risponde: la pagina tiene l'ora dell'ultima pubblicazione */ }
  return risposta({}, 503, 'no-store');
}
