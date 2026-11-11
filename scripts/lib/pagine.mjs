// Modelli delle pagine. Ogni valore variabile passa da e() o urlSicuro().
import { e, urlSicuro, pagina } from './html.mjs';
import { dataLunga, dataMedia, dataOraRoma, aggiungiGiorni } from './date.mjs';
import { schedaModello, STATI, statoMostrato } from '../../src/js/schede.mjs';
import { costruisciElenchi, contaTesto } from '../../src/js/elenchi.mjs';
import { titoloPagina, luogoTesto, leggibile, orarioTesto, elencoSettoriTesto } from './presenta.mjs';
import { infoSettore } from './normalizza.mjs';
import { cittaDaProvincia, cittaDellaRegione, regioneDaNome } from './luoghi.mjs';
import { fascePerSciopero, htmlFasce, ferroviariePer, tplPerCitta, aeree, tplTutte, TUTTE as TUTTE_FASCE, testoFasce } from './fasce.mjs';
import { htmlDirittiVolo, htmlAlternative, htmlPubblicita, LINK_UE_DIRITTI_AEREI } from './affiliati.mjs';

const MIT_PAGINA = 'https://scioperi.mit.gov.it/mit2/public/scioperi';
const MIT_RSS = 'https://scioperi.mit.gov.it/mit2/public/scioperi/rss';
const MIT_NOTE_LEGALI = 'https://www.mit.gov.it/note-legali';
const CRUSCOTTO_PA = 'https://crusc-gepas.perlapa.gov.it/';

// ---------- Componenti ----------

export function maiuscolaIniziale(t) { return t ? t[0].toUpperCase() + t.slice(1) : t; }

export function htmlScheda(m, livello = 3) {
  const h = `h${Math.min(Math.max(livello, 2), 6)}`;
  return `<li class="${e(m.classe)}" data-id="${e(m.id)}">
<p class="scheda-etichette">${m.etichette.map((x) => `<span class="pill ${e(x.classe)}">${e(x.testo)}</span>`).join(' ')}</p>
<${h} class="scheda-titolo"><a href="${urlSicuro(m.url)}">${e(m.titolo)}</a></${h}>
<p class="scheda-quando">${e(m.quando)}${m.orario ? `<span class="scheda-orario">${e(m.orario)}</span>` : ''}</p>
${m.modalita ? `<p class="scheda-modalita">Orari: ${e(m.modalita)}</p>` : ''}${m.chi ? `<p class="scheda-chi">${e(m.chi)}</p>` : ''}${m.garantite ? `<p class="scheda-garantite">${e(m.garantite)}</p>` : ''}${m.sindacati ? `<p class="scheda-sindacati">Sindacati: ${e(m.sindacati)}</p>` : ''}
${m.note.map((n) => `<p class="scheda-nota">${e(n)}</p>`).join('')}${m.link ? `<p class="scheda-nota"><a href="${urlSicuro(m.link.url)}">${e(m.link.testo)}</a></p>` : ''}
</li>`;
}

function htmlGruppo(g, oggi, livello) {
  const principali = g.principali.map((s) => htmlScheda(schedaModello(s, oggi, { giorno: g.giorno }), livello)).join('\n');
  const altri = g.altri.length ? `<details class="altri"><summary>${g.altri.length === 1 ? 'Un altro sciopero' : `Altri ${g.altri.length} scioperi`} che di norma non toccano chi viaggia</summary>
<ul class="elenco-schede">${g.altri.map((s) => htmlScheda(schedaModello(s, oggi, { giorno: g.giorno }), livello)).join('\n')}</ul></details>` : '';
  const vuoto = !g.principali.length ? '<p class="nessuno">Nessuno sciopero per chi viaggia.</p>' : '';
  return `${vuoto}${principali ? `<ul class="elenco-schede">${principali}</ul>` : ''}${altri}`;
}

/** Sezioni Oggi / Domani / Prossimi (HTML statico; il browser le ricostruisce con la data del telefono). */
export function htmlElenchi(elenchi, oggi) {
  return elenchi.sezioni.map((sez) => {
    let corpo;
    if (sez.id !== 'prossimi') {
      const g = sez.giorni[0];
      corpo = (!g.principali.length && !g.altri.length) ? `<p class="nessuno">${e(sez.vuoto)}</p>` : htmlGruppo(g, oggi, 3);
    } else if (!sez.giorni.length) {
      corpo = `<p class="nessuno">${e(sez.vuoto)}</p>`;
    } else {
      corpo = sez.giorni.map((g) => `<h3 class="giorno-titolo">${e(maiuscolaIniziale(dataMedia(g.giorno)))}</h3>\n${htmlGruppo(g, oggi, 4)}`).join('\n');
    }
    return `<section id="${e(sez.id)}" class="giorno" aria-labelledby="t-${e(sez.id)}">
<h2 id="t-${e(sez.id)}">${e(sez.titolo)}${sez.data ? ` <span class="data-sezione">${e(sez.data)}</span>` : ''}</h2>
${corpo}
</section>`;
  }).join('\n');
}

export function htmlRiepilogo(conteggi, prossimiEtichetta = 'nei prossimi 7 giorni') {
  const voce = (id, n, eti) => `<a href="#${id}"><span class="num ${n ? 'alcuni' : 'zero'}">${n}</span><span class="eti">${e(eti)}</span></a>`;
  return `<nav class="riepilogo" id="riepilogo" aria-label="Riepilogo">
${voce('oggi', conteggi.oggi, `${n1(conteggi.oggi)} oggi`)}
${voce('domani', conteggi.domani, `${n1(conteggi.domani)} domani`)}
${voce('prossimi', conteggi.prossimi, `${n1(conteggi.prossimi)} ${prossimiEtichetta}`)}
</nav>`;
}
function n1(n) { return n === 1 ? 'sciopero' : 'scioperi'; }

/** Selettore di città e regioni (visibile solo con JavaScript). */
export function htmlSceltaLuogo(ctx, { id = 'scegli-luogo', etichetta = 'La tua città o regione', conTutta = true, settori = false } = {}) {
  const opzCitta = ctx.CITTA.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    .map((c) => `<option value="c:${e(c.slug)}" data-tipo="citta" data-provincia="${e(c.provincia)}" data-regione="${e(c.regione)}" data-nome="${e(c.nome)}">${e(c.nome)}</option>`).join('');
  const opzRegioni = ctx.REGIONI.map((r) => `<option value="r:${e(r.slug)}" data-tipo="regione" data-regione="${e(r.nome)}" data-nome="${e(r.nome)}">${e(r.nome)}</option>`).join('');
  const opzSettori = settori ? `<optgroup label="Settori (tutta Italia)">${ctx.settori.map((s) => `<option value="s:${e(s.slug)}" data-tipo="settore" data-nome="${e(s.nome)}">${e(s.nome)}</option>`).join('')}</optgroup>` : '';
  return `<div class="scegli solo-js">
<label for="${e(id)}">${e(etichetta)}</label>
<select id="${e(id)}" class="campo">
${conTutta ? '<option value="">Tutta Italia</option>' : ''}
<optgroup label="Città">${opzCitta}</optgroup>
<optgroup label="Regioni">${opzRegioni}</optgroup>
${opzSettori}
</select>
<p class="nota">La scelta resta solo su questo dispositivo: non la riceviamo.</p>
</div>`;
}

export function feedPer(ctx, nome) {
  const host = new URL(ctx.sito.urlBase).host;
  const percorso = `/ics/${nome}.ics`;
  return {
    https: `${ctx.sito.urlBase}${percorso}`,
    webcal: `webcal://${host}${percorso}`,
    google: `https://www.google.com/calendar/render?cid=webcal://${host}${percorso}`,
    percorso,
  };
}

export function htmlIscrizione(ctx, nome, titolo) {
  const f = feedPer(ctx, nome);
  return `<div class="feed" id="iscrizione" data-feed="${e(nome)}">
<h3 id="iscrizione-titolo">${e(titolo)}</h3>
<div class="bottoni">
<a class="btn" id="link-webcal" href="${urlSicuro(f.webcal)}">Aggiungi su iPhone o Mac</a>
<a class="btn btn-secondario" id="link-google" href="${urlSicuro(f.google)}" rel="noopener">Aggiungi a Google Calendar (Android)</a>
</div>
<p class="nota">Altro calendario (Outlook e simili)? Copia questo indirizzo e aggiungilo come "calendario da Internet":<br><code class="codice" id="link-https">${e(f.https)}</code> <button type="button" class="btn btn-piccolo btn-secondario solo-js-inline" data-copia="link-https">Copia</button></p>
</div>`;
}

export function htmlNotaCalendario() {
  return `<p class="nota"><strong>Quanto è veloce?</strong> Il calendario si aggiorna da solo, ma i tempi li decide il telefono. Sull'iPhone puoi scegliere ogni quanto controllare (Impostazioni › Calendario › Account › Scarica nuovi dati). Google Calendar invece può metterci 12 ore o anche di più, e non si può accelerare. Per le revoche dell'ultimo minuto controlla il sito il giorno prima.</p>`;
}

function htmlAssistente(compatto = false) {
  return `<section class="chat solo-js" id="assistente" aria-labelledby="assistente-titolo">
<h2 id="assistente-titolo">${compatto ? 'Hai una domanda?' : 'Fai la tua domanda'}</h2>
<p class="nota">Risposte automatiche dai dati ufficiali, senza intelligenza artificiale. Non scrivere dati personali: la domanda resta sul tuo dispositivo.</p>
<div class="chat-risposte" id="chat-risposte" aria-live="polite"></div>
<form class="chat-form" id="chat-form" action="#" autocomplete="off">
<label for="chat-domanda" class="nascosto">La tua domanda</label>
<input id="chat-domanda" class="campo" type="text" maxlength="200" placeholder="Es.: c'è sciopero domani a Milano?" enterkeyhint="send">
<button class="btn" type="submit">Chiedi</button>
</form>
<div class="suggerimenti" id="chat-suggerimenti" aria-label="Domande frequenti"></div>
</section>`;
}

function htmlBriciole(voci) {
  return `<nav class="percorso" aria-label="Sei qui"><ol>${voci.map(([testo, url]) => (url ? `<li><a href="${urlSicuro(url)}">${e(testo)}</a></li>` : `<li aria-current="page">${e(testo)}</li>`)).join('')}</ol></nav>`;
}

function aggiornatoTesto(ctx) {
  const t = ctx.stato.ultima_verifica_riuscita;
  // Senza "X minuti fa" aggiunto da JavaScript: allungherebbe il paragrafo dopo il caricamento e sposterebbe la pagina.
  return t ? `Ultimo controllo della fonte ufficiale: <time datetime="${e(t)}">${e(dataOraRoma(t))}</time>.` : '';
}

// ---------- Pagine ----------

export function paginaHome(ctx) {
  const elenchi = costruisciElenchi(ctx.compatti, ctx.oggi, { giorniAvanti: 7 });
  const citta = ['roma', 'milano', 'napoli', 'torino', 'palermo', 'genova', 'bologna', 'firenze', 'bari', 'catania', 'venezia', 'verona'].map((s) => ctx.CITTA.find((c) => c.slug === s)).filter(Boolean);
  const corpo = `<section class="apertura">
<h1>Scioperi dei trasporti: oggi, domani e nei prossimi giorni</h1>
<p class="sotto">Treni, aerei, bus e metro in tutta Italia, dal calendario ufficiale del Ministero dei Trasporti. ${aggiornatoTesto(ctx)}</p>
</section>
${htmlSceltaLuogo(ctx)}
<p class="vista" id="vista">Stai vedendo: <strong id="vista-nome">tutta Italia</strong>.</p>
${htmlRiepilogo(elenchi.conteggi)}
<div id="elenchi" data-giorni="7">
${htmlElenchi(elenchi, ctx.oggi)}
</div>
${htmlAssistente(true)}
<section class="riquadro" aria-labelledby="cal-titolo">
<h2 id="cal-titolo">Gli scioperi nel calendario del telefono</h2>
<p>Iscriviti al calendario della tua città: gli scioperi compaiono da soli, con gli orari, e si aggiornano se vengono revocati.</p>
<p><a class="btn" href="/calendario/">Scegli il tuo calendario</a></p>
</section>
<section aria-labelledby="citta-titolo">
<h2 id="citta-titolo">Città principali</h2>
<ul class="griglia-link">${citta.map((c) => `<li><a href="/citta/${e(c.slug)}/">${e(c.nome)}</a></li>`).join('')}</ul>
<p><a href="/citta/">Tutte le città e le regioni</a> · <a href="/settore/">Scioperi per settore</a></p>
</section>
${htmlPubblicita(ctx.aff)}`;
  return pagina({
    sito: ctx.sito, versione: ctx.versione, percorso: '/', tipoPagina: 'home',
    titolo: 'scioperi dei trasporti oggi e domani',
    titoloCompleto: `Scioperi oggi e domani: treni, aerei, bus e metro | ${ctx.sito.nome}`,
    descrizione: ctx.sito.descrizione,
    corpo,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: ctx.sito.nome, url: `${ctx.sito.urlBase}/`, inLanguage: 'it' },
  });
}

function eventStatus(stato) {
  if (stato === 'revocato' || stato === 'rimosso') return 'https://schema.org/EventCancelled';
  if (stato === 'differito') return 'https://schema.org/EventRescheduled';
  return 'https://schema.org/EventScheduled';
}

function istanteLd(giorno, ora) {
  return ora ? `${giorno}T${ora}:00` : giorno;
}

export function jsonLdSciopero(ctx, s) {
  const url = `${ctx.sito.urlBase}/sciopero/${s.slug}/`;
  const c = s.zona_tipo === 'provincia' ? cittaDaProvincia(s.provincia) : null;
  const indirizzo = { '@type': 'PostalAddress', addressCountry: 'IT' };
  if (s.zona_tipo !== 'nazionale') indirizzo.addressRegion = s.regione;
  if (s.zona_tipo === 'provincia') indirizzo.addressLocality = c ? c.nome : leggibile(s.provincia);
  const o = s.orario && s.orario.tipo === 'orario' ? s.orario : null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: titoloPagina(s),
    description: `${leggibile(s.categoria)}. ${orarioTesto(s) || leggibile(s.modalita)}. Fonte: Ministero delle Infrastrutture e dei Trasporti.`,
    startDate: istanteLd(s.inizio, o ? o.dalle : null),
    endDate: o ? istanteLd(o.giornoFine, o.alle) : s.fine,
    eventStatus: eventStatus(s.stato),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: luogoTesto(s), address: indirizzo },
    image: [`${ctx.sito.urlBase}/og/${s.slug}.png`],
    url,
  };
  if (s.sindacati) ld.organizer = { '@type': 'Organization', name: s.sindacati };
  if (s.stato === 'differito' && s.inizio_precedente) ld.previousStartDate = s.inizio_precedente;
  return ld;
}

export function testoCondivisione(ctx, s) {
  const stato = statoMostrato({ ...ctx.compattiPerId.get(s.id) }, ctx.oggi);
  const pref = stato === 'revocato' ? 'REVOCATO: ' : (stato === 'differito' ? 'RINVIATO: ' : '');
  const orario = orarioTesto(s);
  return `${pref}${titoloPagina(s)}${orario ? ` (${orario})` : ''}. Dettagli e aggiornamenti: ${ctx.sito.urlBase}/sciopero/${s.slug}/`;
}

export function paginaSciopero(ctx, s) {
  const c = ctx.compattiPerId.get(s.id);
  const stato = statoMostrato(c, ctx.oggi);
  const info = STATI[stato];
  const settore = infoSettore(s.settore);
  const titolo = titoloPagina(s);
  const orario = orarioTesto(s);
  const zona = s.zona_tipo === 'provincia' ? cittaDaProvincia(s.provincia) : null;
  const regione = s.zona_tipo !== 'nazionale' ? regioneDaNome(s.regione) : null;
  const wa = `https://wa.me/?text=${encodeURIComponent(testoCondivisione(ctx, s))}`;
  const nuovo = s.differito_a ? ctx.perSlug.get(s.differito_a) : null;
  const vecchio = s.differito_da ? ctx.perSlug.get(s.differito_da) : null;
  const avvisoStato = [];
  if (stato !== 'confermato') avvisoStato.push(`<p class="avviso ${stato === 'differito' ? 'avviso-attenzione' : 'avviso-errore'}">${e(info.spiegazione)}${nuovo ? ` <a href="/sciopero/${e(nuovo.slug)}/">Vai allo sciopero del ${e(dataMedia(nuovo.inizio))}</a>.` : ''}${s.inizio_precedente && !nuovo ? ` Prima era previsto per ${e(dataLunga(s.inizio_precedente))}.` : ''}</p>`);
  if (vecchio) avvisoStato.push(`<p class="avviso avviso-attenzione">Questo sciopero sostituisce quello previsto per ${e(dataLunga(vecchio.inizio))}, che il Ministero ha tolto dal calendario.</p>`);
  if (s.esclude_trasporti) avvisoStato.push('<p class="avviso avviso-ok">Secondo il Ministero questo sciopero generale <strong>esclude il settore dei trasporti</strong>: treni, aerei, bus e metro non dovrebbero fermarsi per questo sciopero.</p>');
  const fatti = [
    ['Quando', maiuscolaIniziale(s.inizio === s.fine ? dataLunga(s.inizio) : `da ${dataLunga(s.inizio)} a ${dataLunga(s.fine)}`), 'grande'],
    ['Orari', orario || leggibile(s.modalita) || 'non comunicati', ''],
    ['Dove', luogoTesto(s), ''],
    ['Settore', settore.nome, ''],
  ];
  const coinvolti = (s.settore_slug === 'generale' || s.settore_slug === 'piu-settori') && !s.esclude_trasporti
    ? (s.coinvolti && s.coinvolti.length ? `Nel testo ufficiale sono citati: ${elencoSettoriTesto(s.coinvolti)}.` : 'Il testo ufficiale non indica i settori: può toccare tutti i trasporti.') : null;
  const esclusi = s.esclusi && s.esclusi.length && !s.esclude_trasporti ? `Esclusi secondo il testo ufficiale: ${elencoSettoriTesto(s.esclusi)}.` : null;
  const anticipo = s.giorno_da && s.giorno_da < s.inizio ? `Per alcuni settori inizia già ${dataLunga(s.giorno_da)}: leggi gli orari.` : null;
  const gruppiFasce = fascePerSciopero(s);
  const aereo = s.settore_slug === 'aerei' || ((s.settore_slug === 'generale' || s.settore_slug === 'piu-settori') && !s.esclude_trasporti && !(s.esclusi || []).includes('aerei') && (s.coinvolti == null || s.coinvolti.includes('aerei')));
  const viaggio = ['treni', 'aerei', 'generale', 'piu-settori'].includes(s.settore_slug) && !s.esclude_trasporti && stato !== 'revocato' && stato !== 'concluso';
  const feedLuogo = zona ? { nome: `citta-${zona.slug}`, titolo: `Scioperi a ${zona.nome}` } : (regione ? { nome: `regione-${regione.slug}`, titolo: `Scioperi in ${regione.nome}` } : { nome: `settore-${settore.slug}`, titolo: `Scioperi: ${settore.nome.toLowerCase()} (tutta Italia)` });
  const storia = (s.storia || []).filter((x) => x.tipo !== 'concluso');
  const dettagli = [
    ['Settore', s.settore], ['Rilevanza', s.rilevanza], ['Regione', s.regione], ['Provincia', s.provincia || 'Tutte'],
    ['Modalità', s.modalita], ['Categoria interessata', s.categoria], ['Sindacati', s.sindacati], ['Note', s.note],
    ['Data proclamazione', s.proclamazione ? dataLunga(s.proclamazione) : ''], ['Data ricezione', s.ricezione ? dataLunga(s.ricezione) : ''],
  ].filter(([, v]) => v);
  const briciole = [['Home', '/'], [settore.nome, `/settore/${settore.slug}/`]];
  if (zona) briciole.push([zona.nome, `/citta/${zona.slug}/`]);
  else if (regione) briciole.push([regione.nome, `/regione/${regione.slug}/`]);
  briciole.push([maiuscolaIniziale(dataMedia(s.inizio)), null]);
  const corpo = `${htmlBriciole(briciole)}
<article class="sciopero" data-id="${e(s.id)}">
<h1>${e(titolo)}</h1>
<p class="stato-grande ${e(info.classe)}">${e(info.testo)}</p>
${avvisoStato.join('\n')}
<p class="sottotitolo">${e(leggibile(s.categoria))}</p>
<ul class="fatti">
${fatti.map(([eti, val, cl]) => `<li><span class="eti">${e(eti)}</span><span class="val ${cl}">${e(val)}</span></li>`).join('\n')}
${anticipo ? `<li class="largo"><span class="eti">Attenzione</span><span class="val">${e(anticipo)}</span></li>` : ''}
${coinvolti ? `<li class="largo"><span class="eti">Settori</span><span class="val">${e(coinvolti)}</span></li>` : ''}
${esclusi ? `<li class="largo"><span class="eti">Esclusi</span><span class="val">${e(esclusi)}</span></li>` : ''}
${s.note ? `<li class="largo"><span class="eti">Note del Ministero</span><span class="val">${e(leggibile(s.note))}</span></li>` : ''}
${s.sindacati ? `<li class="largo"><span class="eti">Sindacati</span><span class="val">${e(s.sindacati)}</span></li>` : ''}
</ul>
<div class="bottoni">
<a class="btn btn-whatsapp" href="${urlSicuro(wa)}" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>Manda su WhatsApp</a>
<a class="btn btn-secondario" href="/ics/sciopero/${e(s.slug)}.ics">Aggiungi al calendario</a>
<button type="button" class="btn btn-secondario solo-js-inline" data-condividi="${e(`${ctx.sito.urlBase}/sciopero/${s.slug}/`)}" data-titolo="${e(titolo)}">Condividi</button>
</div>
${htmlFasce(gruppiFasce)}
${aereo ? htmlDirittiVolo(s, ctx.aff) : ''}
${viaggio ? htmlAlternative(s, ctx.aff) : ''}
<section class="riquadro" aria-labelledby="iscr-titolo">
<h2 id="iscr-titolo">Non perdere i prossimi</h2>
<p>Metti nel calendario del telefono tutti gli scioperi ${zona ? `di ${e(zona.nome)}` : (regione ? `della regione ${e(regione.nome)}` : `del settore ${e(settore.nome.toLowerCase())}`)}: si aggiornano da soli.</p>
${htmlIscrizione(ctx, feedLuogo.nome, feedLuogo.titolo)}
${htmlNotaCalendario()}
</section>
<section aria-labelledby="ufficiale-titolo">
<h2 id="ufficiale-titolo">Il testo ufficiale</h2>
<dl class="dettagli">${dettagli.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>
<p class="fonte-mit">Fonte: <a href="${MIT_PAGINA}" rel="noopener">calendario degli scioperi del Ministero delle Infrastrutture e dei Trasporti</a>${ctx.archivio.fonte?.aggiornato_al ? `, aggiornato dal Ministero al ${e(ctx.archivio.fonte.aggiornato_al)}` : ''}. Codice dello sciopero nel calendario: ${e(s.id)}. Visto per la prima volta: ${e(dataOraRoma(s.visto_prima))}.</p>
</section>
${storia.length ? `<section aria-labelledby="storia-titolo"><h2 id="storia-titolo">Cosa è cambiato</h2><ul>${storia.map((x) => `<li><time datetime="${e(x.quando)}">${e(dataOraRoma(x.quando))}</time>: ${e(x.testo)}</li>`).join('')}</ul></section>` : ''}
<p class="nota">Le informazioni possono cambiare fino all'ultimo momento: prima di partire verifica con la tua azienda di trasporto.</p>
</article>
${htmlPubblicita(ctx.aff)}`;
  const vecchioSciopero = statoMostrato(c, ctx.oggi) === 'concluso' || ((stato === 'revocato' || stato === 'rimosso') && (s.giorno_a || s.fine) < ctx.oggi);
  return pagina({
    sito: ctx.sito, versione: ctx.versione, percorso: `/sciopero/${s.slug}/`, tipoPagina: 'sciopero',
    titolo: `${stato === 'revocato' ? 'REVOCATO: ' : (stato === 'differito' ? 'RINVIATO: ' : '')}${titolo}`,
    descrizione: `${info.testo}. ${titolo}${orario ? `, ${orario}` : ''}. ${leggibile(s.categoria)}. Fasce garantite, calendario e aggiornamenti dai dati ufficiali.`.slice(0, 300),
    corpo,
    ogImmagine: `/og/${s.slug}.png`,
    ogAlt: `${info.testo}: ${titolo}`,
    ogTipo: 'article',
    jsonLd: jsonLdSciopero(ctx, s),
    noindex: vecchioSciopero,
  });
}

function htmlFasceCitta(c) {
  const gruppi = [];
  const tpl = tplPerCitta(c.nome);
  if (tpl.length) gruppi.push({ titolo: 'Bus, tram e metro', voci: tpl, aperto: true });
  gruppi.push({ titolo: 'Treni regionali', voci: ferroviariePer(c.regione), aperto: true });
  return htmlFasce(gruppi, { titolo: `Fasce garantite a ${c.nome}`, intro: 'Durante uno sciopero alcuni servizi restano garantiti per legge in alcune fasce orarie. Ecco quelle pubblicate dalle aziende.' });
}

function paginaZona(ctx, { percorso, titoloH1, intro, zona, settori, attributi, fasceHtml, feed, briciole, descrizione, titolo, extra = '' }) {
  const elenchi = costruisciElenchi(ctx.compatti, ctx.oggi, { zona, settori, giorniAvanti: 60 });
  const corpo = `${htmlBriciole(briciole)}
<h1>${e(titoloH1)}</h1>
<p class="sotto">${intro} ${aggiornatoTesto(ctx)}</p>
${htmlRiepilogo(elenchi.conteggi, 'più avanti')}
<div id="elenchi" data-giorni="60">
${htmlElenchi(elenchi, ctx.oggi)}
</div>
${fasceHtml || ''}
<section class="riquadro" aria-labelledby="iscr-titolo">
<h2 id="iscr-titolo">Nel calendario del telefono</h2>
${htmlIscrizione(ctx, feed.nome, feed.titolo)}
${htmlNotaCalendario()}
</section>
${extra}
${htmlPubblicita(ctx.aff)}`;
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso, tipoPagina: 'zona', titolo, descrizione, corpo, attributi });
}

export function paginaCitta(ctx, c) {
  const altre = cittaDellaRegione(ctx.REGIONI.find((r) => r.nome === c.regione)).filter((x) => x.slug !== c.slug);
  const regione = ctx.REGIONI.find((r) => r.nome === c.regione);
  const extra = `<section aria-labelledby="vicine-titolo"><h2 id="vicine-titolo">Vicino a ${e(c.nome)}</h2>
<ul class="griglia-link"><li><a href="/regione/${e(regione.slug)}/">Tutta la regione ${e(regione.nome)}</a></li>${altre.map((x) => `<li><a href="/citta/${e(x.slug)}/">${e(x.nome)}</a></li>`).join('')}</ul>
<p><a href="/incorpora/">Metti i prossimi scioperi di ${e(c.nome)} sul sito della tua scuola o azienda</a></p></section>`;
  return paginaZona(ctx, {
    percorso: `/citta/${c.slug}/`,
    titolo: `Scioperi a ${c.nome} oggi e domani: treni, bus, metro, aerei`,
    titoloH1: `Scioperi a ${c.nome}`,
    intro: `Scioperi che toccano ${e(c.nome)}: quelli locali, quelli della regione ${e(c.regione)} e quelli nazionali.`,
    descrizione: `Scioperi a ${c.nome} oggi, domani e nei prossimi giorni: bus, tram, metro, treni e aerei. Fasce garantite e calendario da aggiungere al telefono, dai dati ufficiali.`,
    zona: { tipo: 'citta', provincia: c.provincia, regione: c.regione },
    attributi: { 'zona-tipo': 'citta', 'zona-provincia': c.provincia, 'zona-regione': c.regione, 'zona-nome': c.nome },
    fasceHtml: htmlFasceCitta(c),
    feed: { nome: `citta-${c.slug}`, titolo: `Scioperi a ${c.nome}` },
    briciole: [['Home', '/'], ['Città', '/citta/'], [c.nome, null]],
    extra,
  });
}

export function paginaRegione(ctx, r) {
  const citta = cittaDellaRegione(r);
  const extra = citta.length ? `<section aria-labelledby="citta-reg-titolo"><h2 id="citta-reg-titolo">Città della regione</h2>
<ul class="griglia-link">${citta.map((x) => `<li><a href="/citta/${e(x.slug)}/">${e(x.nome)}</a></li>`).join('')}</ul></section>` : '';
  const gruppi = [{ titolo: 'Treni regionali', voci: ferroviariePer(r.nome), aperto: true }];
  return paginaZona(ctx, {
    percorso: `/regione/${r.slug}/`,
    titolo: `Scioperi in ${r.nome} oggi e domani`,
    titoloH1: `Scioperi in ${r.nome}`,
    intro: `Scioperi che toccano la regione ${e(r.nome)}: locali, regionali e nazionali.`,
    descrizione: `Scioperi in ${r.nome} oggi, domani e nei prossimi giorni: treni, bus, metro, aerei e traghetti, dai dati ufficiali del Ministero.`,
    zona: { tipo: 'regione', regione: r.nome },
    attributi: { 'zona-tipo': 'regione', 'zona-regione': r.nome, 'zona-nome': r.nome },
    fasceHtml: htmlFasce(gruppi, { titolo: `Fasce garantite in ${r.nome}`, intro: 'Per bus, tram e metro le fasce cambiano da città a città: le trovi nelle pagine delle città.' }),
    feed: { nome: `regione-${r.slug}`, titolo: `Scioperi in ${r.nome}` },
    briciole: [['Home', '/'], ['Città', '/citta/'], [r.nome, null]],
    extra,
  });
}

export function paginaSettore(ctx, st) {
  let gruppi = [];
  if (st.slug === 'treni' || st.slug === 'servizi-ferroviari') gruppi = [{ titolo: 'Treni in tutta Italia', voci: ferroviariePer(null), aperto: true },
    { titolo: 'Treni regionali con regole proprie', voci: TUTTE_FASCE.filter((v) => v.tipo === 'ferroviario' && v.mostra !== false && v.ambito !== 'nazionale'), aperto: true }];
  if (st.slug === 'aerei') gruppi = [{ titolo: 'Aerei', voci: aeree(), aperto: true }];
  if (st.slug === 'bus-metro') gruppi = [{ titolo: 'Città per città', voci: tplTutte(), aperto: false }];
  return paginaZona(ctx, {
    percorso: `/settore/${st.slug}/`,
    titolo: `Scioperi ${st.breve} oggi e domani`,
    titoloH1: `Scioperi: ${st.nome.toLowerCase()}`,
    intro: `${e(st.descrizione)} Sono inclusi anche gli scioperi generali e di più settori che lo riguardano.`,
    descrizione: `Scioperi ${st.breve} in Italia oggi, domani e nei prossimi giorni, con fasce garantite e calendario, dai dati ufficiali del Ministero.`,
    zona: null,
    settori: [st.slug],
    attributi: { settore: st.slug },
    fasceHtml: htmlFasce(gruppi.filter((g) => g.voci.length), { titolo: 'Fasce garantite' }),
    feed: { nome: `settore-${st.slug}`, titolo: `Scioperi: ${st.nome.toLowerCase()}` },
    briciole: [['Home', '/'], ['Settori', '/settore/'], [st.nome, null]],
  });
}

export function paginaElencoCitta(ctx) {
  const corpo = `${htmlBriciole([['Home', '/'], ['Città e regioni', null]])}
<h1>Scioperi per città e regione</h1>
<p class="sotto">Scegli la tua città o la tua regione: vedi gli scioperi locali, regionali e nazionali che ti riguardano.</p>
${ctx.REGIONI.map((r) => {
    const citta = cittaDellaRegione(r);
    return `<section aria-labelledby="reg-${e(r.slug)}"><h2 id="reg-${e(r.slug)}"><a href="/regione/${e(r.slug)}/">${e(r.nome)}</a></h2>
${citta.length ? `<ul class="griglia-link">${citta.map((c) => `<li><a href="/citta/${e(c.slug)}/">${e(c.nome)}</a></li>`).join('')}</ul>` : ''}</section>`;
  }).join('\n')}`;
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso: '/citta/', tipoPagina: 'elenco', titolo: 'Scioperi per città e regione', descrizione: 'Scioperi dei trasporti in ogni regione e nelle principali città italiane: bus, tram, metro, treni e aerei, dai dati ufficiali.', corpo });
}

export function paginaElencoSettori(ctx) {
  const corpo = `${htmlBriciole([['Home', '/'], ['Settori', null]])}
<h1>Scioperi per settore</h1>
<p class="sotto">Il Ministero divide gli scioperi dei trasporti in settori. Ecco cosa significa ciascuno.</p>
<ul class="elenco-settori">${ctx.settori.map((s) => `<li><h2><a href="/settore/${e(s.slug)}/">${e(s.nome)}</a></h2><p>${e(s.descrizione)}</p></li>`).join('')}</ul>`;
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso: '/settore/', tipoPagina: 'elenco', titolo: 'Scioperi per settore', descrizione: 'Scioperi di treni, aerei, bus e metro, traghetti, taxi e altri settori dei trasporti in Italia, dai dati ufficiali.', corpo });
}

export function elencoFeed(ctx) {
  return [
    { nome: 'italia', titolo: 'Tutti gli scioperi in Italia', gruppo: 'Tutta Italia' },
    ...ctx.CITTA.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map((c) => ({ nome: `citta-${c.slug}`, titolo: `Scioperi a ${c.nome}`, gruppo: 'Città', valore: `c:${c.slug}` })),
    ...ctx.REGIONI.map((r) => ({ nome: `regione-${r.slug}`, titolo: `Scioperi in ${r.nome}`, gruppo: 'Regioni', valore: `r:${r.slug}` })),
    ...ctx.settori.map((s) => ({ nome: `settore-${s.slug}`, titolo: `Scioperi: ${s.nome.toLowerCase()} (tutta Italia)`, gruppo: 'Settori', valore: `s:${s.slug}` })),
  ];
}

export function paginaCalendario(ctx) {
  const feed = elencoFeed(ctx);
  const gruppi = ['Tutta Italia', 'Città', 'Regioni', 'Settori'];
  const corpo = `${htmlBriciole([['Home', '/'], ['Calendario', null]])}
<h1>Gli scioperi nel calendario del telefono</h1>
<p class="sotto">Scegli la tua città, la tua regione o un settore: gli scioperi compaiono da soli nel calendario, con orari e fasce garantite, e si aggiornano se vengono revocati o rinviati. Gratis, senza registrazione.</p>
${htmlSceltaLuogo(ctx, { id: 'scegli-feed', etichetta: 'Quale calendario vuoi?', settori: true })}
${htmlIscrizione(ctx, 'italia', 'Tutti gli scioperi in Italia')}
${htmlNotaCalendario()}
<section aria-labelledby="come-titolo">
<h2 id="come-titolo">Come si fa</h2>
<h3>iPhone e iPad</h3>
<p>Tocca «Aggiungi su iPhone o Mac» e poi «Iscriviti». Fatto.</p>
<h3>Android e Google Calendar</h3>
<p>Tocca «Aggiungi a Google Calendar»: si apre Google Calendar, conferma con «Aggiungi». Se dal telefono non funziona, apri lo stesso link dal computer. Poi, nell'app Google Calendar del telefono, controlla che il nuovo calendario sia attivo (Impostazioni › nome del calendario › Sincronizza).</p>
<h3>Computer (Outlook e altri)</h3>
<p>Copia l'indirizzo che inizia con https e aggiungilo come «calendario da Internet» o «iscrizione a calendario».</p>
<p class="nota">Nei calendari delle città e delle regioni non mettiamo gli scioperi del solo trasporto merci, che di norma non fermano i passeggeri. Li trovi nel calendario del settore merci.</p>
</section>
<details class="tutti-feed"><summary>Tutti i calendari disponibili</summary>
${gruppi.map((g) => `<h3>${e(g)}</h3><ul class="elenco-feed">${feed.filter((f) => f.gruppo === g).map((f) => {
    const x = feedPer(ctx, f.nome);
    return `<li>${e(f.titolo)}: <a href="${urlSicuro(x.webcal)}">iPhone</a> · <a href="${urlSicuro(x.google)}" rel="noopener">Google</a> · <a href="${urlSicuro(x.percorso)}">file</a></li>`;
  }).join('')}</ul>`).join('\n')}
</details>`;
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso: '/calendario/', tipoPagina: 'calendario', titolo: 'Gli scioperi nel calendario del telefono', descrizione: 'Aggiungi gli scioperi della tua città al calendario di iPhone, Android o Google: si aggiornano da soli, anche quando vengono revocati.', corpo });
}

export function paginaAssistente(ctx) {
  const corpo = `${htmlBriciole([['Home', '/'], ['Assistente', null]])}
<h1>Chiedi all'assistente</h1>
<p class="sotto">Scrivi la tua domanda come la diresti a voce: «c'è sciopero domani a Milano?», «treni venerdì», «fasce garantite Roma». L'assistente cerca negli scioperi ufficiali e ti risponde con i link giusti.</p>
${htmlAssistente(false)}
<noscript><p class="avviso">L'assistente funziona solo con JavaScript attivo. Puoi comunque vedere <a href="/">gli scioperi di oggi e domani</a> e le <a href="/citta/">pagine delle città</a>.</p></noscript>
<section aria-labelledby="cosa-titolo">
<h2 id="cosa-titolo">Cosa sa fare</h2>
<ul>
<li>Capisce date come oggi, domani, venerdì, «14 novembre», «14/11», questo fine settimana, la prossima settimana.</li>
<li>Riconosce città, regioni, settori (treni, aerei, bus e metro, traghetti, taxi) e aziende come Trenitalia, Italo, ATM, ATAC.</li>
<li>Risponde su fasce garantite, rimborsi e calendario.</li>
</ul>
<p>Non usa intelligenza artificiale e non invia la tua domanda a nessuno: funziona tutto sul tuo dispositivo. Se non sa rispondere, te lo dice.</p>
</section>`;
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso: '/assistente/', tipoPagina: 'assistente', titolo: "Chiedi all'assistente sugli scioperi", descrizione: "Chiedi se c'è sciopero domani nella tua città, quali sono le fasce garantite o come avere il rimborso: risposte immediate dai dati ufficiali, senza intelligenza artificiale.", corpo });
}

export function paginaIncorpora(ctx) {
  const esempio = ctx.CITTA.find((c) => c.slug === 'milano') || ctx.CITTA[0];
  const codice = (c) => `<iframe src="${ctx.sito.urlBase}/widget/${c.slug}/" title="Prossimi scioperi a ${c.nome}" width="100%" height="380" style="border:0" loading="lazy"></iframe>`;
  const corpo = `${htmlBriciole([['Home', '/'], ['Widget', null]])}
<h1>I prossimi scioperi sul tuo sito</h1>
<p class="sotto">Per scuole, aziende, condomini e associazioni: un riquadro gratuito con i prossimi scioperi della tua città, che si aggiorna da solo. Nessun cookie e nessun tracciamento.</p>
${htmlSceltaLuogo(ctx, { id: 'scegli-widget', etichetta: 'Città', conTutta: false })}
<label for="codice-widget">Copia questo codice nella pagina del tuo sito:</label>
<textarea id="codice-widget" class="codice" readonly rows="4" data-base="${e(ctx.sito.urlBase)}">${e(codice(esempio))}</textarea>
<p><button type="button" class="btn btn-secondario solo-js-inline" data-copia="codice-widget">Copia il codice</button> <a class="btn btn-secondario" id="anteprima-widget" href="/widget/${e(esempio.slug)}/">Guarda l'anteprima</a></p>
<details><summary>Indirizzi di tutti i widget</summary><ul class="elenco-feed">${ctx.CITTA.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map((c) => `<li><a href="/widget/${e(c.slug)}/">${e(c.nome)}</a>: <code class="codice">${e(`${ctx.sito.urlBase}/widget/${c.slug}/`)}</code></li>`).join('')}</ul></details>`;
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso: '/incorpora/', tipoPagina: 'incorpora', titolo: 'Widget con i prossimi scioperi per il tuo sito', descrizione: 'Inserisci gratis nel sito della tua scuola, azienda o condominio un riquadro con i prossimi scioperi della tua città, sempre aggiornato.', corpo });
}

/** Pagina del widget: autonoma, senza JavaScript, incorporabile in altri siti. */
export function paginaWidget(ctx, c) {
  const fine = aggiungiGiorni(ctx.oggi, 30);
  const zona = { tipo: 'citta', provincia: c.provincia, regione: c.regione };
  const elenchi = costruisciElenchi(ctx.compatti, ctx.oggi, { zona, giorniAvanti: 30 });
  const visti = new Set();
  const lista = [];
  for (const sez of elenchi.sezioni) for (const g of sez.giorni) for (const s of g.principali) {
    if (visti.has(s.id) || lista.length >= 6) continue;
    visti.add(s.id); lista.push({ s, giorno: g.giorno });
  }
  const voci = lista.map(({ s }) => {
    const m = schedaModello(s, ctx.oggi);
    const stato = statoMostrato(s, ctx.oggi);
    const quando = s.inizio === s.fine ? dataMedia(s.inizio) : `${dataMedia(s.inizio)} - ${dataMedia(s.fine)}`;
    return `<li class="${stato === 'revocato' || stato === 'rimosso' ? 'revocato' : ''}"><span class="q">${e(quando[0].toUpperCase() + quando.slice(1))}</span><br>
<a href="${e(`${ctx.sito.urlBase}${m.url}`)}" target="_blank" rel="noopener">${e(m.titolo)}</a><br><span class="s">${e([m.orario, m.etichette[0].testo, m.sindacati ? `sindacati: ${m.sindacati}` : null].filter(Boolean).join(' · '))}</span></li>`;
  }).join('\n');
  const aggiornato = ctx.stato.ultima_verifica_riuscita ? dataOraRoma(ctx.stato.ultima_verifica_riuscita) : dataLunga(ctx.oggi);
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Prossimi scioperi a ${e(c.nome)}</title>
<link rel="icon" href="/icona.svg" type="image/svg+xml">
<link rel="stylesheet" href="/widget/stile.css?v=${e(ctx.versione)}">
</head>
<body>
<h1>Prossimi scioperi a ${e(c.nome)}</h1>
${voci ? `<ul>${voci}</ul>` : `<p class="ok">Nessuno sciopero in calendario nei prossimi 30 giorni (fino a ${e(dataMedia(fine))}).</p>`}
<p class="pie">Dati ufficiali del Ministero dei Trasporti, controllati il ${e(aggiornato)}. <a href="${e(`${ctx.sito.urlBase}/citta/${c.slug}/`)}" target="_blank" rel="noopener">Dettagli e fasce garantite su ${e(ctx.sito.dominio)}</a></p>
</body>
</html>
`;
}

function paginaTesto(ctx, { percorso, titolo, descrizione, corpo, noindex = false }) {
  return pagina({ sito: ctx.sito, versione: ctx.versione, percorso, tipoPagina: 'testo', titolo, descrizione, noindex, corpo: `${htmlBriciole([['Home', '/'], [titolo, null]])}\n<article class="testo">\n<h1>${e(titolo)}</h1>\n${corpo}\n</article>` });
}

export function paginaComeFunziona(ctx) {
  return paginaTesto(ctx, {
    percorso: '/come-funziona/', titolo: 'Come funziona',
    descrizione: `Come ${ctx.sito.nome} raccoglie gli scioperi dal calendario ufficiale del Ministero, cosa vogliono dire confermato, revocato e rinviato, e quali sono i limiti.`,
    corpo: `<p>${e(ctx.sito.nome)} risponde a una domanda: <strong>lo sciopero tocca me, e quando?</strong></p>
<h2>Da dove vengono i dati</h2>
<p>Ogni 30 minuti leggiamo il <a href="${MIT_PAGINA}" rel="noopener">calendario ufficiale degli scioperi</a> pubblicato dall'Osservatorio sui conflitti sindacali del Ministero delle Infrastrutture e dei Trasporti. È la fonte che raccoglie gli scioperi proclamati nei trasporti in tutta Italia. Non inventiamo e non aggiungiamo scioperi.</p>
<p>Se la fonte non risponde o manda dati strani, non pubblichiamo nulla di nuovo: teniamo gli ultimi dati controllati e lo scriviamo in alto nelle pagine. Lo stato dei controlli è sulla pagina <a href="/stato/">Stato degli aggiornamenti</a>.</p>
<h2>Cosa vogliono dire le etichette</h2>
<ul>
<li><strong>${e(STATI.confermato.testo)}</strong>: ${e(STATI.confermato.spiegazione)}</li>
<li><strong>${e(STATI.revocato.testo)}</strong>: ${e(STATI.revocato.spiegazione)} Il Ministero infatti non segnala le revoche: uno sciopero revocato sparisce dal calendario.</li>
<li><strong>${e(STATI.differito.testo)}</strong>: la data è cambiata, oppure il Ministero ha tolto lo sciopero e ne ha pubblicato uno identico in un altro giorno.</li>
<li><strong>${e(STATI.rimosso.testo)}</strong>: ${e(STATI.rimosso.spiegazione)}</li>
<li><strong>${e(STATI.concluso.testo)}</strong>: ${e(STATI.concluso.spiegazione)}</li>
</ul>
<p>I testi ufficiali del Ministero sono scritti in maiuscolo: li rendiamo più leggibili, e in ogni pagina di sciopero trovi anche il testo originale.</p>
<h2>Fasce garantite</h2>
<p>Per legge (legge 146 del 1990) durante gli scioperi dei trasporti alcuni servizi restano garantiti in certe fasce orarie. Le fasce cambiano da azienda ad azienda e a volte da sciopero a sciopero. Mostriamo solo quelle che abbiamo letto sui siti ufficiali delle aziende, con il link e la data in cui le abbiamo controllate. Se non abbiamo trovato una fonte ufficiale, non scriviamo orari: mettiamo il link agli avvisi dell'azienda.</p>
<h2>Calendario sul telefono</h2>
<p>Dalla pagina <a href="/calendario/">Calendario</a> puoi iscriverti agli scioperi della tua città, della tua regione o di un settore. Il calendario si aggiorna da solo, anche con le revoche, ma con i tempi del tuo telefono: Google Calendar può metterci più di 12 ore. Per questo, il giorno prima di partire, controlla il sito.</p>
<h2>Assistente</h2>
<p>L'<a href="/assistente/">assistente</a> non usa intelligenza artificiale: riconosce date, città e settori e cerca negli stessi dati del sito. Funziona tutto sul tuo dispositivo e non manda la tua domanda a nessuno.</p>
<h2>Cosa non trovi qui</h2>
<p>Solo scioperi dei trasporti. Per scuola, sanità e altri uffici pubblici consulta il <a href="${CRUSCOTTO_PA}" rel="noopener">cruscotto degli scioperi della Funzione Pubblica</a>.</p>
<h2>I limiti</h2>
<p>Possono esserci ritardi o errori, nostri o della fonte. Le adesioni allo sciopero non sono prevedibili: anche durante uno sciopero molti mezzi possono circolare. Prima di partire, verifica sempre con la tua azienda di trasporto.</p>`,
  });
}

export function paginaFonti(ctx) {
  const righe = TUTTE_FASCE.filter((v) => v.mostra !== false).map((v) => `<tr><td>${e(v.azienda)}${v.citta ? ` (${e(v.citta)})` : ''}</td><td>${v.fasce_testo ? e(testoFasce(v) || 'vedi citazione') : 'non trovate'}</td><td>${v.fonte_url ? `<a href="${urlSicuro(v.fonte_url)}" rel="noopener">${e(v.fonte_titolo || 'fonte')}</a>` : (v.pagina_scioperi_url ? `<a href="${urlSicuro(v.pagina_scioperi_url)}" rel="noopener">avvisi dell'azienda</a>` : '')}</td><td>${e(v.verificato_il)}</td></tr>`).join('');
  return paginaTesto(ctx, {
    percorso: '/fonti/', titolo: 'Fonti dei dati',
    descrizione: 'Le fonti ufficiali usate dal sito: il calendario degli scioperi del Ministero dei Trasporti e le pagine delle aziende di trasporto per le fasce garantite.',
    corpo: `<h2>Scioperi</h2>
<p>Calendario degli scioperi del Ministero delle Infrastrutture e dei Trasporti, Osservatorio sui conflitti sindacali: <a href="${MIT_PAGINA}" rel="noopener">pagina del calendario</a> e <a href="${MIT_RSS}" rel="noopener">feed RSS ufficiale</a>, letti ogni 30 minuti.</p>
<p>Salvo diversa indicazione, i contenuti del sito del Ministero sono pubblicati con licenza Creative Commons Attribuzione 3.0 Italia (<a href="${MIT_NOTE_LEGALI}" rel="noopener">note legali del Ministero</a>). Citiamo sempre la fonte. Abbiamo rielaborato i dati: testo reso più leggibile, orari riconosciuti quando sono scritti in modo chiaro, stato dedotto (per esempio «revocato» quando uno sciopero sparisce dal calendario prima di iniziare). Non usiamo loghi o stemmi istituzionali.</p>
<h2>Fasce garantite</h2>
<p>Lette sui siti ufficiali delle aziende e della Commissione di garanzia. Le citazioni sono testuali.</p>
<div class="tabella-scorre"><table class="tabella"><thead><tr><th scope="col">Azienda</th><th scope="col">Fasce</th><th scope="col">Fonte</th><th scope="col">Verificato il</th></tr></thead><tbody>${righe}</tbody></table></div>
<h2>Diritti dei passeggeri</h2>
<p><a href="${LINK_UE_DIRITTI_AEREI}" rel="noopener">Diritti dei passeggeri aerei sul sito dell'Unione europea</a>.</p>`,
  });
}

export function paginaPrivacy(ctx) {
  const t = ctx.sito.titolare;
  return paginaTesto(ctx, {
    // Fuori da Google e dalla sitemap: è l'unica pagina con il nome del titolare, che non vuole renderlo più visibile del necessario.
    percorso: '/privacy/', titolo: 'Privacy', noindex: true,
    descrizione: `Come ${ctx.sito.nome} tratta i dati: nessun cookie, nessun tracciamento, nessun dato personale raccolto.`,
    corpo: `<p class="avviso avviso-ok"><strong>In breve:</strong> non usiamo cookie, non tracciamo chi visita il sito e non raccogliamo dati personali. Non ci sono moduli, iscrizioni o account.</p>
<h2>Chi è il titolare</h2>
<p>${e(t.nome)}${t.partitaIva ? `, partita IVA ${e(t.partitaIva)}` : ''}${t.indirizzo ? `, ${e(t.indirizzo)}` : ''}. Contatto: ${e(t.email)}.</p>
<h2>Se ci scrivi</h2>
<p>Se ci mandi un'email, usiamo il tuo indirizzo e il messaggio solo per risponderti.${t.email.toLowerCase().endsWith('@' + ctx.sito.dominio) ? ' Le email per questo indirizzo passano dal servizio di inoltro di Cloudflare (Email Routing), che le consegna alla casella del titolare.' : ''}</p>
<h2>Cosa resta sul tuo dispositivo</h2>
<p>Se scegli una città o il tema chiaro o scuro, la scelta viene salvata solo nella memoria del tuo browser (localStorage). Non la riceviamo e puoi cancellarla in qualsiasi momento dalle impostazioni del browser. Anche le domande all'assistente restano sul tuo dispositivo.</p>
<h2>Hosting</h2>
<p>Il sito è ospitato da Cloudflare, che per consegnare le pagine e proteggerle dagli attacchi tratta dati tecnici come l'indirizzo IP, in qualità di responsabile del trattamento. Noi non usiamo questi dati per profilare nessuno.${ctx.sito.statisticheCloudflare ? ' Usiamo Cloudflare Web Analytics per contare le visite in forma aggregata, senza cookie e senza identificare le persone.' : ' Non usiamo statistiche di visita.'}</p>
<h2>Link esterni</h2>
<p>Quando apri un link verso altri siti (per esempio WhatsApp, Google Calendar, le aziende di trasporto o i siti partner), valgono le regole di privacy di quei siti. I link di affiliazione sono segnalati: se li usi, il sito partner può usare i suoi cookie per riconoscere che arrivi da qui.</p>
<h2>I tuoi diritti</h2>
<p>Per qualsiasi domanda sui dati personali scrivi a ${e(t.email)}. Puoi anche rivolgerti al Garante per la protezione dei dati personali.</p>
<p class="nota">Ultimo aggiornamento di questa pagina: ${e(dataLunga(ctx.oggi).replace(/^\S+ /, ''))}.</p>`,
  });
}

export function paginaNoteLegali(ctx) {
  const t = ctx.sito.titolare;
  return paginaTesto(ctx, {
    percorso: '/note-legali/', titolo: 'Note legali',
    descrizione: `Note legali di ${ctx.sito.nome}: fonti dei dati, limiti di responsabilità e link di affiliazione.`,
    corpo: `<h2>Chi gestisce il sito</h2>
<p>${e(ctx.sito.nome)} è gestito dal titolare indicato nella pagina <a href="/privacy/">Privacy</a>${t.partitaIva ? `, partita IVA ${e(t.partitaIva)}` : ''}${t.indirizzo ? `, ${e(t.indirizzo)}` : ''}. Contatto: ${e(t.email)}.</p>
<h2>Non siamo un sito ufficiale</h2>
<p>Il sito non è affiliato né collegato al Ministero delle Infrastrutture e dei Trasporti, alla Commissione di garanzia per l'attuazione della legge sullo sciopero nei servizi pubblici essenziali, né alle aziende di trasporto.</p>
<h2>Da dove vengono i dati</h2>
<p>Gli scioperi vengono dal <a href="${MIT_PAGINA}" rel="noopener">calendario ufficiale degli scioperi del Ministero delle Infrastrutture e dei Trasporti</a>, pubblicato con licenza Creative Commons Attribuzione 3.0 Italia. Le fasce garantite vengono dai siti ufficiali delle aziende, indicati nella pagina <a href="/fonti/">Fonti</a>.</p>
<h2>Le informazioni possono cambiare</h2>
<p>Gli scioperi possono essere revocati, rinviati o modificati fino all'ultimo momento, e i dati possono contenere errori o arrivare in ritardo. Le informazioni del sito sono fornite così come sono, a solo scopo informativo. <strong>Prima di partire verifica sempre con la tua azienda di trasporto.</strong> Nei limiti di legge, il gestore non risponde di danni derivanti dall'uso delle informazioni del sito.</p>
<h2>Link di affiliazione</h2>
<p>Alcuni link verso servizi di terzi (per esempio per verificare un rimborso aereo o per viaggiare con altri mezzi) sono link di affiliazione: se li usi, il sito può ricevere una commissione, senza costi in più per te. Sono sempre segnalati come tali e non cambiano le informazioni sugli scioperi. Nessuno può garantirti un rimborso: dipende dal tuo caso.</p>
<h2>Contenuti del sito</h2>
<p>I testi originali del sito sono del titolare. Se riprendi i dati degli scioperi, cita la fonte ufficiale: il Ministero delle Infrastrutture e dei Trasporti.</p>`,
  });
}

export function paginaContatti(ctx) {
  return paginaTesto(ctx, {
    percorso: '/contatti/', titolo: 'Contatti',
    descrizione: `Come contattare ${ctx.sito.nome} per segnalare un errore o fare una domanda.`,
    corpo: `<p>Hai trovato un errore o hai un suggerimento? Scrivici: <strong>${e(ctx.sito.titolare.email)}</strong>.</p>
<p>Puoi anche segnalare un problema in modo pubblico sul <a href="${urlSicuro(ctx.sito.repository)}" rel="noopener">repository del progetto</a>.</p>
<p>Non siamo l'azienda di trasporto e non possiamo rispondere su biglietti, rimborsi o orari dei mezzi: per questo contatta direttamente la tua azienda.</p>
<p>Per segnalazioni di sicurezza: <a href="/.well-known/security.txt">security.txt</a>.</p>`,
  });
}

export function paginaStato(ctx) {
  const st = ctx.stato;
  const riga = (k, v, attr = '') => `<tr><th scope="row">${e(k)}</th><td${attr}>${v}</td></tr>`;
  const tempo = (iso) => (iso ? `<time datetime="${e(iso)}" data-relativo>${e(dataOraRoma(iso))}</time>` : 'mai');
  const fonte = st.fonte_guasta_dal
    ? `<p class="avviso avviso-errore">La fonte ufficiale non risponde, o manda dati anomali, dal ${tempo(st.fonte_guasta_dal)}. Il sito mostra i dati dell'ultima verifica riuscita e li aggiornerà appena la fonte tornerà a funzionare.</p>`
    : '<p class="avviso avviso-ok">La fonte ufficiale funziona regolarmente.</p>';
  return paginaTesto(ctx, {
    percorso: '/stato/', titolo: 'Stato degli aggiornamenti',
    descrizione: 'Quando abbiamo controllato per l\'ultima volta il calendario ufficiale degli scioperi e se la fonte funziona.',
    corpo: `<div id="stato-fonte">${fonte}</div>
<table class="tabella" id="tabella-stato"><tbody>
${riga('Ultimo controllo riuscito della fonte', tempo(st.ultima_verifica_riuscita), ' data-campo="ultima_verifica_riuscita"')}
${riga('Ultima modifica dei dati', tempo(st.ultima_modifica_dati), ' data-campo="ultima_modifica_dati"')}
${riga('Ultima pubblicazione del sito', tempo(st.ultima_pubblicazione), ' data-campo="ultima_pubblicazione"')}
${riga('Data di aggiornamento indicata dal Ministero', e(st.fonte_aggiornata_al || 'non indicata'))}
${riga('Scioperi in programma nel calendario ufficiale', e(st.scioperi_nel_feed ?? 'non disponibile'))}
${st.ultimo_errore ? riga('Ultimo problema', `${e(st.ultimo_errore.messaggio)} (${tempo(st.ultimo_errore.quando)}${st.ultimo_errore.risolto_il ? `, risolto ${tempo(st.ultimo_errore.risolto_il)}` : ''})`) : ''}
</tbody></table>
<h2>Come lavoriamo</h2>
<p>Il calendario ufficiale viene controllato ogni 30 minuti. Il sito viene ripubblicato quando i dati cambiano, ogni giorno dopo la mezzanotte e comunque almeno ogni 6 ore. Se la fonte si guasta, non pubblichiamo dati nuovi finché non torna a funzionare, e il gestore riceve un avviso.</p>
<p>Se il controllo è fermo da più di ${e(ctx.sito.oreAvvisoDatiVecchi)} ore, in alto nelle pagine compare un avviso.</p>`,
  });
}

export function pagina404(ctx) {
  return pagina({
    sito: ctx.sito, versione: ctx.versione, percorso: '/404.html', tipoPagina: '404', noindex: true,
    // La 404 può essere servita sotto /widget/, dove le intestazioni non portano la CSP: questa la sostituisce.
    cspMeta: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
    titolo: 'Pagina non trovata', descrizione: 'La pagina che cerchi non esiste o è stata tolta: torna agli scioperi di oggi e domani oppure cerca la tua città.',
    corpo: `<h1>Pagina non trovata</h1>
<p>La pagina che cerchi non esiste o è stata tolta. Gli scioperi conclusi da più di due mesi vengono rimossi.</p>
<p><a class="btn" href="/">Vai agli scioperi di oggi e domani</a></p>
<p><a href="/citta/">Cerca la tua città</a> · <a href="/assistente/">Chiedi all'assistente</a></p>`,
  });
}
