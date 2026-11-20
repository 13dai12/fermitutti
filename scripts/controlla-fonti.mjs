#!/usr/bin/env node
// Controlla i link alle fonti delle fasce garantite (data/fasce_garanzia.json) che il sito mostra ai visitatori,
// e segnala le voci da ricontrollare perché vecchie. Non modifica niente.
// Uso: npm run controlla-fonti     (meglio dal computer in Italia: alcuni siti rispondono solo dall'Italia)
// Le aziende cambiano spesso le pagine: conviene lanciarlo ogni qualche mese e correggere i link rotti.
import { TUTTE, linkFonte } from './lib/fasce.mjs';

const UA = 'FermiTutti/1.0 (controllo dei link alle fonti ufficiali)';
const MESI_AVVISO = 6;
const MESI_VERIFICA = 12;
const adesso = new Date();
const mesiFa = (data) => (adesso - new Date(`${data}T12:00:00Z`)) / (30.44 * 86400000);

async function prova(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA, accept: 'text/html,application/pdf,*/*' } });
      // Alcuni server rifiutano HEAD ma rispondono a GET: si riprova.
      if (method === 'HEAD' && r.status >= 400) continue;
      return { stato: r.status };
    } catch (e) {
      if (method === 'GET') return { errore: e.name === 'TimeoutError' ? 'nessuna risposta in 20 secondi' : String(e.cause?.code || e.message) };
    }
  }
  return { errore: 'nessuna risposta' };
}

/** «ATB (Bergamo)», ma «AMTS Catania» senza ripetere la città. */
const nome = (v) => (v.citta && !v.azienda.includes(v.citta) ? `${v.azienda} (${v.citta})` : v.azienda);

const voci = TUTTE.filter((v) => v.mostra !== false);
const daProvare = new Map();
for (const v of voci) {
  for (const url of new Set([linkFonte(v), v.pagina_scioperi_url].filter(Boolean))) {
    if (!daProvare.has(url)) daProvare.set(url, []);
    daProvare.get(url).push(nome(v));
  }
}
console.log(`Controllo ${daProvare.size} link delle fonti di ${voci.length} aziende...\n`);

const elenco = [...daProvare.keys()];
const esiti = new Map();
let prossimo = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (prossimo < elenco.length) {
    const url = elenco[prossimo++];
    esiti.set(url, await prova(url));
  }
}));

let rotti = 0, dubbi = 0, buoni = 0;
for (const [url, aziende] of daProvare) {
  const r = esiti.get(url);
  const chi = [...new Set(aziende)].join(', ');
  if (r.stato === 404 || r.stato === 410) {
    rotti++;
    console.log(`✘ ${chi}: la pagina non esiste più (errore ${r.stato})\n    ${url}`);
  } else if (r.stato >= 400 || r.errore) {
    dubbi++;
    console.log(`? ${chi}: ${r.errore ? `non risponde (${r.errore})` : `rifiuta i controlli automatici (errore ${r.stato})`}. Aprila nel browser per vedere se funziona.\n    ${url}`);
  } else {
    buoni++;
  }
}
console.log(`${rotti || dubbi ? '\n' : ''}✔ ${buoni} link su ${daProvare.size} funzionano.`);

const avvisiVecchi = voci.filter((v) => v.origine === 'avviso' && v.avviso_del && mesiFa(v.avviso_del) > MESI_AVVISO);
if (avvisiVecchi.length) {
  console.log(`\nFasce prese da avvisi di più di ${MESI_AVVISO} mesi fa (possono essere cambiate, conviene cercare un avviso più recente):`);
  for (const v of avvisiVecchi) console.log(`- ${nome(v)}: avviso dello sciopero del ${v.avviso_del}`);
}
const daVerificare = voci.filter((v) => mesiFa(v.verificato_il) > MESI_VERIFICA);
if (daVerificare.length) {
  console.log(`\nVoci verificate più di ${MESI_VERIFICA} mesi fa (da rileggere sulla pagina ufficiale):`);
  for (const v of daVerificare) console.log(`- ${nome(v)}: verificata il ${v.verificato_il}`);
}
if (rotti) console.log('\nPer correggere un link rotto: cerca la pagina nuova sul sito dell\'azienda e aggiorna data/fasce_garanzia.json (citazione testuale, data di verifica). Vedi NOTE_PROGETTO.md, «Fasce di garanzia».');
process.exit(rotti ? 1 : 0);
