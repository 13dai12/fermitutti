// Testi leggibili a partire dai dati ufficiali (che il Ministero scrive in maiuscolo) e oggetti compatti per il browser.
import { readFileSync } from 'node:fs';
import { dataMedia, dataLunga, dataBreve, NOMI_GIORNI, giornoSettimana, differenzaGiorni } from './date.mjs';
import { infoSettore } from './normalizza.mjs';
import { cittaDaProvincia } from './luoghi.mjs';
import { fasceInBreve } from './fasce.mjs';

const settori = JSON.parse(readFileSync(new URL('../../data/settori.json', import.meta.url), 'utf8'));
const nomeBreve = Object.fromEntries(Object.values(settori).map((s) => [s.slug, s.breve]));

// Sigle che restano in maiuscolo.
const SIGLE = new Set(('ANM ATM ATAC GTT AMT ATB ATV ACTV AVM SASA SETA TEP TPER AMTAB AMAT AMTS CTM EAV ENAV RFI FSI FS NTV TPL CGIL CISL UIL UILT UGL ' +
  'USB CUB SGB ORSA FAISA CISAL CONFAIL FILT FIT FNA FAST CONFSAL SBB BLS LTE EVM TX ATVO DOIT ACC PDM PDB PV NCC ITA IVRI SBM SGC USI CAT CLAP SIAL CIB ' +
  'ADL LMO OSR OST OSP RSA RSU TUA SGM ATP CSC AMACO ATAM ATAF NET SAD TFT ARST CTP ANAV COBAS UGLTA UNICOBAS CONFIAL FILCAMS FISASCAT FIOM FLAI SLC ' +
  'UILTRASPORTI FAISA-CISAL OOSS SPA SRL GSE ADR SEA SAVE GESAP SAC GESAC AVIAPARTNER SAGAT TAV ATI CCNL DPCM UE EU UGL-FNA FNA ATR ATI RAI AMIU APAM ' +
  'KLM SAS TAP LOT CSA UILPA FP FLP CONFEDERAZIONE').split(' ').filter((x) => x.length <= 12));
// Parole comuni che vanno in minuscolo.
const MINUSCOLE = new Set(('di da del dello della dei degli delle e ed il lo la i gli le in per con su al allo alla ai agli alle a nel nello nella nei nelle ' +
  'sul sulla tra fra dal dalla dalle dai alle ore che non o un una uno anche presso come tutti tutte tutto tutta ' +
  'personale sciopero scioperi generale settore settori pubblici privati pubbliche private categoria categorie esclusione escluso esclusa ' +
  'appalto appalti strumentali comparti comparto tempo determinato indeterminato contratti precari atipici imprese impresa svolgono attività ' +
  'ferroviaria ferroviario ferroviari ferroviarie addetti addetto servizio servizi lavoratori dipendenti dipendente società gruppo macchina bordo ' +
  'manutenzione ingegneria unità territoriale bacino tecnici tecnico polifunzionali treno treni aeroporto aeroporti aereo aerei aerea pulizie ' +
  'trasporto trasporti pubblico locale merci rotaia logistica marittimo marittimi porti porto taxi circolazione sicurezza stradale autostrade ' +
  'autostradale intera intero giornata turno lavoro prestazione modalità varie vario comunicate territoriali territoriale regionale regionali ' +
  'nazionale nazionali aziende azienda adesione navigante navigazione terra viaggiante operai impiegati assistenza volo voli controllo traffico ' +
  'handling scalo scali amministrativo amministrativi rete linee linea urbano urbane extraurbano extraurbane soc socc pers ' +
  'conducenti autisti autoferrotranvieri metropolitana tram bus autobus funicolare funivia traghetto traghetti nave navi pilota piloti assistenti ' +
  'cabina hostess steward terminal biglietterie biglietteria stazione stazioni officina officine deposito depositi notturno diurno festivo festivi ' +
  'feriale feriali mattina pomeriggio sera prima seconda fascia fasce garantiti garantite garantito esclusi escluse precettazione ordinanza ' +
  'previsto prevista previsti previste no si sono è solo salvo salvi eccetto compresi compreso inclusi incluso ogni tranne durante fino entro dopo oltre').split(' '));
const ELISIONI = new Set(['l', 'dell', 'nell', 'all', 'dall', 'sull', 'un', 'd', 'quell']);

const ACCENTI = { A: 'À', E: 'È', I: 'Ì', O: 'Ò', U: 'Ù' };


function parolaLeggibile(p, primaDellaFrase) {
  // p è una parola senza spazi; può contenere trattini, barre, punti, apostrofi.
  if (/[a-z]/.test(p)) return p; // già in minuscolo/misto: la lasciamo stare
  const pezzi = p.split(/([-/])/);
  return pezzi.map((pezzo, i) => {
    if (pezzo === '-' || pezzo === '/') return pezzo;
    const m = /^([^A-Z0-9À-Ý]*)([A-Z0-9À-Ý.'’]+?)([^A-Z0-9À-Ý]*)$/.exec(pezzo);
    if (!m) return pezzo;
    const [, pre, nucleo, post] = m;
    const pulito = nucleo.replace(/[.'’]+$/, '');
    let risultato;
    if (/^\d/.test(nucleo) || /^[A-Z](\.[A-Z])+\.?$/.test(nucleo)) risultato = nucleo; // numeri, sigle puntate (B.U.)
    else if (SIGLE.has(pulito)) risultato = nucleo;
    else if (/^[B-DF-HJ-NP-TV-XZ]{2,5}$/.test(pulito)) risultato = nucleo; // sigla senza vocali
    else {
      let parola = nucleo.toLowerCase();
      let prefisso = '';
      const el = /^([a-z]+)(['’])(.+)$/.exec(parola);
      if (el && ELISIONI.has(el[1])) { prefisso = el[1] + el[2]; parola = el[3]; }
      const base = parola.replace(/[.'’]+$/, '');
      const inizioFrase = primaDellaFrase && i === 0 && !prefisso;
      if (!(MINUSCOLE.has(base) && !inizioFrase)) parola = parola[0].toUpperCase() + parola.slice(1);
      if (prefisso && primaDellaFrase && i === 0) prefisso = prefisso[0].toUpperCase() + prefisso.slice(1);
      risultato = prefisso + parola;
    }
    return pre + risultato + post;
  }).join('');
}

/** "PERSONALE SOC. ANM DI NAPOLI" -> "Personale ANM di Napoli". Se il testo non è tutto maiuscolo, lo lascia com'è. */
export function leggibile(testo) {
  let t = String(testo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/[a-zà-ÿ]/.test(t)) return t;
  t = t.replace(/\bSOCC?\.?\s+/g, '').replace(/\bPERS\.\s*/g, 'PERSONALE ').replace(/\bAPT\b/g, 'AEROPORTO').replace(/\bOO\.\s?SS\.?/g, 'SINDACATI');
  // Accento finale scritto con l'apostrofo (MODALITA' -> MODALITÀ, PERCHE' -> PERCHÉ); l'elisione (DELL'AEROPORTO) resta.
  t = t.replace(/CHE['’](?=$|[\s,.;:)])/g, 'CHÉ').replace(/([AEIOU])['’](?=$|[\s,.;:)])/g, (_, v) => ACCENTI[v]);
  const parole = t.split(' ');
  const out = parole.map((p, i) => parolaLeggibile(p, i === 0));
  const frase = out.join(' ');
  return frase[0].toUpperCase() + frase.slice(1);
}

function ora(hhmm) { return hhmm; }

/** Orario leggibile oppure null se non è stato riconosciuto con certezza. */
export function orarioTesto(s) {
  const o = s.orario;
  if (!o) return null;
  if (o.tipo === 'giornata') return s.inizio === s.fine ? 'tutto il giorno' : 'tutti i giorni indicati';
  if (o.giornoFine === s.inizio) return `dalle ${ora(o.dalle)} alle ${ora(o.alle)}`;
  const gf = differenzaGiorni(s.inizio, o.giornoFine) === 1 ? `di ${NOMI_GIORNI[giornoSettimana(o.giornoFine)]}` : `del ${dataBreve(o.giornoFine)}`;
  return `dalle ${ora(o.dalle)} di ${NOMI_GIORNI[giornoSettimana(s.inizio)]} alle ${ora(o.alle)} ${gf}`;
}

/** "a Napoli", "in Lombardia", "in tutta Italia". */
export function doveTesto(s) {
  if (s.zona_tipo === 'nazionale') return 'in tutta Italia';
  if (s.zona_tipo === 'regione') return `in ${s.zona_nome}`;
  const c = cittaDaProvincia(s.provincia);
  const nome = c ? c.nome : leggibile(s.provincia);
  return `a ${nome}`;
}

export function luogoTesto(s) {
  if (s.zona_tipo === 'nazionale') return 'Tutta Italia';
  if (s.zona_tipo === 'regione') return s.zona_nome;
  const c = cittaDaProvincia(s.provincia);
  return `${c ? c.nome : leggibile(s.provincia)} (${s.regione})`;
}

/** Titolo breve per schede e calendari: "Bus, tram e metro a Napoli". */
export function titoloScheda(s) {
  const inf = infoSettore(s.settore);
  if (s.settore_slug === 'generale') return s.esclude_trasporti ? `Sciopero generale ${doveTesto(s)} (esclusi i trasporti)` : `Sciopero generale ${doveTesto(s)}`;
  if (s.settore_slug === 'piu-settori') return `Più settori dei trasporti ${doveTesto(s)}`;
  return `${inf.nome} ${doveTesto(s)}`;
}

/** Titolo della pagina: "Sciopero bus e metro a Napoli, lunedì 16 novembre 2026". */
export function titoloPagina(s) {
  const inf = infoSettore(s.settore);
  const quando = s.inizio === s.fine ? dataLunga(s.inizio)
    : (s.inizio.slice(0, 7) === s.fine.slice(0, 7) ? `da ${NOMI_GIORNI[giornoSettimana(s.inizio)]} ${+s.inizio.slice(8)} a ${dataLunga(s.fine)}` : `da ${dataLunga(s.inizio)} a ${dataLunga(s.fine)}`);
  if (s.settore_slug === 'generale') return `Sciopero generale ${doveTesto(s)}, ${quando}`;
  if (s.settore_slug === 'piu-settori') return `Sciopero di più settori dei trasporti ${doveTesto(s)}, ${quando}`;
  return `Sciopero ${inf.breve} ${doveTesto(s)}, ${quando}`;
}

export function elencoSettoriTesto(slugs) {
  return slugs.map((x) => nomeBreve[x] || x).join(', ');
}

/** Nota quando alcune modalità iniziano prima della data ufficiale. */
export function notaAnticipo(s) {
  if (!s.giorno_da || s.giorno_da >= s.inizio) return null;
  return `Attenzione: per alcuni settori inizia già ${dataMedia(s.giorno_da)} (vedi gli orari).`;
}

export function esclusiTesto(s) {
  if (s.esclude_trasporti) return 'Secondo il Ministero questo sciopero esclude il settore dei trasporti.';
  if (s.esclusi && s.esclusi.length) return `Esclusi: ${elencoSettoriTesto(s.esclusi)}.`;
  return null;
}

/** Sindacati in forma breve per le schede (il testo completo è nella pagina dello sciopero). */
export function sindacatiBrevi(t) {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 70 ? `${s.slice(0, 68).replace(/[ /,-]+[^ /,-]*$/, '')}…` : s;
}

/** Oggetto compatto per il browser (dati/scioperi.json) e per le schede. */
export function compatto(s, perSlug) {
  const nuovo = s.differito_a ? perSlug.get(s.differito_a) : null;
  return {
    id: s.id,
    slug: s.slug,
    inizio: s.inizio,
    fine: s.fine,
    da: s.giorno_da || s.inizio,
    a: s.giorno_a || s.fine,
    settore: s.settore_slug,
    zona: s.zona_tipo,
    regione: s.regione,
    provincia: s.provincia,
    stato: s.stato,
    titolo: titoloScheda(s),
    chi: leggibile(s.categoria),
    sindacati: sindacatiBrevi(s.sindacati),
    orario: orarioTesto(s),
    modalita: leggibile(s.modalita),
    coinvolti: s.coinvolti,
    esclusi: s.esclusi,
    esclude_trasporti: s.esclude_trasporti,
    inizio_precedente: s.inizio_precedente || null,
    differito_a: s.differito_a || null,
    differito_a_data: nuovo ? nuovo.inizio : null,
    nota_anticipo: notaAnticipo(s),
    esclusi_testo: esclusiTesto(s),
    garantite: s.esclude_trasporti ? null : fasceInBreve(s),
  };
}
