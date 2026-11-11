// Fasce di garanzia ufficiali (data/fasce_garanzia.json): solo dati con fonte e data di verifica.
import { readFileSync } from 'node:fs';
import { e, urlSicuro } from './html.mjs';
import { dataLunga, festivo } from './date.mjs';
import { chiaveLuogo } from '../../src/js/filtri.mjs';
import { cittaDaProvincia, CITTA } from './luoghi.mjs';

const dati = JSON.parse(readFileSync(new URL('../../data/fasce_garanzia.json', import.meta.url), 'utf8'));

/** Controlla il file delle fasce: link solo https, orari ben formati, città esistenti. Lancia un errore leggibile. */
export function validaFasce(voci = dati.fasce) {
  const errori = [];
  const citta = new Set(CITTA.map((c) => c.nome));
  for (const v of voci) {
    for (const k of ['fonte_url', 'pagina_scioperi_url']) {
      if (v[k] == null) continue;
      let u;
      try { u = new URL(v[k]); } catch { errori.push(`${v.id}: ${k} non è un indirizzo valido`); continue; }
      if (u.protocol !== 'https:' || u.username || u.password || u.port) errori.push(`${v.id}: ${k} deve essere un indirizzo https semplice`);
    }
    if (!v.pagina_scioperi_url && !v.fonte_url) errori.push(`${v.id}: serve almeno un link ufficiale`);
    for (const f of v.fasce || []) {
      for (const k of ['dalle', 'alle']) {
        if (!/^(\d\d:\d\d|inizio servizio|fine servizio)$/.test(f[k])) errori.push(`${v.id}: orario non valido "${f[k]}"`);
      }
      if (!['feriali', 'festivi', 'tutti', 'sabato'].includes(f.giorni)) errori.push(`${v.id}: giorni non validi "${f.giorni}"`);
    }
    if ((v.fasce || []).length && !v.fasce_testo) errori.push(`${v.id}: ci sono orari ma manca la citazione della fonte`);
    if (v.tipo === 'tpl' && !citta.has(v.citta)) errori.push(`${v.id}: città "${v.citta}" non presente in data/luoghi.json`);
    if (v.fasce_testo && v.fasce_testo.length > 500) errori.push(`${v.id}: citazione troppo lunga`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.verificato_il || '')) errori.push(`${v.id}: manca la data di verifica`);
  }
  if (errori.length) throw new Error(`data/fasce_garanzia.json non valido:\n- ${errori.join('\n- ')}`);
  return true;
}

export const TUTTE = dati.fasce;

function oraLeggibile(o) {
  if (o === 'inizio servizio' || o === 'fine servizio') return o;
  return o.replace(/^0(\d)/, '$1');
}

function intervallo(f) {
  if (f.dalle === 'inizio servizio') return `da inizio servizio alle ${oraLeggibile(f.alle)}`;
  if (f.alle === 'fine servizio') return `dalle ${oraLeggibile(f.dalle)} a fine servizio`;
  return `dalle ${oraLeggibile(f.dalle)} alle ${oraLeggibile(f.alle)}`;
}

/** "nei giorni feriali dalle 6:00 alle 9:00 e dalle 18:00 alle 21:00; nei giorni festivi …" */
export function testoFasce(voce) {
  if (!voce.fasce || voce.fasce.length === 0) return null;
  const gruppi = new Map();
  for (const f of voce.fasce) {
    if (!gruppi.has(f.giorni)) gruppi.set(f.giorni, []);
    gruppi.get(f.giorni).push(intervallo(f));
  }
  const prefissi = { feriali: 'nei giorni feriali ', festivi: 'nei giorni festivi ', sabato: 'il sabato ', tutti: '' };
  return [...gruppi.entries()].map(([g, v]) => prefissi[g] + v.join(' e ')).join('; ');
}

const visibili = () => TUTTE.filter((v) => v.mostra !== false);

export function ferroviariePer(regione) {
  return visibili().filter((v) => v.tipo === 'ferroviario' && (v.ambito === 'nazionale' || (regione && chiaveLuogo(v.ambito) === chiaveLuogo(regione))));
}
export function aeree() { return visibili().filter((v) => v.tipo === 'aereo'); }
export function tplPerCitta(nomeCitta) { return visibili().filter((v) => v.tipo === 'tpl' && v.citta === nomeCitta); }
export function tplPerRegione(regione) { return visibili().filter((v) => v.tipo === 'tpl' && chiaveLuogo(v.regione) === chiaveLuogo(regione)); }
export function tplTutte() { return visibili().filter((v) => v.tipo === 'tpl'); }

/** Gruppi di fasce pertinenti per uno sciopero: [{ titolo, voci, aperto }]. */
export function fascePerSciopero(s) {
  const gruppi = [];
  const coinvolge = (x) => s.settore_slug === x || ((s.settore_slug === 'generale' || s.settore_slug === 'piu-settori') && !s.esclude_trasporti
    && !(s.esclusi || []).includes(x) && (s.coinvolti == null || s.coinvolti.includes(x)));
  const regione = s.zona_tipo === 'nazionale' ? null : s.regione;
  if (coinvolge('treni') || s.settore_slug === 'servizi-ferroviari') gruppi.push({ titolo: 'Treni', voci: ferroviariePer(regione), aperto: true });
  if (coinvolge('aerei')) gruppi.push({ titolo: 'Aerei', voci: aeree(), aperto: true });
  if (coinvolge('bus-metro')) {
    if (s.zona_tipo === 'provincia') {
      const c = cittaDaProvincia(s.provincia);
      gruppi.push({ titolo: 'Bus, tram e metro', voci: c ? tplPerCitta(c.nome) : [], aperto: true });
    } else if (s.zona_tipo === 'regione') {
      gruppi.push({ titolo: `Bus, tram e metro in ${s.regione}`, voci: tplPerRegione(s.regione), aperto: true });
    } else {
      gruppi.push({ titolo: 'Bus, tram e metro: città per città', voci: tplTutte(), aperto: false });
    }
  }
  return gruppi.filter((g) => g.voci.length);
}

function oraBreve(o) {
  if (o === 'inizio servizio' || o === 'fine servizio') return o;
  const [h, m] = o.split(':');
  return m === '00' ? String(+h) : `${+h}:${m}`;
}

/** Fasce valide nel giorno indicato: festive di domenica e nei festivi, altrimenti feriali (il sabato è feriale). */
function fasceDelGiorno(v, giorno) {
  const tipo = festivo(giorno) ? 'festivi' : 'feriali';
  const scelte = v.fasce.filter((f) => f.giorni === tipo || f.giorni === 'tutti');
  return scelte.length ? scelte : null;
}

function intervalloBreve(f) {
  if (f.dalle === 'inizio servizio') return `fino alle ${oraBreve(f.alle)}`;
  if (f.alle === 'fine servizio') return `dalle ${oraBreve(f.dalle)} a fine servizio`;
  return `${oraBreve(f.dalle)}-${oraBreve(f.alle)}`;
}

/** Prima parola significativa del nome dell'azienda (per riconoscerla nella categoria ufficiale). */
function siglaAzienda(v) {
  return String(v.azienda).replace(/\(.*\)/, '').trim().split(/\s+/)[0].toUpperCase();
}

/**
 * Riassunto breve per le schede, per esempio «Garantiti: treni regionali 6-9 e 18-21; aerei 7-10 e 18-21».
 * Per bus e metro si usa una fonte solo se la sua azienda compare nella categoria ufficiale dello sciopero
 * (mai attribuire a un'azienda le fasce di un'altra). Restituisce null se non c'è nulla di certo da dire.
 */
export function fasceInBreve(s) {
  const giorno = s.inizio;
  const parti = [];
  const categoria = ` ${String(s.categoria || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ')} `;
  for (const g of fascePerSciopero(s)) {
    if (!g.aperto) continue;
    let voce = null;
    if (g.titolo === 'Treni') voce = g.voci.find((v) => v.fasce && v.fasce.length && v.ambito !== 'nazionale') || g.voci.find((v) => v.fasce && v.fasce.length);
    else if (g.titolo === 'Aerei') voce = g.voci.find((v) => v.fasce && v.fasce.length);
    else voce = g.voci.find((v) => v.fasce && v.fasce.length && categoria.includes(` ${siglaAzienda(v)} `));
    if (!voce) continue;
    const fasce = fasceDelGiorno(voce, giorno);
    if (!fasce) continue;
    const etichetta = g.titolo === 'Treni' ? 'treni regionali' : (g.titolo === 'Aerei' ? 'voli' : `bus e metro ${siglaAzienda(voce)}`);
    parti.push(`${etichetta} ${fasce.map(intervalloBreve).join(' e ')}`);
  }
  return parti.length ? `Garantiti: ${parti.join('; ')}` : null;
}

/** Una riga di testo per i calendari: solo voci con orari espliciti. */
export function fasceInUnaRiga(s) {
  const voci = fascePerSciopero(s).filter((g) => g.aperto).flatMap((g) => g.voci).filter((v) => v.fasce && v.fasce.length);
  if (!voci.length) return null;
  return voci.slice(0, 3).map((v) => `${v.azienda}: ${testoFasce(v)}`).join(' | ') + ". Verifica sempre l'avviso dell'azienda.";
}

function origineTesto(v) {
  if (v.origine === 'avviso' && v.avviso_del) return `avviso dell'azienda per lo sciopero di ${dataLunga(v.avviso_del)}`;
  if (v.origine === 'regola') return 'regole pubblicate dall\'azienda';
  return null;
}

function htmlVoce(v) {
  const nome = v.tipo === 'tpl' ? `${v.azienda} (${v.citta})` : v.azienda;
  const t = testoFasce(v);
  const verificato = `verificato il ${dataLunga(v.verificato_il).replace(/^\S+ /, '')}`;
  const linkAvvisi = v.pagina_scioperi_url ? `<a href="${urlSicuro(v.pagina_scioperi_url)}" rel="noopener">avvisi ufficiali${v.tipo === 'tpl' ? ` di ${e(v.azienda.replace(/ \(.*\)$/, ''))}` : ' sugli scioperi'}</a>` : '';
  if (!v.fasce_testo) {
    return `<li><strong>${e(nome)}</strong>: ${v.note ? e(v.note) : 'non abbiamo trovato una pagina ufficiale con le fasce garantite.'} Controlla gli ${linkAvvisi || 'avvisi dell\'azienda'}.</li>`;
  }
  const origine = origineTesto(v);
  const fonte = v.fonte_url ? `<a href="${urlSicuro(v.fonte_url)}" rel="noopener">${e(v.fonte_titolo || 'fonte ufficiale')}</a>` : e(v.fonte_titolo || '');
  const orari = t ? `${e(t)}.` : 'orari nel testo qui sotto.';
  return `<li><strong>${e(nome)}</strong>: ${orari}
<blockquote class="citazione">«${e(v.fasce_testo)}»</blockquote>
<p class="fonte">Fonte: ${fonte}${origine ? `, ${e(origine)}` : ''}; ${e(verificato)}.${linkAvvisi ? ` Controlla anche gli ${linkAvvisi}.` : ''}${v.note ? ` ${e(v.note)}` : ''}</p></li>`;
}

/** Blocco HTML con i gruppi di fasce. */
export function htmlFasce(gruppi, { titolo = 'Cosa resta garantito', intro = '' } = {}) {
  if (!gruppi.length) return '';
  const corpo = gruppi.map((g) => {
    const lista = `<ul class="elenco-fasce">${g.voci.map(htmlVoce).join('')}</ul>`;
    if (g.aperto) return `<h3>${e(g.titolo)}</h3>${lista}`;
    return `<details><summary>${e(g.titolo)}</summary>${lista}</details>`;
  }).join('');
  return `<section class="riquadro fasce" aria-labelledby="fasce-titolo">
<h2 id="fasce-titolo">${e(titolo)}</h2>
${intro ? `<p>${intro}</p>` : ''}
${corpo}
<p class="nota">Le fasce garantite possono cambiare da sciopero a sciopero: fanno fede gli avvisi ufficiali dell'azienda di trasporto. I treni e le corse partiti prima dell'inizio dello sciopero di solito arrivano a destinazione.</p>
</section>`;
}
