// Interfaccia nel browser. Regole: nessun innerHTML, nessun eval, solo createElement e textContent.
// I dati arrivano da /dati/*.json (stesso sito). Le preferenze restano in localStorage.
import { oggiRoma, dataMedia, dataOraRoma } from './date.mjs';
import { costruisciElenchi } from './elenchi.mjs';
import { schedaModello } from './schede.mjs';

const pagina = document.body.dataset.pagina || '';
let datiScioperi = null;
let datiBase = null;

// ---------- utilità ----------

function memoria(chiave, valore) {
  try {
    if (valore === undefined) return localStorage.getItem(chiave);
    if (valore === null) localStorage.removeItem(chiave); else localStorage.setItem(chiave, valore);
  } catch { /* memoria non disponibile (navigazione privata): si continua senza */ }
  return null;
}

function hrefSicuro(url) {
  const s = String(url || '');
  if (/^\/[a-z0-9/#._-]*$/i.test(s)) return s;
  if (/^https:\/\/[a-z0-9.-]+(\/[^\s"'<>]*)?$/i.test(s)) return s;
  return null;
}

/** el('p', { class: 'x' }, 'testo', figlio) — gli attributi passano da setAttribute, il testo da createTextNode. */
function el(tag, attributi, ...figli) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi || {})) {
    if (v == null || v === false) continue;
    if (k === 'href') { const h = hrefSicuro(v); if (h) nodo.setAttribute('href', h); continue; }
    if (!/^(class|id|role|type|title|hidden|rel|lang|aria-[a-z-]+|data-[a-z-]+|datetime)$/.test(k)) continue;
    nodo.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of figli.flat()) {
    if (f == null || f === false) continue;
    nodo.append(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
  }
  return nodo;
}

async function caricaJson(url) {
  const r = await fetch(url, { cache: 'no-cache', credentials: 'omit' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function scioperi() {
  if (!datiScioperi) datiScioperi = await caricaJson('/dati/scioperi.json');
  return datiScioperi;
}
async function base() {
  if (!datiBase) datiBase = await caricaJson('/dati/base.json');
  return datiBase;
}

function tempoFa(iso) {
  const minuti = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minuti)) return '';
  if (minuti < 2) return 'pochi istanti fa';
  if (minuti < 60) return `${minuti} minuti fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 48) return ore === 1 ? "un'ora fa" : `${ore} ore fa`;
  return `${Math.round(ore / 24)} giorni fa`;
}

// ---------- tema ----------

function avviaTema() {
  const btn = document.getElementById('tema-btn');
  if (!btn) return;
  const attuale = () => document.documentElement.getAttribute('data-tema')
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro');
  const aggiornaEtichetta = () => btn.setAttribute('aria-label', attuale() === 'scuro' ? 'Passa al tema chiaro' : 'Passa al tema scuro');
  aggiornaEtichetta();
  btn.addEventListener('click', () => {
    const nuovo = attuale() === 'scuro' ? 'chiaro' : 'scuro';
    document.documentElement.setAttribute('data-tema', nuovo);
    memoria('tema', nuovo);
    aggiornaEtichetta();
  });
}

// ---------- avviso dati vecchi e tempi relativi ----------

function aggiornaTempi() {
  for (const t of document.querySelectorAll('time[data-relativo]')) {
    const iso = t.getAttribute('datetime');
    if (!iso || t.dataset.fatto) continue;
    t.dataset.fatto = '1';
    t.append(document.createTextNode(` (${tempoFa(iso)})`));
  }
}

async function controllaFreschezza() {
  let stato;
  try { stato = (await caricaJson('/dati/stato.json')); } catch { return; }
  const avviso = document.getElementById('avviso-dati');
  const testo = document.getElementById('avviso-dati-testo');
  if (!avviso || !testo) return;
  const ore = Number(stato.ore_avviso) || 8;
  const ultima = stato.ultima_pubblicazione || stato.ultima_verifica_riuscita;
  const vecchio = ultima && (Date.now() - Date.parse(ultima)) / 3600000 > ore;
  if (stato.fonte_guasta_dal) {
    testo.textContent = `la fonte ufficiale non risponde dal ${dataOraRoma(stato.fonte_guasta_dal)}. Vedi i dati dell'ultimo controllo riuscito${stato.ultima_verifica_riuscita ? ` (${dataOraRoma(stato.ultima_verifica_riuscita)})` : ''}: verifica con la tua azienda di trasporto.`;
    avviso.hidden = false;
  } else if (vecchio || !ultima) {
    testo.textContent = ultima ? `i dati non vengono aggiornati da ${tempoFa(ultima).replace(' fa', '')} (ultimo aggiornamento: ${dataOraRoma(ultima)}). Verifica con la tua azienda di trasporto.` : 'non sappiamo quando i dati sono stati aggiornati l\'ultima volta.';
    avviso.hidden = false;
  }
}

// ---------- schede ed elenchi (stessa struttura dell'HTML statico) ----------

function nodoScheda(m, livello) {
  const h = `h${Math.min(Math.max(livello, 2), 6)}`;
  return el('li', { class: m.classe, 'data-id': m.id },
    el('p', { class: 'scheda-etichette' }, m.etichette.flatMap((x, i) => [i ? ' ' : null, el('span', { class: `pill ${x.classe}` }, x.testo)])),
    el(h, { class: 'scheda-titolo' }, el('a', { href: m.url }, m.titolo)),
    el('p', { class: 'scheda-quando' }, m.quando, m.orario ? el('span', { class: 'scheda-orario' }, m.orario) : null),
    m.modalita ? el('p', { class: 'scheda-modalita' }, `Orari: ${m.modalita}`) : null,
    m.chi ? el('p', { class: 'scheda-chi' }, m.chi) : null,
    m.garantite ? el('p', { class: 'scheda-garantite' }, m.garantite) : null,
    m.sindacati ? el('p', { class: 'scheda-sindacati' }, `Sindacati: ${m.sindacati}`) : null,
    m.note.map((n) => el('p', { class: 'scheda-nota' }, n)),
    m.link ? el('p', { class: 'scheda-nota' }, el('a', { href: m.link.url }, m.link.testo)) : null);
}

function nodiGruppo(g, oggi, livello) {
  const nodi = [];
  if (!g.principali.length) nodi.push(el('p', { class: 'nessuno' }, 'Nessuno sciopero per chi viaggia.'));
  else nodi.push(el('ul', { class: 'elenco-schede' }, g.principali.map((s) => nodoScheda(schedaModello(s, oggi, { giorno: g.giorno }), livello))));
  if (g.altri.length) {
    nodi.push(el('details', { class: 'altri' },
      el('summary', null, `${g.altri.length === 1 ? 'Un altro sciopero' : `Altri ${g.altri.length} scioperi`} che di norma non toccano chi viaggia`),
      el('ul', { class: 'elenco-schede' }, g.altri.map((s) => nodoScheda(schedaModello(s, oggi, { giorno: g.giorno }), livello)))));
  }
  return nodi;
}

function disegnaElenchi(contenitore, elenchi, oggi) {
  const sezioni = elenchi.sezioni.map((sez) => {
    const corpo = [];
    if (sez.id !== 'prossimi') {
      const g = sez.giorni[0];
      if (!g.principali.length && !g.altri.length) corpo.push(el('p', { class: 'nessuno' }, sez.vuoto));
      else corpo.push(...nodiGruppo(g, oggi, 3));
    } else if (!sez.giorni.length) {
      corpo.push(el('p', { class: 'nessuno' }, sez.vuoto));
    } else {
      for (const g of sez.giorni) { const t = dataMedia(g.giorno); corpo.push(el('h3', { class: 'giorno-titolo' }, t[0].toUpperCase() + t.slice(1)), ...nodiGruppo(g, oggi, 4)); }
    }
    return el('section', { id: sez.id, class: 'giorno', 'aria-labelledby': `t-${sez.id}` },
      el('h2', { id: `t-${sez.id}` }, sez.titolo, sez.data ? ' ' : null, sez.data ? el('span', { class: 'data-sezione' }, sez.data) : null),
      corpo);
  });
  contenitore.replaceChildren(...sezioni);
}

function aggiornaRiepilogo(conteggi) {
  const r = document.getElementById('riepilogo');
  if (!r) return;
  const voci = r.querySelectorAll('a');
  const valori = [conteggi.oggi, conteggi.domani, conteggi.prossimi];
  voci.forEach((a, i) => {
    const num = a.querySelector('.num');
    const eti = a.querySelector('.eti');
    if (!num || !eti) return;
    num.textContent = String(valori[i]);
    num.className = `num ${valori[i] ? 'alcuni' : 'zero'}`;
    eti.textContent = eti.textContent.replace(/^(sciopero|scioperi)/, valori[i] === 1 ? 'sciopero' : 'scioperi');
  });
}

function zonaDaOpzione(opt) {
  if (!opt || !opt.value) return null;
  if (opt.dataset.tipo === 'citta') return { tipo: 'citta', provincia: opt.dataset.provincia, regione: opt.dataset.regione, nome: opt.dataset.nome };
  if (opt.dataset.tipo === 'regione') return { tipo: 'regione', regione: opt.dataset.regione, nome: opt.dataset.nome };
  return null;
}

async function ridisegna({ zona = null, settori = null, forza = false } = {}) {
  const contenitore = document.getElementById('elenchi');
  if (!contenitore) return;
  const oggi = oggiRoma();
  let dati;
  try { dati = await scioperi(); } catch { return; }
  // Se la pagina è stata costruita oggi e non c'è un filtro, l'HTML statico è già giusto.
  if (!forza && !zona && dati.stato.oggi_build === oggi) return;
  const giorni = Number(contenitore.dataset.giorni) || 7;
  const elenchi = costruisciElenchi(dati.scioperi, oggi, { zona, settori, giorniAvanti: giorni });
  disegnaElenchi(contenitore, elenchi, oggi);
  aggiornaRiepilogo(elenchi.conteggi);
}

// ---------- home: scelta della città ----------

function avviaHome() {
  const sel = document.getElementById('scegli-luogo');
  const vista = document.getElementById('vista-nome');
  if (!sel) return ridisegna();
  const salvato = memoria('luogo');
  if (salvato && [...sel.options].some((o) => o.value === salvato)) sel.value = salvato;
  const applica = (forza) => {
    const opt = sel.options[sel.selectedIndex];
    const zona = zonaDaOpzione(opt);
    if (vista) vista.textContent = zona ? zona.nome : 'tutta Italia';
    ridisegna({ zona, forza });
  };
  sel.addEventListener('change', () => { memoria('luogo', sel.value || null); applica(true); });
  applica(Boolean(sel.value));
}

function avviaZona() {
  const b = document.body.dataset;
  let zona = null;
  if (b.zonaTipo === 'citta') zona = { tipo: 'citta', provincia: b.zonaProvincia, regione: b.zonaRegione };
  else if (b.zonaTipo === 'regione') zona = { tipo: 'regione', regione: b.zonaRegione };
  const settori = b.settore ? [b.settore] : null;
  // Le pagine di zona contengono già i dati della zona: si ridisegna solo se la data è cambiata.
  scioperi().then((dati) => { if (dati.stato.oggi_build !== oggiRoma()) ridisegna({ zona, settori, forza: true }); }).catch(() => {});
}

// ---------- calendario e widget ----------

function avviaCalendario() {
  const sel = document.getElementById('scegli-feed');
  const box = document.getElementById('iscrizione');
  if (!sel || !box) return;
  const webcal = document.getElementById('link-webcal');
  const google = document.getElementById('link-google');
  const https = document.getElementById('link-https');
  const titolo = document.getElementById('iscrizione-titolo');
  const host = location.host;
  const salvato = memoria('luogo');
  if (salvato && [...sel.options].some((o) => o.value === salvato)) sel.value = salvato;
  const applica = () => {
    const v = sel.value;
    let nome = 'italia', etichetta = 'Tutti gli scioperi in Italia';
    const opt = sel.options[sel.selectedIndex];
    if (v.startsWith('c:')) { nome = `citta-${v.slice(2)}`; etichetta = `Scioperi a ${opt.dataset.nome}`; }
    else if (v.startsWith('r:')) { nome = `regione-${v.slice(2)}`; etichetta = `Scioperi in ${opt.dataset.nome}`; }
    else if (v.startsWith('s:')) { nome = `settore-${v.slice(2)}`; etichetta = `Scioperi: ${opt.dataset.nome.toLowerCase()} (tutta Italia)`; }
    if (!/^[a-z0-9-]+$/.test(nome)) return;
    const percorso = `/ics/${nome}.ics`;
    webcal.setAttribute('href', `webcal://${host}${percorso}`);
    google.setAttribute('href', `https://www.google.com/calendar/render?cid=webcal://${host}${percorso}`);
    https.textContent = `https://${host}${percorso}`;
    titolo.textContent = etichetta;
  };
  sel.addEventListener('change', applica);
  applica();
}

function avviaIncorpora() {
  const sel = document.getElementById('scegli-widget');
  const area = document.getElementById('codice-widget');
  const anteprima = document.getElementById('anteprima-widget');
  if (!sel || !area) return;
  const salvato = memoria('luogo');
  if (salvato && salvato.startsWith('c:') && [...sel.options].some((o) => o.value === salvato)) sel.value = salvato;
  const applica = () => {
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value.startsWith('c:')) return;
    const slug = opt.value.slice(2);
    if (!/^[a-z0-9-]+$/.test(slug)) return;
    const baseUrl = area.dataset.base;
    area.value = `<iframe src="${baseUrl}/widget/${slug}/" title="Prossimi scioperi a ${opt.dataset.nome.replace(/["<>&]/g, '')}" width="100%" height="380" style="border:0" loading="lazy"></iframe>`;
    if (anteprima) anteprima.setAttribute('href', `/widget/${slug}/`);
  };
  sel.addEventListener('change', applica);
  applica();
}

// ---------- copia e condividi ----------

function avviaPulsanti() {
  for (const b of document.querySelectorAll('[data-copia]')) {
    b.addEventListener('click', async () => {
      const bersaglio = document.getElementById(b.dataset.copia);
      if (!bersaglio) return;
      const testo = 'value' in bersaglio && bersaglio.tagName === 'TEXTAREA' ? bersaglio.value : bersaglio.textContent;
      try { await navigator.clipboard.writeText(testo); b.textContent = 'Copiato'; } catch {
        if (bersaglio.select) bersaglio.select();
        b.textContent = 'Seleziona e copia';
      }
    });
  }
  for (const b of document.querySelectorAll('[data-condividi]')) {
    if (!navigator.share) { b.hidden = true; continue; }
    b.addEventListener('click', () => {
      navigator.share({ title: b.dataset.titolo || document.title, url: b.dataset.condividi }).catch(() => {});
    });
  }
}

// ---------- assistente ----------

let assistente = null;

async function preparaAssistente() {
  if (assistente) return assistente;
  const [{ creaAssistente }, dati, b] = await Promise.all([import('./assistente.mjs'), scioperi(), base()]);
  assistente = creaAssistente({ scioperi: dati.scioperi, base: b });
  return assistente;
}

function nodoRisposta(r) {
  const parti = [el('p', null, r.testo)];
  if (r.elenco && r.elenco.length) {
    parti.push(el('ul', null, r.elenco.map((x) => el('li', null,
      x.url ? el('a', { href: x.url, rel: /^https:/.test(x.url) ? 'noopener' : null }, x.titolo) : x.titolo,
      x.dettaglio ? el('br') : null, x.dettaglio ? el('span', { class: 'nota' }, x.dettaglio) : null))));
  }
  for (const a of r.aggiunte || []) parti.push(el('p', null, a));
  if (r.link && r.link.length) {
    parti.push(el('p', { class: 'chat-link' }, r.link.flatMap((l, i) => [i ? ' · ' : null, el('a', { href: l.url, rel: /^https:/.test(l.url) ? 'noopener' : null }, l.testo)])));
  }
  return el('div', { class: 'msg msg-bot' }, parti);
}

function avviaAssistente() {
  const form = document.getElementById('chat-form');
  const campo = document.getElementById('chat-domanda');
  const risposte = document.getElementById('chat-risposte');
  const sugg = document.getElementById('chat-suggerimenti');
  if (!form || !campo || !risposte || !sugg) return;
  const mostraSuggerimenti = (lista) => {
    sugg.replaceChildren(...lista.slice(0, 4).map((t) => {
      const b = el('button', { type: 'button' }, t);
      b.addEventListener('click', () => { campo.value = t; chiedi(t); });
      return b;
    }));
  };
  const chiedi = async (domanda) => {
    const q = String(domanda || '').trim().slice(0, 200);
    if (!q) return;
    risposte.append(el('div', { class: 'msg msg-utente' }, q));
    let r;
    try {
      const a = await preparaAssistente();
      r = a.rispondi(q, { oggi: oggiRoma() });
    } catch {
      r = { testo: 'Non riesco a caricare i dati in questo momento. Riprova tra poco o guarda la pagina iniziale.', aggiunte: [], elenco: [], link: [{ testo: 'Scioperi di oggi e domani', url: '/' }], suggerimenti: [] };
    }
    risposte.append(nodoRisposta(r));
    while (risposte.children.length > 20) risposte.firstElementChild.remove();
    mostraSuggerimenti(r.suggerimenti && r.suggerimenti.length ? r.suggerimenti : []);
    campo.value = '';
    risposte.lastElementChild.scrollIntoView({ block: 'nearest' });
  };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); chiedi(campo.value); });
  campo.addEventListener('focus', () => { preparaAssistente().catch(() => {}); }, { once: true });
  mostraSuggerimenti(["C'è sciopero domani?", 'Scioperi dei treni questa settimana', 'Fasce garantite a Roma', 'Come metto gli scioperi nel calendario?']);
  const domandaIniziale = new URLSearchParams(location.search).get('d');
  if (domandaIniziale) { campo.value = domandaIniziale.slice(0, 200); chiedi(domandaIniziale); }
}

// ---------- avvio ----------

avviaTema();
aggiornaTempi();
controllaFreschezza();
avviaPulsanti();
if (pagina === 'home') avviaHome();
if (pagina === 'zona') avviaZona();
if (pagina === 'calendario') avviaCalendario();
if (pagina === 'incorpora') avviaIncorpora();
if (document.getElementById('chat-form')) avviaAssistente();
