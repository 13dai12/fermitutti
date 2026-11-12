#!/usr/bin/env node
// Genera il sito statico in public/ a partire da data/ e config/.
// Uso: node scripts/build.mjs
// Variabili d'ambiente facoltative (per prove in locale):
//   URL_BASE=http://localhost:8080   indirizzo del sito al posto di quello in config/sito.mjs
//   OGGI=2026-11-11                  data di riferimento (fuso di Roma) al posto di oggi
//   DATA_DIR=...                     cartella dei dati
//   SALTA_IMMAGINI=1                 non genera le immagini di anteprima (più veloce)
//   USCITA=...                       cartella di uscita (predefinita: public)
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import configSito from '../config/sito.mjs';
import configAffiliati from '../config/affiliati.mjs';
import { oggiRoma, dataLunga } from './lib/date.mjs';
import { CITTA, REGIONI } from './lib/luoghi.mjs';
import { titoloScheda } from './lib/presenta.mjs';
import { validaFasce, TUTTE as FASCE } from './lib/fasce.mjs';
import { preparaAffiliati } from './lib/affiliati.mjs';
import { evento, calendario } from './lib/ics.mjs';
import { toccaZona, toccaSettore, perPasseggeri } from '../src/js/filtri.mjs';
import { validaArchivio } from './lib/valida-archivio.mjs';
import { creaContesto, testiEvento, datiAnteprima } from './lib/contesto.mjs';
import * as P from './lib/pagine.mjs';
import { jsSenzaCommenti, cssSenzaCommenti } from './lib/compatta.mjs';

export { validaArchivio };

const RADICE = fileURLToPath(new URL('..', import.meta.url));
function leggiJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function scrivi(percorso, contenuto) {
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, contenuto);
}

function segnaposti(sito) {
  const trovati = [];
  const controlla = (nome, v) => { if (typeof v === 'string' && /\[[A-ZÀ-Ý -]+\]/.test(v)) trovati.push(`${nome}: ${v}`); };
  controlla('titolare.nome', sito.titolare.nome);
  controlla('titolare.email', sito.titolare.email);
  controlla('emailSicurezza', sito.emailSicurezza);
  return trovati;
}

/**
 * Nome ed email del titolare possono arrivare dalle variabili d'ambiente di Cloudflare Pages, TITOLARE_NOME e TITOLARE_EMAIL.
 * Così il nome non finisce nel repository pubblico né nella sua storia. I valori finiscono nelle pagine e in security.txt,
 * quindi quelli non validi fermano la build invece di essere pubblicati.
 */
export function titolareDaAmbiente(sito, ambiente = process.env) {
  const leggi = (nome) => (typeof ambiente[nome] === 'string' && ambiente[nome].trim() ? ambiente[nome].trim() : null);
  const nome = leggi('TITOLARE_NOME');
  const email = leggi('TITOLARE_EMAIL');
  if (nome !== null) {
    const controllo = (c) => { const n = c.codePointAt(0); return n < 32 || (n >= 127 && n < 160) || n === 8232 || n === 8233; };
    if (nome.length > 100 || [...nome].some(controllo)) throw new Error('TITOLARE_NOME non valido: scrivi solo nome e cognome, su una riga.');
    sito.titolare.nome = nome;
  }
  if (email !== null) {
    if (email.length > 254 || !/^[^\s@<>"'()]+@[a-z0-9-]+([.][a-z0-9-]+)*[.][a-z]{2,}$/i.test(email)) throw new Error('TITOLARE_EMAIL non valida: scrivi un solo indirizzo, per esempio contatti@fermitutti.com.');
    if (/\[[A-ZÀ-Ý -]+\]/.test(sito.emailSicurezza) || sito.emailSicurezza === sito.titolare.email) sito.emailSicurezza = email;
    sito.titolare.email = email;
  }
  return sito;
}

function hash(testo) { return createHash('sha256').update(testo).digest('hex').slice(0, 10); }

/**
 * Le statistiche di Cloudflare (spente di default) caricano uno script esterno: se si accendono, la politica di sicurezza
 * deve permettere solo quei due indirizzi. Trusted Types si toglie perché lo script di Cloudflare non lo supporta.
 */
export function intestazioniPerConfigurazione(testo, sito) {
  if (!sito.statisticheCloudflare) return testo;
  return testo
    .replace("script-src 'self';", "script-src 'self' https://static.cloudflareinsights.com;")
    .replace("connect-src 'self';", "connect-src 'self' https://cloudflareinsights.com;")
    .replace("; require-trusted-types-for 'script'; trusted-types 'none'", '');
}

export async function build({ dataDir = join(RADICE, 'data'), uscita = join(RADICE, 'public'), oggi = oggiRoma(), urlBase = null, immagini = true, log = console.log, pubblicazione = process.env.CF_PAGES === '1' || process.env.WORKERS_CI === '1', ambiente = process.env } = {}) {
  const sito = titolareDaAmbiente({ ...configSito, titolare: { ...configSito.titolare } }, ambiente);
  // Su Cloudflare (Pages imposta CF_PAGES=1, Workers Builds imposta WORKERS_CI=1) non si pubblica un sito con i segnaposto: email e nome del titolare devono essere veri.
  const mancanti = segnaposti(sito);
  if (pubblicazione && mancanti.length) {
    throw new Error(`segnaposto ancora da compilare. Su Cloudflare Pages aggiungi le variabili TITOLARE_NOME e TITOLARE_EMAIL, oppure compila config/sito.mjs (vedi DEPLOY.md, passo 5):\n  - ${mancanti.join('\n  - ')}`);
  }
  if (urlBase) sito.urlBase = urlBase.replace(/\/+$/, '');
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(sito.urlBase)) throw new Error(`urlBase non valido: ${sito.urlBase}`);
  if (!sito.urlBase.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(sito.urlBase)) throw new Error('urlBase deve iniziare con https://');
  const aff = preparaAffiliati(configAffiliati);
  validaFasce();
  const archivio = leggiJson(join(dataDir, 'scioperi.json'));
  validaArchivio(archivio);
  const stato = existsSync(join(dataDir, 'stato.json')) ? leggiJson(join(dataDir, 'stato.json')) : {};
  const kb = leggiJson(join(RADICE, 'data', 'assistente.json'));
  const luoghi = leggiJson(join(RADICE, 'data', 'luoghi.json'));

  // File statici e versione (per evitare che il browser usi CSS o JS vecchi dopo un aggiornamento).
  const fileJs = readdirSync(join(RADICE, 'src', 'js')).filter((f) => f.endsWith('.mjs'));
  const sorgenti = [readFileSync(join(RADICE, 'src', 'stile.css'), 'utf8'), readFileSync(join(RADICE, 'src', 'tema.js'), 'utf8'), readFileSync(join(RADICE, 'src', 'widget.css'), 'utf8'),
    ...fileJs.map((f) => readFileSync(join(RADICE, 'src', 'js', f), 'utf8'))];
  const versione = hash(sorgenti.join('\n'));

  const ctx = creaContesto({ archivio, stato, oggi, sito, aff, versione });
  const { compatti, compattiPerId, settori } = ctx;

  rmSync(uscita, { recursive: true, force: true });
  mkdirSync(uscita, { recursive: true });
  const pagine = [];
  const scriviPagina = (percorso, html, { sitemap = true, lastmod = null } = {}) => {
    const file = percorso.endsWith('/') ? join(uscita, percorso, 'index.html') : join(uscita, percorso);
    scrivi(file, html);
    if (sitemap) pagine.push({ percorso, lastmod });
  };

  // Pagine
  scriviPagina('/', P.paginaHome(ctx), { lastmod: stato.ultima_modifica_dati });
  for (const s of archivio.scioperi) {
    const c = compattiPerId.get(s.id);
    const vecchio = s.giorno_a < oggi;
    scriviPagina(`/sciopero/${s.slug}/`, P.paginaSciopero(ctx, s), { sitemap: !vecchio && c.stato !== 'rimosso', lastmod: s.modificato_il });
  }
  for (const c of CITTA) scriviPagina(`/citta/${c.slug}/`, P.paginaCitta(ctx, c), { lastmod: stato.ultima_modifica_dati });
  for (const r of REGIONI) scriviPagina(`/regione/${r.slug}/`, P.paginaRegione(ctx, r), { lastmod: stato.ultima_modifica_dati });
  for (const st of settori) scriviPagina(`/settore/${st.slug}/`, P.paginaSettore(ctx, st), { lastmod: stato.ultima_modifica_dati });
  scriviPagina('/citta/', P.paginaElencoCitta(ctx));
  scriviPagina('/settore/', P.paginaElencoSettori(ctx));
  scriviPagina('/calendario/', P.paginaCalendario(ctx));
  scriviPagina('/assistente/', P.paginaAssistente(ctx));
  scriviPagina('/incorpora/', P.paginaIncorpora(ctx));
  scriviPagina('/come-funziona/', P.paginaComeFunziona(ctx));
  scriviPagina('/fonti/', P.paginaFonti(ctx));
  scriviPagina('/privacy/', P.paginaPrivacy(ctx), { sitemap: false });
  scriviPagina('/note-legali/', P.paginaNoteLegali(ctx));
  scriviPagina('/contatti/', P.paginaContatti(ctx));
  scriviPagina('/stato/', P.paginaStato(ctx), { sitemap: false });
  scriviPagina('/404.html', P.pagina404(ctx), { sitemap: false });
  for (const c of CITTA) scriviPagina(`/widget/${c.slug}/`, P.paginaWidget(ctx, c), { sitemap: false });

  // CSS e JavaScript
  // Al browser arrivano i file senza commenti: meno byte e nessuna nota interna in chiaro.
  scrivi(join(uscita, 'stile.css'), cssSenzaCommenti(readFileSync(join(RADICE, 'src', 'stile.css'), 'utf8')));
  scrivi(join(uscita, 'tema.js'), jsSenzaCommenti(readFileSync(join(RADICE, 'src', 'tema.js'), 'utf8')));
  scrivi(join(uscita, 'widget', 'stile.css'), cssSenzaCommenti(readFileSync(join(RADICE, 'src', 'widget.css'), 'utf8')));
  for (const f of fileJs) {
    const js = jsSenzaCommenti(readFileSync(join(RADICE, 'src', 'js', f), 'utf8'))
      .replace(/from '\.\/([a-z0-9-]+)\.mjs'/g, `from './$1.js?v=${versione}'`)
      .replace(/import\('\.\/([a-z0-9-]+)\.mjs'\)/g, `import('./$1.js?v=${versione}')`);
    scrivi(join(uscita, 'js', f.replace(/\.mjs$/, '.js')), js);
  }
  scrivi(join(uscita, 'icona.svg'), readFileSync(join(RADICE, 'src', 'icona.svg')));
  // Carattere del marchio (Atkinson Hyperlegible, licenza OFL), ridotto ai caratteri latini: niente font da servizi esterni.
  for (const f of readdirSync(join(RADICE, 'src', 'caratteri'))) scrivi(join(uscita, 'caratteri', f), readFileSync(join(RADICE, 'src', 'caratteri', f)));
  scrivi(join(uscita, 'caratteri', 'OFL.txt'), readFileSync(join(RADICE, 'assets', 'fonts', 'OFL.txt')));
  scrivi(join(uscita, '_headers'), intestazioniPerConfigurazione(readFileSync(join(RADICE, 'src', '_headers'), 'utf8'), sito));
  // Gli archivi del web non copiano la pagina Privacy, che contiene il nome del titolare. Google invece deve poterla
  // leggere per vedere il noindex, quindi il gruppo «*» non la blocca.
  scrivi(join(uscita, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /widget/\n\nUser-agent: ia_archiver\nUser-agent: archive.org_bot\nDisallow: /widget/\nDisallow: /privacy/\n\nSitemap: ${sito.urlBase}/sitemap.xml\n`);
  const scadenza = new Date(Date.parse(`${oggi}T00:00:00Z`) + 180 * 86400000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
  scrivi(join(uscita, '.well-known', 'security.txt'), `# Segnalazioni di sicurezza per ${sito.dominio} (RFC 9116).\nContact: mailto:${sito.emailSicurezza}\nExpires: ${scadenza}\nPreferred-Languages: it, en\nCanonical: ${sito.urlBase}/.well-known/security.txt\nPolicy: ${sito.urlBase}/note-legali/\n`);

  // Dati per il browser
  const statoPubblico = {
    ultima_verifica_riuscita: stato.ultima_verifica_riuscita ?? null,
    ultima_modifica_dati: stato.ultima_modifica_dati ?? null,
    ultima_pubblicazione: stato.ultima_pubblicazione ?? null,
    ultimo_tentativo: stato.ultimo_tentativo ?? null,
    fonte_guasta_dal: stato.fonte_guasta_dal ?? null,
    fonte_aggiornata_al: stato.fonte_aggiornata_al ?? null,
    ore_avviso: sito.oreAvvisoDatiVecchi,
    costruito_il: new Date().toISOString(),
    oggi_build: oggi,
  };
  scrivi(join(uscita, 'dati', 'scioperi.json'), JSON.stringify({ stato: statoPubblico, scioperi: compatti }));
  scrivi(join(uscita, 'dati', 'stato.json'), JSON.stringify(statoPubblico));
  const fascePerAssistente = FASCE.filter((v) => v.mostra !== false).map((v) => ({
    tipo: v.tipo, citta: v.citta || null, regione: v.regione || (v.ambito !== 'nazionale' ? v.ambito : null), azienda: v.azienda,
    fasce: v.fasce, citazione: v.fasce_testo, fonte: v.fonte_url, avvisi: v.pagina_scioperi_url, origine: v.origine, avviso_del: v.avviso_del, verificato_il: v.verificato_il, nota: v.note || null,
  }));
  scrivi(join(uscita, 'dati', 'base.json'), JSON.stringify({
    luoghi: { regioni: luoghi.regioni, citta: luoghi.citta },
    settori: settori.map((s) => ({ slug: s.slug, nome: s.nome, breve: s.breve })),
    assistente: kb,
    fasce: fascePerAssistente,
  }));

  // Calendari
  const eventiCache = new Map(archivio.scioperi.map((s) => [s.id, evento(s, testiEvento(ctx, s))]));
  const prodid = `-//${sito.nome}//Scioperi trasporti//IT`;
  const scriviIcs = (nome, titolo, descrizione, scelti) => {
    scrivi(join(uscita, 'ics', `${nome}.ics`), calendario({ nome: `${titolo} (${sito.nome})`, descrizione, prodid, eventi: scelti.map((s) => eventiCache.get(s.id)) }));
  };
  const nelCalendario = archivio.scioperi; // anche revocati e conclusi recenti: i calendari devono ricevere la revoca
  const daCompatto = (s) => compattiPerId.get(s.id);
  scriviIcs('italia', 'Tutti gli scioperi in Italia', 'Scioperi dei trasporti in tutta Italia dal calendario ufficiale del Ministero.', nelCalendario);
  for (const c of CITTA) {
    const zona = { tipo: 'citta', provincia: c.provincia, regione: c.regione };
    scriviIcs(`citta-${c.slug}`, `Scioperi a ${c.nome}`, `Scioperi locali, della regione ${c.regione} e nazionali che toccano ${c.nome} (senza il solo trasporto merci).`,
      nelCalendario.filter((s) => toccaZona(daCompatto(s), zona) && perPasseggeri(daCompatto(s))));
  }
  for (const r of REGIONI) {
    const zona = { tipo: 'regione', regione: r.nome };
    scriviIcs(`regione-${r.slug}`, `Scioperi in ${r.nome}`, `Scioperi locali, regionali e nazionali che toccano la regione ${r.nome} (senza il solo trasporto merci).`,
      nelCalendario.filter((s) => toccaZona(daCompatto(s), zona) && perPasseggeri(daCompatto(s))));
  }
  for (const st of settori) {
    scriviIcs(`settore-${st.slug}`, `Scioperi: ${st.nome.toLowerCase()}`, `Scioperi del settore ${st.nome.toLowerCase()} in tutta Italia, compresi gli scioperi generali che lo riguardano.`,
      nelCalendario.filter((s) => toccaSettore(daCompatto(s), [st.slug])));
  }
  for (const s of archivio.scioperi) {
    scrivi(join(uscita, 'ics', 'sciopero', `${s.slug}.ics`), calendario({ nome: titoloScheda(s), descrizione: `Sciopero del ${dataLunga(s.inizio)}`, prodid, eventi: [eventiCache.get(s.id)] }));
  }

  // Sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pagine.map((p) => `<url><loc>${sito.urlBase}${p.percorso}</loc>${p.lastmod ? `<lastmod>${new Date(p.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  scrivi(join(uscita, 'sitemap.xml'), sitemap);

  // Immagini di anteprima
  if (immagini) {
    const og = await import('./lib/og.mjs');
    await og.preparaRenderer();
    scrivi(join(uscita, 'og', 'predefinita.png'), og.pngDaSvg(og.svgPredefinita(sito)));
    scrivi(join(uscita, 'icona-180.png'), og.pngDaSvg(og.svgIcona(180)));
    const predefinita = readFileSync(join(uscita, 'og', 'predefinita.png'));
    for (const s of archivio.scioperi) {
      try {
        scrivi(join(uscita, 'og', `${s.slug}.png`), og.pngDaSvg(og.svgAnteprima(datiAnteprima(ctx, s))));
      } catch (e) {
        // Un'immagine che non si riesce a disegnare non deve fermare il sito: si usa quella generica.
        log(`ATTENZIONE: anteprima di ${s.id} non generata (${e.message}): uso quella generica.`);
        scrivi(join(uscita, 'og', `${s.slug}.png`), predefinita);
      }
    }
  }

  const avvisi = segnaposti(sito);
  if (avvisi.length) log(`ATTENZIONE: segnaposto ancora da compilare. Su Cloudflare servono le variabili TITOLARE_NOME e TITOLARE_EMAIL, oppure i dati in config/sito.mjs:\n  - ${avvisi.join('\n  - ')}`);
  if (aff.pubblicita) log('ATTENZIONE: pubblicita.attiva è true. Prima di mostrare pubblicità serve una piattaforma di consenso certificata da Google (vedi DEPLOY.md).');
  log(`Build completata: ${pagine.length} pagine nella sitemap, ${archivio.scioperi.length} scioperi, data di riferimento ${oggi}, versione ${versione}.`);
  return { pagine: pagine.length, versione, uscita };
}

/** Vero solo se questo file è stato avviato come programma (non importato). Percorsi reali, così vale anche da un collegamento. */
function eProgrammaPrincipale() {
  try { return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
}

// Avviato come programma: si confrontano i percorsi reali, così funziona anche passando da un collegamento simbolico.
if (eProgrammaPrincipale()) {
  try {
    await build({
      dataDir: process.env.DATA_DIR || undefined,
      uscita: process.env.USCITA || undefined,
      oggi: process.env.OGGI || undefined,
      urlBase: process.env.URL_BASE || null,
      immagini: process.env.SALTA_IMMAGINI !== '1',
    });
  } catch (e) {
    console.error(`\nBUILD FALLITA: ${e.message}\n`);
    process.exit(1);
  }
}
