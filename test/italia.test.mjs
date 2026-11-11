// Aggiornamento da un computer in Italia: lo script del timer contro una fonte finta e un «GitHub» locale.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { avviaFonteFinta } from '../scripts/fonte-finta.mjs';

const RADICE = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(RADICE, 'scripts', 'aggiorna-italia.sh');
let fonte;
let cartella;
before(async () => { fonte = await avviaFonteFinta(0); cartella = mkdtempSync(join(tmpdir(), 'fermitutti-italia-')); });
after(() => { fonte.server.close(); rmSync(cartella, { recursive: true, force: true }); });

const git = (...argomenti) => execFileSync('git', argomenti, { encoding: 'utf8' }).trim();
// Lo script va avviato senza bloccare questo processo: qui gira anche la fonte finta, che deve poter rispondere.
const esegui = promisify(execFile);

test('gli script per il computer in Italia sono sh valido', () => {
  for (const f of ['aggiorna-italia.sh', 'installa-aggiornamento-italia.sh']) execFileSync('sh', ['-n', join(RADICE, 'scripts', f)]);
});

test('aggiorna-italia.sh: legge la fonte, prova la build e invia solo i dati, e solo quando serve', async () => {
  // «GitHub»: un repository nudo che contiene solo un file qualsiasi.
  const nudo = join(cartella, 'github.git');
  git('init', '--quiet', '--bare', '--initial-branch=main', nudo);
  const lavoro = join(cartella, 'lavoro');
  git('init', '--quiet', '--initial-branch=main', lavoro);
  writeFileSync(join(lavoro, 'LEGGIMI'), 'prova\n');
  git('-C', lavoro, 'add', 'LEGGIMI');
  git('-C', lavoro, '-c', 'user.name=Prova', '-c', 'user.email=prova@esempio.it', 'commit', '--quiet', '-m', 'inizio');
  git('-C', lavoro, 'push', '--quiet', nudo, 'main');
  // Il computer in Italia: una copia del repository per i dati e il codice fisso, che qui è il progetto stesso.
  const base = join(cartella, 'base');
  mkdirSync(base);
  symlinkSync(RADICE, join(base, 'codice'));
  git('clone', '--quiet', nudo, join(base, 'repo'));
  const avvia = async (scenario, adesso) => (await esegui('sh', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, FERMITUTTI_BASE: base, FONTE_URL: `${fonte.url}/rss?scenario=${scenario}`, FONTE_HTML_URL: '', TENTATIVI: '1', ATTESA_MS: '1', TIMEOUT_MS: '2000', ADESSO: adesso },
  })).stdout;
  const commit = () => git('-C', nudo, 'rev-parse', 'main');
  const inizio = commit();

  // 1. Fonte buona: dati nuovi, build di prova, un commit con i soli file dei dati.
  assert.match(await avvia('ok', '2026-11-11T10:00:00Z'), /Pubblicato: dati cambiati/);
  const primo = commit();
  assert.notEqual(primo, inizio);
  assert.equal(git('-C', nudo, 'log', '-1', '--format=%an <%ae>|%s', 'main'), 'Fermi Tutti <sito@fermitutti.com>|Dati aggiornati: dati cambiati');
  assert.deepEqual(git('-C', nudo, 'show', '--format=', '--name-only', 'main').split('\n').sort(), ['data/scioperi.json', 'data/stato.json']);

  // 2. Mezz'ora dopo, stessi dati: nessun commit.
  assert.match(await avvia('ok', '2026-11-11T10:30:00Z'), /Niente da pubblicare/);
  assert.equal(commit(), primo);

  // 3. Fonte guasta: si pubblica solo lo stato, i dati degli scioperi restano quelli buoni.
  assert.match(await avvia('errore500', '2026-11-11T11:00:00Z'), /Pubblicato: fonte guasta/);
  assert.deepEqual(git('-C', nudo, 'show', '--format=', '--name-only', 'main').split('\n'), ['data/stato.json']);
  const stato = JSON.parse(git('-C', nudo, 'show', 'main:data/stato.json'));
  assert.equal(stato.fonte_guasta_dal, '2026-11-11T11:00:00.000Z');
  assert.match(stato.ultimo_errore.messaggio, /HTTP 500/);
});
