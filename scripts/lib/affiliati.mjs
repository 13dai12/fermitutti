// Link di affiliazione: costruiti SOLO dalla configurazione (config/affiliati.mjs) e verso domini fissi.
// Se un codice manca, il riquadro non compare. Se un codice è scritto male, la build si ferma con un messaggio chiaro.
import { e } from './html.mjs';

const DOMINI = {
  airhelp: ['airhelp.com'],
  noleggio: ['awin1.com', 'discovercars.com', 'rentalcars.com'],
};
export const LINK_UE_DIRITTI_AEREI = 'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_it.htm';

function dominioAmmesso(url, domini) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  return domini.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
}

/** Legge e controlla la configurazione. Restituisce i link pronti (o null se spenti). */
export function preparaAffiliati(cfg = {}) {
  const errori = [];
  const out = { airhelp: null, flixbus: null, noleggio: null, pubblicita: Boolean(cfg.pubblicita?.attiva) };
  const ah = String(cfg.airhelp?.link ?? '').trim();
  if (ah) {
    if (dominioAmmesso(ah, DOMINI.airhelp)) out.airhelp = ah;
    else errori.push('airhelp.link deve essere un indirizzo https di airhelp.com');
  }
  const affid = String(cfg.flixbus?.awinAffid ?? '').trim();
  const mid = String(cfg.flixbus?.awinMid ?? '').trim();
  if (affid) {
    if (!/^\d{3,12}$/.test(affid)) errori.push('flixbus.awinAffid deve contenere solo cifre (il tuo id editore Awin)');
    else if (!/^\d{3,12}$/.test(mid)) errori.push('flixbus.awinMid deve contenere solo cifre');
    else out.flixbus = `https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=${affid}&ued=${encodeURIComponent('https://www.flixbus.it/')}`;
  }
  const nl = String(cfg.noleggioAuto?.link ?? '').trim();
  const nn = String(cfg.noleggioAuto?.nome ?? '').trim();
  if (nl) {
    if (!dominioAmmesso(nl, DOMINI.noleggio)) errori.push(`noleggioAuto.link deve essere https e su uno di questi domini: ${DOMINI.noleggio.join(', ')}`);
    else if (!nn || nn.length > 40 || /[<>"]/.test(nn)) errori.push('noleggioAuto.nome è obbligatorio (massimo 40 caratteri, senza simboli < > ")');
    else out.noleggio = { url: nl, nome: nn };
  }
  if (errori.length) throw new Error(`config/affiliati.mjs non valido:\n- ${errori.join('\n- ')}`);
  return out;
}

const COMPAGNIE = ['ITA AIRWAYS', 'RYANAIR', 'MALTA AIR', 'EASYJET', 'VUELING', 'VOLOTEA', 'WIZZ AIR', 'WIZZAIR', 'AEROITALIA', 'NEOS',
  'AIR DOLOMITI', 'LUFTHANSA', 'AIR FRANCE', 'KLM', 'BRITISH AIRWAYS', 'IBERIA', 'EMIRATES', 'BLUE PANORAMA', 'SKYALPS', 'ALBASTAR',
  'AIR EUROPA', 'EUROWINGS', 'TRANSAVIA', 'JET2', 'ALITALIA', 'CREWLINK', 'AIR ARABIA', 'TAP AIR PORTUGAL', 'SWISS', 'AUSTRIAN', 'BRUSSELS AIRLINES'];
const NON_COMPAGNIA = /\b(ENAV|TECHNO SKY|HANDLING|PULIZIE|SECURITY|SICUREZZA|SICURITALIA|AVIATION SERVICES|GESTORE|CONTROLL[OI]|CATERING|ASSISTENZA AL VOLO)\b/;

/** Nome della compagnia aerea se dal testo ufficiale sciopera il suo personale; altrimenti null. */
export function compagniaAereaCheSciopera(s) {
  if (s.settore_slug !== 'aerei') return null;
  const testo = String(s.categoria ?? '').toUpperCase();
  if (NON_COMPAGNIA.test(testo)) return null;
  const trovata = COMPAGNIE.find((c) => new RegExp(`\\b${c.replace(/ /g, '\\s+')}\\b`).test(testo));
  return trovata || null;
}

const avvisoAffiliato = 'Link di affiliazione: se usi questo link, il sito può ricevere una commissione. Per te il prezzo non cambia.';

/** Riquadro diritti e rimborsi per gli scioperi aerei. Il link affiliato compare solo se configurato. */
export function htmlDirittiVolo(s, aff) {
  const compagnia = compagniaAereaCheSciopera(s);
  const ue = `<a href="${e(LINK_UE_DIRITTI_AEREI)}" rel="noopener">diritti dei passeggeri aerei sul sito dell'Unione europea</a>`;
  let testo;
  if (compagnia) {
    const nome = compagnia.split(' ').map((p) => (p.length <= 3 ? p : p[0] + p.slice(1).toLowerCase())).join(' ');
    testo = `<p>Sciopera il personale di <strong>${e(nome)}</strong>. Se il tuo volo è stato cancellato o è arrivato con più di 3 ore di ritardo, il regolamento europeo 261/2004 può darti diritto a una compensazione: <strong>potrebbero spettarti da 250 a 600 euro</strong>, a seconda della distanza. Non è automatico: dipende dal tuo caso.</p>
<p>Puoi chiederla da solo alla compagnia, gratis: leggi i ${ue}.</p>`;
  } else {
    testo = `<p>Quando scioperano i controllori di volo o il personale degli aeroporti, di solito la compensazione in denaro non spetta. La compagnia però deve sempre offrirti assistenza e, se il volo è cancellato, il rimborso del biglietto o un volo alternativo.</p>
<p>Leggi i ${ue}.</p>`;
  }
  const affiliato = aff.airhelp ? `<p class="affiliato"><span class="affiliato-eti">Link di affiliazione</span><br>
<a class="btn btn-secondario" href="${e(aff.airhelp)}" rel="sponsored noopener">Verifica gratis se ti spetta qualcosa con AirHelp</a></p>
<p class="nota">${e(avvisoAffiliato)} AirHelp trattiene una parte della somma solo se la pratica ha successo.</p>` : '';
  return `<section class="riquadro${aff.airhelp ? ' riquadro-affiliato' : ''}" aria-labelledby="diritti-titolo">
<h2 id="diritti-titolo">Volo cancellato o in ritardo?</h2>
${testo}
${affiliato}
</section>`;
}

/** Riquadro "alternative di viaggio" (solo se c'è almeno un link configurato). */
export function htmlAlternative(s, aff) {
  const voci = [];
  if (aff.flixbus) voci.push(`<li><a href="${e(aff.flixbus)}" rel="sponsored noopener">Autobus a lunga percorrenza FlixBus</a></li>`);
  if (aff.noleggio) voci.push(`<li><a href="${e(aff.noleggio.url)}" rel="sponsored noopener">Noleggio auto con ${e(aff.noleggio.nome)}</a></li>`);
  if (!voci.length) return '';
  return `<section class="riquadro riquadro-affiliato" aria-labelledby="alternative-titolo">
<h2 id="alternative-titolo">Devi viaggiare lo stesso?</h2>
<p>Alcune alternative per spostarti nei giorni di sciopero. Controlla sempre che non siano coinvolte anche loro.</p>
<p class="affiliato-eti">Link di affiliazione</p>
<ul>${voci.join('')}</ul>
<p class="nota">${e(avvisoAffiliato)}</p>
</section>`;
}

/** Spazio pubblicitario: predisposto ma vuoto. Si attiva solo con una piattaforma di consenso certificata (vedi DEPLOY.md). */
export function htmlPubblicita(aff) {
  if (!aff.pubblicita) return '';
  return '<aside class="spazio-pubblicita" aria-label="Pubblicità"></aside>';
}
