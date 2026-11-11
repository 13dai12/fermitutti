// Build completa in una cartella temporanea con i dati di prova (usata da più file di test).
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { archivioDiProva } from './aiuto.mjs';

let promessa = null;
export function buildDiProva() {
  if (promessa) return promessa;
  promessa = (async () => {
    const radice = mkdtempSync(join(tmpdir(), 'fermitutti-build-'));
    const dati = join(radice, 'dati');
    mkdirSync(dati);
    writeFileSync(join(dati, 'scioperi.json'), JSON.stringify(archivioDiProva()));
    writeFileSync(join(dati, 'stato.json'), JSON.stringify({ ultima_verifica_riuscita: '2026-11-11T07:00:00.000Z', ultima_modifica_dati: '2026-11-11T07:00:00.000Z', ultima_pubblicazione: '2026-11-11T07:00:00.000Z', fonte_guasta_dal: null, scioperi_nel_feed: 33 }));
    const messaggi = [];
    const uscita = join(radice, 'public');
    const esito = await build({ dataDir: dati, uscita, oggi: '2026-11-11', immagini: true, log: (m) => messaggi.push(m), ambiente: {} });
    return { uscita, messaggi, esito, radice };
  })();
  return promessa;
}
