// Logica condivisa (build e browser): quali scioperi toccano una zona, un settore, un giorno.
// Nessun accesso al DOM né al file system: solo dati.

/** Link ammessi nell'interfaccia: percorsi interni (mai "//dominio" o "/\\dominio") oppure https verso un host. */
export function hrefSicuro(url) {
  const s = String(url || '');
  if (/^\/(?![\/\\])[a-z0-9/#._-]*$/i.test(s)) return s;
  if (/^https:\/\/[a-z0-9.-]+(\/[^\s"'<>\\]*)?$/i.test(s)) return s;
  return null;
}

/** Chiave di confronto per i luoghi: minuscolo, senza accenti e punteggiatura, senza articoli e preposizioni. */
export function chiaveLuogo(testo) {
  return String(testo ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !['di', 'del', 'della', 'nell', 'nel', 'e', 'd', 'l', 'provincia', 'citta', 'metropolitana'].includes(w))
    .join(' ');
}

function contiene(a, b) {
  const pa = a.split(' '), pb = new Set(b.split(' '));
  return pa.length > 0 && pa.every((p) => pb.has(p));
}

/** Vero se il nome della provincia del Ministero corrisponde alla provincia indicata (con tolleranza: "Bolzano/Bozen", "Monza e della Brianza"). */
export function stessaProvincia(provinciaMit, provinciaNostra) {
  const a = chiaveLuogo(provinciaMit), b = chiaveLuogo(provinciaNostra);
  if (!a || !b) return false;
  return a === b || contiene(a, b) || contiene(b, a);
}

export function stessaRegione(a, b) {
  return chiaveLuogo(a) === chiaveLuogo(b) && chiaveLuogo(a) !== '';
}

/**
 * Vero se lo sciopero riguarda la zona.
 * zona: null (tutta Italia) | { tipo: 'citta', provincia, regione } | { tipo: 'regione', regione }
 */
export function toccaZona(s, zona) {
  if (!zona) return true;
  if (s.zona === 'nazionale') return true;
  if (zona.tipo === 'regione') return stessaRegione(s.regione, zona.regione);
  if (s.zona === 'regione') return stessaRegione(s.regione, zona.regione);
  return stessaProvincia(s.provincia, zona.provincia);
}

/** Settori per cui uno sciopero "Generale" o "Plurisettoriale" va mostrato. */
export function toccaSettore(s, settori) {
  if (!settori || settori.length === 0) return true;
  if (settori.includes(s.settore)) return true;
  if (s.settore !== 'generale' && s.settore !== 'piu-settori') return false;
  if (s.esclude_trasporti) return false;
  const esclusi = s.esclusi || [];
  const coinvolti = s.coinvolti; // null = non indicato: può toccare tutti
  return settori.some((x) => !esclusi.includes(x) && (coinvolti == null || coinvolti.includes(x)));
}

/** Vero se lo sciopero tocca il giorno (anche il giorno della vecchia data se è stato rinviato). */
export function toccaGiorno(s, giorno) {
  if (s.da <= giorno && giorno <= s.a) return true;
  return s.stato === 'differito' && s.inizio_precedente === giorno;
}

export function toccaPeriodo(s, dal, al) {
  if (s.da <= al && s.a >= dal) return true;
  return s.stato === 'differito' && s.inizio_precedente != null && s.inizio_precedente >= dal && s.inizio_precedente <= al;
}

const PRIORITA_SETTORI = ['treni', 'bus-metro', 'aerei', 'traghetti', 'generale', 'piu-settori', 'taxi', 'ncc', 'autostrade', 'servizi-ferroviari', 'elicotteri', 'merci', 'altro'];
const PRIORITA_STATO = { confermato: 0, differito: 1, revocato: 2, rimosso: 3, concluso: 4 };

export function ordinaScioperi(lista) {
  return [...lista].sort((x, y) => x.inizio.localeCompare(y.inizio)
    || (PRIORITA_STATO[x.stato] ?? 9) - (PRIORITA_STATO[y.stato] ?? 9)
    || PRIORITA_SETTORI.indexOf(x.settore) - PRIORITA_SETTORI.indexOf(y.settore)
    || String(x.id).localeCompare(String(y.id), 'it', { numeric: true }));
}

/** Uno sciopero conta per chi viaggia? (le merci, i servizi in appalto e gli scioperi che escludono i trasporti no). */
export function perPasseggeri(s) {
  return !(s.settore === 'merci' || s.settore === 'servizi-ferroviari' || s.esclude_trasporti);
}

/** Uno sciopero attivo (non revocato, non tolto). */
export function attivo(s) {
  return s.stato === 'confermato' || (s.stato === 'differito' && !s.differito_a);
}

/**
 * Scioperi di un giorno per una zona, divisi tra principali (possono toccare chi viaggia) e altri.
 * I revocati e i rinviati restano tra i principali, con la loro etichetta: chi deve partire deve saperlo.
 */
export function scioperiDelGiorno(scioperi, giorno, zona) {
  const delGiorno = ordinaScioperi(scioperi.filter((s) => toccaGiorno(s, giorno) && toccaZona(s, zona)));
  return {
    principali: delGiorno.filter((s) => perPasseggeri(s)),
    altri: delGiorno.filter((s) => !perPasseggeri(s)),
  };
}

/** Quanti scioperi attivi per chi viaggia ci sono in un giorno. */
export function contaAttivi(lista) {
  return lista.filter((s) => attivo(s) && perPasseggeri(s)).length;
}
