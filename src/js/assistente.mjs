// Assistente senza intelligenza artificiale: regole scritte a mano e dati già caricati.
// Funziona nel browser e in Node (per i test). Non tocca il DOM: restituisce un oggetto risposta
// che l'interfaccia mostra SEMPRE come testo (mai come HTML).
import { aggiungiGiorni, giornoSettimana, lunediDi, fineMese, componi, dataMedia, dataBreve, NOMI_MESI, differenzaGiorni } from './date.mjs';
import { chiaveLuogo, toccaZona, toccaSettore, toccaPeriodo, ordinaScioperi, perPasseggeri, attivo } from './filtri.mjs';
import { statoMostrato, STATI } from './schede.mjs';

export const LUNGHEZZA_MASSIMA = 200;

const GIORNI = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const MESI_BREVI = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, sett: 9, ott: 10, nov: 11, dic: 12 };
const NUMERI = { primo: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };

// Parole comuni che non vanno mai scambiate per nomi di città (es. "come" ~ "Como", "ancora" ~ "Ancona", "torno" ~ "Torino").
const COMUNI = new Set(('come cosa dove quando quanto quanti quale quali perche sono sara sera mese mesi orari orario ora ore prima dopo fine tutti tutte ' +
  'tutto anche ancora torno torna tornare ritorno ritornare parto parte partire partenza posta poste costa costo trenta tanto treno treni sabato ' +
  'domani oggi ieri vari varie vario parla parlo campagna triste moneta marca marce bari baro lago luca lega linea linee mezzo mezzi pullman ' +
  'aereo aerei volo voli nave navi metro tram taxi notte giorno giorni lunedi martedi mercoledi giovedi venerdi domenica weekend settimana ' +
  'scuola casa lavoro ufficio sciopero scioperi scioperano domattina stasera stanotte giornata rimborso rimborsi fasce fascia garantiti ' +
  'calendario prossimo prossima prossimi questo questa questi queste quello quella grazie ciao salve buongiorno buonasera aiuto domanda ' +
  'roma2 nord sud est ovest centro italia europa estero partono arrivano arrivo ritardo ritardi cancellato cancellati biglietto biglietti ' +
  'bus autobus corsa corse stazione porto porta porti stato stati certo certa vero vera mattina pomeriggio ' +
  'metto metti mette mettere messo vado vai andare faccio fare fai devo deve posso puoi puo voglio vorrei sapere sai serve servono ' +
  'avere avete hanno siamo siete essere stata stato stati detto dire dici dimmi scusa scusi grazie favore info informazioni notizie ' +
  'quale quando perche perchè allora invece oppure magari forse sempre mai molto poco tanto troppo bene male meglio peggio ' +
  'lavoro lavorare scuola figli figlio figlia bambini andata ritorno viaggio viaggiare valido valida vale validi ' +
  'mezza mezzo mezzi mettono metrò metropoli metri treno metro aereo nave taxi tram').split(' '));

/** Normalizza la domanda: minuscolo, senza accenti, apostrofi come spazi; tiene / . - solo dentro le date. */
export function normalizzaDomanda(testo) {
  const t = String(testo ?? '').slice(0, LUNGHEZZA_MASSIMA).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9/.\-° ]+/g, ' ');
  const parole = [];
  for (const p of t.split(/\s+/)) {
    if (!p) continue;
    if (/^\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?$/.test(p)) { parole.push(p); continue; }
    for (const q of p.replace(/°/g, ' ').split(/[\s/.-]+/)) if (q) parole.push(q);
  }
  return parole;
}

/** Distanza di Damerau-Levenshtein (con trasposizioni adiacenti). */
export function distanza(a, b, massimo = 3) {
  if (Math.abs(a.length - b.length) > massimo) return massimo + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const tolleranza = (parola) => (parola.length >= 9 ? 2 : (parola.length >= 4 ? 1 : 0));

/** Cerca sequenze di parole (fino a 4) in un indice; restituisce le corrispondenze e segna le parole usate. */
function cercaSequenze(parole, usate, indice, { fuzzy = false, escludi = null } = {}) {
  const trovati = [];
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i + n <= parole.length; i++) {
      if (usate.slice(i, i + n).some(Boolean)) continue;
      const chiave = parole.slice(i, i + n).join(' ');
      let valore = indice.get(chiave);
      if (!valore && fuzzy && (n > 1 || !(escludi && escludi.has(chiave)))) {
        const t = tolleranza(chiave);
        if (t > 0 && !/\d/.test(chiave)) {
          let migliore = null, dMin = t + 1;
          for (const [k, v] of indice) {
            if (k.split(' ').length !== n || k[0] !== chiave[0] || k.length < 4) continue;
            const dd = distanza(chiave, k, t);
            if (dd < dMin) { dMin = dd; migliore = v; }
          }
          if (migliore && dMin <= t) valore = migliore;
        }
      }
      if (valore) {
        trovati.push({ valore, inizio: i, n });
        for (let k = i; k < i + n; k++) usate[k] = true;
      }
    }
  }
  return trovati.sort((x, y) => x.inizio - y.inizio).map((x) => x.valore);
}

function contieneFrase(parole, frasi) {
  const testo = ` ${parole.join(' ')} `;
  return frasi.some((f) => testo.includes(` ${f} `));
}

function primoNonPassato(oggi, mese, giorno) {
  const anno = +oggi.slice(0, 4);
  const d = componi(anno, mese, giorno);
  if (d && d >= aggiungiGiorni(oggi, -1)) return d;
  return componi(anno + 1, mese, giorno);
}

/** Riconosce il periodo richiesto. Restituisce { dal, al, tipo, testo, parole: indici usati } oppure null. */
export function capisciPeriodo(parole, oggi, usate = []) {
  const testo = ` ${parole.join(' ')} `;
  const segna = (...ws) => ws.forEach((w) => parole.forEach((p, i) => { if (p === w) usate[i] = true; }));
  const meseDa = (p) => {
    if (MESI_BREVI[p]) return MESI_BREVI[p];
    const i = NOMI_MESI.indexOf(p);
    if (i >= 0) return i + 1;
    if (p.length >= 6) { const j = NOMI_MESI.findIndex((m) => distanza(p, m, 1) <= 1); if (j >= 0) return j + 1; }
    return null;
  };
  const numeroDa = (p) => (/^\d{1,2}$/.test(p) ? +p : (NUMERI[p] ?? null));
  // 1) intervallo "dal 14 al 16 novembre"
  for (let i = 0; i < parole.length - 3; i++) {
    if (parole[i] === 'dal' && parole[i + 2] === 'al') {
      const g1 = numeroDa(parole[i + 1]), g2 = numeroDa(parole[i + 3]);
      const m = parole[i + 4] ? meseDa(parole[i + 4]) : null;
      if (g1 && g2) {
        const mese = m || +oggi.slice(5, 7);
        const dal = primoNonPassato(oggi, mese, g1), al = dal ? componi(+dal.slice(0, 4), mese, g2) : null;
        if (dal && al && al >= dal) { [i, i + 1, i + 2, i + 3, ...(m ? [i + 4] : [])].forEach((k) => { usate[k] = true; }); return { dal, al, tipo: 'intervallo', testo: `Dal ${dataBreve(dal)} al ${dataBreve(al)}` }; }
      }
    }
  }
  // 2) data con barra o punto: 14/11, 14.11.2026
  for (let i = 0; i < parole.length; i++) {
    const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(parole[i]);
    if (!m) continue;
    let anno = m[3] ? +m[3] : null;
    if (anno && anno < 100) anno += 2000;
    const d = anno ? componi(anno, +m[2], +m[1]) : primoNonPassato(oggi, +m[2], +m[1]);
    if (d) { usate[i] = true; return { dal: d, al: d, tipo: 'data', testo: dataMedia(d) }; }
  }
  // 3) "14 novembre", "1° dicembre", "primo dicembre"
  for (let i = 0; i < parole.length - 1; i++) {
    const g = numeroDa(parole[i]);
    const mese = meseDa(parole[i + 1]);
    if (g && mese) {
      const anno = parole[i + 2] && /^\d{4}$/.test(parole[i + 2]) ? +parole[i + 2] : null;
      const d = anno ? componi(anno, mese, g) : primoNonPassato(oggi, mese, g);
      if (d) { usate[i] = true; usate[i + 1] = true; if (anno) usate[i + 2] = true; return { dal: d, al: d, tipo: 'data', testo: dataMedia(d) }; }
    }
  }
  // 4) "venerdì 20", "il 20", "giorno 20", "per il 20"
  for (let i = 1; i < parole.length; i++) {
    const g = /^\d{1,2}$/.test(parole[i]) ? +parole[i] : null;
    if (!g || g < 1 || g > 31) continue;
    const prima = parole[i - 1];
    if (['il', 'giorno', 'del', 'al', 'entro', ...GIORNI].includes(prima) || GIORNI.some((x) => distanza(prima, x, 1) <= 1 && prima.length >= 5)) {
      if (parole[i + 1] && ['ore', 'ora', 'minuti', 'euro'].includes(parole[i + 1])) continue;
      const meseOggi = +oggi.slice(5, 7);
      let d = componi(+oggi.slice(0, 4), meseOggi, g);
      if (!d || d < oggi) {
        const mese2 = meseOggi === 12 ? 1 : meseOggi + 1;
        d = componi(+oggi.slice(0, 4) + (meseOggi === 12 ? 1 : 0), mese2, g);
      }
      if (d) { usate[i] = true; if (prima !== 'al' && prima !== 'del') usate[i - 1] = true; return { dal: d, al: d, tipo: 'data', testo: dataMedia(d) }; }
    }
  }
  // 5) parole relative
  if (/ oggi (e|o|oppure) domani /.test(testo) || / domani (e|o|oppure) oggi /.test(testo)) {
    segna('oggi', 'domani'); const d = aggiungiGiorni(oggi, 1); return { dal: oggi, al: d, tipo: 'oggi-domani', testo: 'Oggi e domani' };
  }
  if (/ dopo ?domani /.test(testo)) { segna('dopodomani', 'dopo', 'domani'); const d = aggiungiGiorni(oggi, 2); return { dal: d, al: d, tipo: 'dopodomani', testo: `Dopodomani, ${dataMedia(d)}` }; }
  const quasiDomani = (p) => p.length >= 5 && p[0] === 'd' && distanza(p, 'domani', 1) <= 1 && p !== 'domenica';
  if (/ (domani|domattina|domani mattina|domani sera) /.test(testo) || parole.some(quasiDomani)) {
    parole.forEach((p, i) => { if (p === 'domani' || p === 'domattina' || quasiDomani(p)) usate[i] = true; });
    const d = aggiungiGiorni(oggi, 1); return { dal: d, al: d, tipo: 'domani', testo: `Domani, ${dataMedia(d)}` };
  }
  if (/ (oggi|stasera|stanotte|stamattina|stamane|adesso|ora in poi|in questo momento|in giornata) /.test(testo) || / (questa sera|questa mattina|questa notte) /.test(testo)) {
    segna('oggi', 'stasera', 'stanotte', 'stamattina', 'stamane', 'adesso'); return { dal: oggi, al: oggi, tipo: 'oggi', testo: `Oggi, ${dataMedia(oggi)}` };
  }
  if (/ ieri /.test(testo)) { segna('ieri'); const d = aggiungiGiorni(oggi, -1); return { dal: d, al: d, tipo: 'ieri', testo: `Ieri, ${dataMedia(d)}` }; }
  const gs = giornoSettimana(oggi);
  if (/ (weekend|week end|fine settimana|finesettimana|sabato e domenica|sabato o domenica) /.test(testo)) {
    segna('weekend', 'week', 'end', 'fine', 'settimana', 'finesettimana', 'sabato', 'domenica');
    let sab = aggiungiGiorni(oggi, (6 - gs + 7) % 7);
    if (gs === 0) sab = aggiungiGiorni(oggi, -1);
    const prossimo = / (prossimo weekend|weekend prossimo|prossimo fine settimana|fine settimana prossimo) /.test(testo);
    if (prossimo && (gs === 6 || gs === 0)) sab = aggiungiGiorni(sab, 7);
    const dal = sab < oggi ? oggi : sab;
    const dom = aggiungiGiorni(sab, 1);
    const descr = sab.slice(5, 7) === dom.slice(5, 7) ? `sabato ${+sab.slice(8)} e domenica ${dataBreve(dom)}` : `sabato ${dataBreve(sab)} e domenica ${dataBreve(dom)}`;
    return { dal, al: dom, tipo: 'weekend', testo: `Nel fine settimana (${descr})` };
  }
  if (/ (prossima settimana|settimana prossima|settimana che viene) /.test(testo)) {
    segna('prossima', 'settimana', 'prossima');
    const lun = aggiungiGiorni(lunediDi(oggi), 7);
    return { dal: lun, al: aggiungiGiorni(lun, 6), tipo: 'settimana', testo: `La prossima settimana (da ${dataMedia(lun)})` };
  }
  if (/ (questa settimana|in settimana|entro la settimana|settimana) /.test(testo)) {
    segna('questa', 'settimana');
    const dom = aggiungiGiorni(lunediDi(oggi), 6);
    return { dal: oggi, al: dom, tipo: 'settimana', testo: `Questa settimana (fino a ${dataMedia(dom)})` };
  }
  if (/ (prossimo mese|mese prossimo) /.test(testo)) {
    segna('prossimo', 'mese');
    const primo = aggiungiGiorni(fineMese(oggi), 1);
    return { dal: primo, al: fineMese(primo), tipo: 'mese', testo: `A ${NOMI_MESI[+primo.slice(5, 7) - 1]}` };
  }
  if (/ (questo mese|mese) /.test(testo)) { segna('questo', 'mese'); return { dal: oggi, al: fineMese(oggi), tipo: 'mese', testo: `Entro la fine di ${NOMI_MESI[+oggi.slice(5, 7) - 1]}` }; }
  // 6) giorno della settimana
  for (let i = 0; i < parole.length; i++) {
    const p = parole[i];
    let g = GIORNI.indexOf(p);
    if (g < 0 && p.length >= 5) g = GIORNI.findIndex((x) => distanza(p, x, 1) <= 1);
    if (g < 0) continue;
    usate[i] = true;
    const prossimo = parole[i - 1] === 'prossimo' || parole[i - 1] === 'prossima' || parole[i + 1] === 'prossimo' || parole[i + 1] === 'prossima';
    let avanti = (g - gs + 7) % 7;
    if (avanti === 0 && prossimo) avanti = 7;
    const d = aggiungiGiorni(oggi, avanti);
    const rel = avanti === 0 ? 'Oggi, ' : (avanti === 1 ? 'Domani, ' : '');
    return { dal: d, al: d, tipo: 'giorno', testo: `${rel}${rel ? dataMedia(d) : dataMedia(d)[0].toUpperCase() + dataMedia(d).slice(1)}` };
  }
  // 7) mese da solo: "a dicembre"
  for (let i = 0; i < parole.length; i++) {
    const p = parole[i];
    const idx = NOMI_MESI.indexOf(p);
    if (idx < 0) continue;
    usate[i] = true;
    const mese = idx + 1, meseOggi = +oggi.slice(5, 7);
    const anno = +oggi.slice(0, 4) + (mese < meseOggi ? 1 : 0);
    const primo = componi(anno, mese, 1);
    return { dal: mese === meseOggi ? oggi : primo, al: fineMese(primo), tipo: 'mese', testo: `A ${NOMI_MESI[idx]}` };
  }
  if (/ (prossimi giorni|nei prossimi giorni|questi giorni|a breve|prossimamente|imminenti|in arrivo) /.test(testo)) {
    segna('prossimi', 'giorni');
    return { dal: oggi, al: aggiungiGiorni(oggi, 7), tipo: 'prossimi', testo: 'Nei prossimi 7 giorni' };
  }
  return null;
}

/** Crea l'assistente con i dati del sito. */
export function creaAssistente({ scioperi, base }) {
  const kb = base.assistente;
  const luoghiIndice = new Map();
  const cittaPerSlug = new Map(base.luoghi.citta.map((c) => [c.slug, c]));
  const regioniPerSlug = new Map(base.luoghi.regioni.map((r) => [r.slug, r]));
  for (const c of base.luoghi.citta) {
    for (const nome of [c.nome, c.provincia, ...c.alias]) {
      const k = chiaveLuogo(nome);
      if (k && k.replace(/ /g, '').length > 2 && !luoghiIndice.has(k)) luoghiIndice.set(k, { tipo: 'citta', slug: c.slug });
    }
  }
  for (const r of base.luoghi.regioni) {
    for (const nome of [r.nome, ...r.alias]) {
      const k = chiaveLuogo(nome);
      if (k && k.replace(/ /g, '').length > 2 && !luoghiIndice.has(k)) luoghiIndice.set(k, { tipo: 'regione', slug: r.slug });
    }
  }
  const settoriIndice = new Map();
  for (const [slug, parole] of Object.entries(kb.settori)) for (const p of parole) settoriIndice.set(normalizzaDomanda(p).join(' '), slug);
  const aziendeIndice = new Map(Object.entries(kb.aziende).map(([k, v]) => [normalizzaDomanda(k).join(' '), { nome: k, ...v }]));
  const nomeSettore = new Map(base.settori.map((s) => [s.slug, s]));
  const paroleChiave = new Set([...settoriIndice.keys(), ...aziendeIndice.keys()].filter((k) => !k.includes(' ')));
  const STOP_LUOGHI = new Set(['di', 'del', 'della', 'dell', 'nell', 'e', 'd', 'l', 'a', 'ad', 'in', 'per', 'da', 'dal', 'al', 'alla', 'la', 'il', 'lo', 'le', 'i', 'gli', 'c', 'ce', 'che', 'ci', 'si', 'mi', 'un', 'una', 'su', 'con', 'provincia', 'citta', 'zona']);

  function zonaDi(l) {
    if (l.tipo === 'citta') { const c = cittaPerSlug.get(l.slug); return { tipo: 'citta', provincia: c.provincia, regione: c.regione, nome: c.nome, slug: c.slug, url: `/citta/${c.slug}/` }; }
    const r = regioniPerSlug.get(l.slug); return { tipo: 'regione', regione: r.nome, nome: r.nome, slug: r.slug, url: `/regione/${r.slug}/` };
  }

  function capisci(testo, oggi) {
    const parole = normalizzaDomanda(testo);
    const usate = parole.map(() => false);
    const periodo = capisciPeriodo(parole, oggi, usate);
    // aziende e settori (prima dei luoghi: "treno" non deve diventare "Trento")
    const aziende = cercaSequenze(parole, usate, aziendeIndice);
    // Un nome di luogo scritto giusto non va mai scambiato per un settore ("trento" non è "treno").
    const nomiLuoghi = new Set([...luoghiIndice.keys()].filter((k) => !k.includes(' ')));
    const settori = new Set(cercaSequenze(parole, usate, settoriIndice, { fuzzy: true, escludi: new Set([...COMUNI, ...nomiLuoghi]) }));
    for (const a of aziende) settori.add(a.settore);
    // luoghi: si ignorano articoli e preposizioni
    const posizioni = [];
    const filtrate = [];
    parole.forEach((p, i) => { if (!usate[i] && !STOP_LUOGHI.has(p)) { filtrate.push(p); posizioni.push(i); } });
    const usateF = filtrate.map(() => false);
    const escludiLuoghi = new Set([...COMUNI, ...paroleChiave]);
    const luoghi = cercaSequenze(filtrate, usateF, luoghiIndice, { fuzzy: true, escludi: escludiLuoghi });
    usateF.forEach((u, k) => { if (u) usate[posizioni[k]] = true; });
    const reggioAmbiguo = filtrate.some((p, k) => p === 'reggio' && !usateF[k]);
    for (const a of aziende) {
      if (luoghi.length) break;
      if (a.citta) { const c = base.luoghi.citta.find((x) => x.nome === a.citta); if (c) luoghi.push({ tipo: 'citta', slug: c.slug }); }
      else if (a.regione) { const r = base.luoghi.regioni.find((x) => x.nome === a.regione); if (r) luoghi.push({ tipo: 'regione', slug: r.slug }); }
    }
    const unici = [];
    for (const l of luoghi) if (!unici.some((u) => u.tipo === l.tipo && u.slug === l.slug)) unici.push(l);
    return { parole, periodo, settori: [...settori], aziende, luoghi: unici, reggioAmbiguo };
  }

  function testoLuoghi(zone) {
    if (!zone.length) return 'in Italia';
    return zone.map((z) => (z.tipo === 'citta' ? `a ${z.nome}` : `in ${z.nome}`)).join(' o ');
  }

  function testoSettori(settori) {
    if (!settori.length) return '';
    const nomi = settori.map((s) => (nomeSettore.get(s) ? nomeSettore.get(s).breve : s));
    return ` (${nomi.join(', ')})`;
  }

  function voce(s, oggi) {
    const st = statoMostrato(s, oggi);
    const quando = s.inizio === s.fine ? dataMedia(s.inizio) : `da ${dataMedia(s.inizio)} a ${dataMedia(s.fine)}`;
    const dettagli = [quando[0].toUpperCase() + quando.slice(1), s.orario || null, STATI[st].testo].filter(Boolean);
    return { id: s.id, titolo: s.titolo, dettaglio: dettagli.join(' · '), stato: st, url: `/sciopero/${s.slug}/`, chi: s.chi };
  }

  function rispostaCerca(c, oggi, haRevoca) {
    const periodo = c.periodo || { dal: oggi, al: aggiungiGiorni(oggi, 60), tipo: 'tutti', testo: 'Da oggi in poi' };
    const zone = c.luoghi.map(zonaDi);
    const trovati = ordinaScioperi(scioperi.filter((s) => toccaPeriodo(s, periodo.dal, periodo.al)
      && (zone.length === 0 || zone.some((z) => toccaZona(s, z))) && toccaSettore(s, c.settori)));
    const attivi = trovati.filter((s) => attivo(s));
    const perViaggiatori = attivi.filter(perPasseggeri);
    const altri = attivi.filter((s) => !perPasseggeri(s));
    const annullati = trovati.filter((s) => !attivo(s));
    const dove = testoLuoghi(zone);
    const settoreTesto = testoSettori(c.settori);
    const link = [];
    if (zone.length === 1) link.push({ testo: `Tutti gli scioperi ${dove}`, url: zone[0].url });
    else if (c.settori.length === 1 && nomeSettore.get(c.settori[0])) link.push({ testo: `Tutti gli scioperi: ${nomeSettore.get(c.settori[0]).nome.toLowerCase()}`, url: `/settore/${c.settori[0]}/` });
    else link.push({ testo: 'Scioperi di oggi e domani', url: '/' });
    const MAX = 6;
    const elenco = [...perViaggiatori, ...annullati, ...altri].slice(0, MAX).map((s) => voce(s, oggi));
    const extra = perViaggiatori.length + annullati.length + altri.length - elenco.length;
    let testo;
    const maiuscola = (t) => t[0].toUpperCase() + t.slice(1);
    const periodoFrase = maiuscola(periodo.testo) + (periodo.testo.includes(',') ? ',' : '');
    if (perViaggiatori.length) {
      const n = perViaggiatori.length;
      testo = `${periodoFrase} ${dove}${settoreTesto} ${n === 1 ? 'risulta 1 sciopero' : `risultano ${n} scioperi`} nel calendario ufficiale.`;
    } else {
      testo = `${periodoFrase} ${dove}${settoreTesto} non risultano scioperi${altri.length ? ' che fermano chi viaggia' : ''} nel calendario ufficiale.`;
    }
    const aggiunte = [];
    if (annullati.length) aggiunte.push(annullati.length === 1 ? 'Attenzione: uno sciopero di quel periodo è stato revocato o rinviato (vedi sotto).' : `Attenzione: ${annullati.length} scioperi di quel periodo sono stati revocati o rinviati (vedi sotto).`);
    if (altri.length && !perViaggiatori.length) aggiunte.push('Ci sono però scioperi che di norma non toccano i passeggeri (per esempio del trasporto merci).');
    if (!perViaggiatori.length && periodo.tipo !== 'tutti') {
      const dopo = ordinaScioperi(scioperi.filter((s) => s.da > periodo.al && attivo(s) && perPasseggeri(s)
        && (zone.length === 0 || zone.some((z) => toccaZona(s, z))) && toccaSettore(s, c.settori)))[0];
      if (dopo) {
        aggiunte.push(`Il prossimo in calendario è ${dataMedia(dopo.inizio)}: ${dopo.titolo}.`);
        link.unshift({ testo: `Vai al prossimo sciopero (${dataBreve(dopo.inizio)})`, url: `/sciopero/${dopo.slug}/` });
      }
    }
    if (haRevoca && perViaggiatori.length) aggiunte.push('«Confermato» vuol dire che è ancora nel calendario ufficiale: le revoche possono arrivare fino all\'ultimo, ricontrolla il giorno prima.');
    if (extra > 0) aggiunte.push(`Ce ne sono altri ${extra}: li trovi nella pagina collegata.`);
    if (periodo.tipo === 'ieri') aggiunte.push('Gli scioperi passati restano visibili per qualche settimana.');
    return {
      intento: 'cerca', testo, aggiunte, elenco, link,
      capito: { dal: periodo.dal, al: periodo.al, periodo: periodo.tipo, luoghi: zone.map((z) => z.slug), settori: c.settori },
      ids: [...perViaggiatori, ...annullati, ...altri].map((s) => s.id),
    };
  }

  function testoFasce(v) {
    if (!v.fasce || !v.fasce.length) return null;
    const ora = (o) => (o === 'inizio servizio' || o === 'fine servizio' ? o : o.replace(/^0(\d)/, '$1'));
    const pref = { feriali: 'feriali ', festivi: 'festivi ', sabato: 'sabato ', tutti: '' };
    const gruppi = new Map();
    for (const f of v.fasce) {
      if (!gruppi.has(f.giorni)) gruppi.set(f.giorni, []);
      gruppi.get(f.giorni).push(f.dalle === 'inizio servizio' ? `da inizio servizio alle ${ora(f.alle)}` : (f.alle === 'fine servizio' ? `dalle ${ora(f.dalle)} a fine servizio` : `${ora(f.dalle)}-${ora(f.alle)}`));
    }
    return [...gruppi.entries()].map(([g, x]) => pref[g] + x.join(' e ')).join('; ');
  }

  function vocefascia(v) {
    const t = testoFasce(v);
    const dettaglio = t ? t : (v.citazione ? `«${v.citazione}»` : 'nessuna fonte ufficiale trovata');
    const quale = v.origine === 'avviso' && v.avviso_del ? ` (dall'avviso per lo sciopero del ${dataBreve(v.avviso_del)})` : '';
    if (!t && !v.citazione) return { titolo: v.azienda, dettaglio: v.nota || 'nessuna fascia oraria fissa trovata su una pagina ufficiale', url: v.avvisi || null };
    const titolo = v.tipo === 'tpl' && !v.azienda.includes('(') ? `${v.azienda} (${v.citta})` : v.azienda;
    return { titolo, dettaglio: dettaglio + quale, url: v.fonte || v.avvisi || null };
  }

  function rispostaFasce(c) {
    const zone = c.luoghi.map(zonaDi);
    const elenco = [];
    const link = [];
    let testo;
    const vuoleAerei = c.settori.includes('aerei');
    const vuoleTreni = c.settori.includes('treni');
    const vuoleBus = c.settori.includes('bus-metro');
    const nazionali = base.fasce.filter((v) => v.tipo === 'ferroviario' && !v.regione);
    if (zone.length) {
      const z = zone[0];
      const regione = z.regione;
      const tpl = z.tipo === 'citta' ? base.fasce.filter((v) => v.tipo === 'tpl' && v.citta === z.nome) : base.fasce.filter((v) => v.tipo === 'tpl' && v.regione === regione && v.fasce.length);
      const treni = [...nazionali, ...base.fasce.filter((v) => v.tipo === 'ferroviario' && v.regione && chiaveLuogo(v.regione) === chiaveLuogo(regione))];
      if (!vuoleTreni && !vuoleAerei) for (const v of tpl) elenco.push(vocefascia(v));
      if (!vuoleBus && !vuoleAerei) for (const v of treni) elenco.push(vocefascia(v));
      if (vuoleAerei) for (const v of base.fasce.filter((x) => x.tipo === 'aereo')) elenco.push(vocefascia(v));
      testo = `Fasce garantite ${z.tipo === 'citta' ? 'a' : 'in'} ${z.nome}, secondo le aziende di trasporto:`;
      if (!tpl.length && !vuoleTreni && !vuoleAerei) testo += ` per bus e metro ${z.tipo === 'citta' ? 'a' : 'in'} ${z.nome} non abbiamo trovato una fonte ufficiale, controlla gli avvisi dell'azienda locale.`;
      link.push({ testo: `Fasce e scioperi ${z.tipo === 'citta' ? 'a' : 'in'} ${z.nome}`, url: `${z.url}#fasce-titolo` });
    } else if (vuoleAerei || vuoleTreni) {
      if (vuoleAerei) for (const v of base.fasce.filter((x) => x.tipo === 'aereo')) elenco.push(vocefascia(v));
      if (vuoleTreni) for (const v of nazionali) elenco.push(vocefascia(v));
      testo = 'Ecco le fasce garantite ufficiali:';
      link.push({ testo: vuoleAerei ? 'Scioperi degli aerei' : 'Scioperi dei treni', url: vuoleAerei ? '/settore/aerei/' : '/settore/treni/' });
    } else {
      return { intento: 'fasce', testo: kb.risposte.fasce_generiche, aggiunte: [], elenco: [], link: [{ testo: 'Scegli la tua città', url: '/citta/' }], suggerimenti: ['Fasce garantite a Roma', 'Fasce garantite treni', 'Fasce garantite aerei'], capito: { luoghi: [], settori: c.settori } };
    }
    return { intento: 'fasce', testo, aggiunte: ['Le fasce possono cambiare a ogni sciopero: fa fede l\'avviso ufficiale dell\'azienda.'], elenco, link, capito: { luoghi: zone.map((z) => z.slug), settori: c.settori } };
  }

  function rispondi(domanda, { oggi }) {
    const testoPulito = String(domanda ?? '').trim();
    const sugg = kb.suggerimenti.slice(0, 4);
    if (!testoPulito) return { intento: 'vuoto', testo: kb.risposte.non_capito, aggiunte: [], elenco: [], link: [], suggerimenti: sugg, capito: {} };
    const c = capisci(testoPulito, oggi);
    const p = c.parole;
    const ha = (lista) => contieneFrase(p, lista.map((x) => normalizzaDomanda(x).join(' ')));
    const haRimborso = ha(kb.intenti.rimborso);
    const haFasce = ha(kb.intenti.fasce);
    const haCalendario = ha(kb.intenti.calendario);
    const haFonte = ha(kb.intenti.fonte);
    const haScuola = ha(kb.intenti.scuola);
    const haRevoca = ha(kb.intenti.revoca);
    const haSciopero = ha(kb.parole_sciopero);
    const haSaluto = ha(kb.intenti.saluto);
    const haGrazie = ha(kb.intenti.grazie);
    const haAiuto = ha(kb.intenti.aiuto);
    const base0 = { aggiunte: [], elenco: [], link: [], suggerimenti: sugg, capito: { luoghi: c.luoghi.map((l) => l.slug), settori: c.settori } };
    if (c.reggioAmbiguo && !c.luoghi.length) {
      const sost = (nome) => testoPulito.replace(/reggio/i, nome);
      return { ...base0, intento: 'chiarimento', testo: kb.risposte.chiarimento_reggio, suggerimenti: [sost('Reggio Calabria'), sost('Reggio Emilia')] };
    }
    if (haRimborso) {
      const volo = c.settori.includes('aerei') || ha(['volo', 'voli', 'aereo', 'aerei', 'ryanair', 'easyjet', 'compagnia aerea']);
      const treno = c.settori.some((s) => ['treni', 'bus-metro', 'traghetti'].includes(s));
      const link = [];
      if (volo || !treno) link.push({ testo: 'Diritti dei passeggeri aerei (Unione europea)', url: 'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_it.htm' });
      if (volo) link.push({ testo: 'Scioperi degli aerei', url: '/settore/aerei/' });
      if (treno) link.push({ testo: 'Scioperi dei treni', url: '/settore/treni/' });
      const testo = volo ? kb.risposte.rimborso_volo : (treno ? kb.risposte.rimborso_treno : `${kb.risposte.rimborso_volo} ${kb.risposte.rimborso_treno}`);
      return { ...base0, intento: volo ? 'rimborso_volo' : (treno ? 'rimborso_treno' : 'rimborso'), testo, link, suggerimenti: ['Sciopero aerei prossimi giorni', 'Scioperi dei treni questa settimana'] };
    }
    if (haFasce) return { ...rispostaFasce(c), suggerimenti: ['Fasce garantite treni', 'Fasce garantite aerei', "C'è sciopero domani?"] };
    if (haCalendario) {
      const zone = c.luoghi.map(zonaDi);
      const link = zone.length ? [{ testo: `Calendario degli scioperi ${zone[0].tipo === 'citta' ? 'a' : 'in'} ${zone[0].nome}`, url: `${zone[0].url}#iscr-titolo` }] : [];
      link.push({ testo: 'Scegli il tuo calendario', url: '/calendario/' });
      const notifiche = ha(['notifica', 'notifiche', 'avvisami', 'avvisarmi', 'email', 'mail', 'sms']);
      return { ...base0, intento: 'calendario', testo: notifiche ? `${kb.risposte.notifiche} ${kb.risposte.calendario}` : kb.risposte.calendario, link };
    }
    if (haScuola && !c.settori.length) return { ...base0, intento: 'scuola', testo: kb.risposte.scuola, link: [{ testo: 'Cruscotto degli scioperi della Funzione Pubblica', url: 'https://crusc-gepas.perlapa.gov.it/' }] };
    if (haFonte && !c.periodo && !c.luoghi.length && !c.settori.length) return { ...base0, intento: 'fonte', testo: kb.risposte.fonte, link: [{ testo: 'Fonti dei dati', url: '/fonti/' }, { testo: 'Stato degli aggiornamenti', url: '/stato/' }] };
    const qualcosaDiConcreto = Boolean(c.periodo || c.luoghi.length || c.settori.length);
    if (haAiuto && !qualcosaDiConcreto) return { ...base0, intento: 'aiuto', testo: kb.risposte.aiuto };
    if ((haGrazie || haSaluto) && !qualcosaDiConcreto && !haSciopero) return { ...base0, intento: haGrazie ? 'grazie' : 'saluto', testo: haGrazie ? kb.risposte.grazie : kb.risposte.saluto };
    if (qualcosaDiConcreto || haSciopero || haRevoca) return { ...rispostaCerca(c, oggi, haRevoca), suggerimenti: sugg };
    if (haAiuto) return { ...base0, intento: 'aiuto', testo: kb.risposte.aiuto };
    if (haGrazie) return { ...base0, intento: 'grazie', testo: kb.risposte.grazie };
    if (haSaluto) return { ...base0, intento: 'saluto', testo: kb.risposte.saluto };
    return { ...base0, intento: 'non_capito', testo: kb.risposte.non_capito };
  }

  return { rispondi, capisci };
}
