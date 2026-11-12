// Regola condivisa tra prove e browser, senza DOM: quando mostrare l'ora del controllo arrivata da /api/stato.

/**
 * Ora del controllo più recente, arrivata dopo l'ultima pubblicazione del sito (/api/stato, aggiornata ogni 30 minuti
 * dal computer in Italia). Vale solo se quel controllo ha trovato gli stessi dati che queste pagine mostrano e la fonte
 * funziona: altrimenti null, e resta l'ora scritta nella pagina.
 */
export function controlloRecente(vivo, pubblicato) {
  const t = vivo && vivo.ultima_verifica_riuscita;
  if (!pubblicato || typeof t !== 'string' || !Number.isFinite(Date.parse(t))) return null;
  if (vivo.fonte_guasta_dal || pubblicato.fonte_guasta_dal) return null;
  if (vivo.ultima_modifica_dati !== pubblicato.ultima_modifica_dati) return null;
  const p = Date.parse(pubblicato.ultima_verifica_riuscita);
  if (Number.isFinite(p) && Date.parse(t) <= p) return null;
  return t;
}
