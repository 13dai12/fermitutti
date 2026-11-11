// Nome ed email del titolare dalle variabili d'ambiente di Cloudflare Pages: non finiscono nel repository pubblico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { build, titolareDaAmbiente } from '../scripts/build.mjs';
import sito from '../config/sito.mjs';
import { archivioDiProva } from './aiuto.mjs';
import { CI_SONO_SEGNAPOSTI } from './dominio.mjs';

const copia = () => ({ ...sito, titolare: { ...sito.titolare } });
const A_CAPO = String.fromCharCode(10);
const NOME = 'Nome Di Prova';
const EMAIL = 'contatti@fermitutti.com';

function tuttiIFile(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...tuttiIFile(p)); else out.push(p);
  }
  return out;
}

test('anche nelle build di Workers (WORKERS_CI=1) la pubblicazione si ferma se mancano nome ed email', { skip: !CI_SONO_SEGNAPOSTI && 'nome ed email già scritti in config/sito.mjs' }, async () => {
  const radice = mkdtempSync(join(tmpdir(), 'fermitutti-workers-'));
  const prima = process.env.WORKERS_CI;
  process.env.WORKERS_CI = '1';
  try {
    const dati = join(radice, 'dati');
    mkdirSync(dati);
    writeFileSync(join(dati, 'scioperi.json'), JSON.stringify(archivioDiProva()));
    await assert.rejects(build({ dataDir: dati, uscita: join(radice, 'public'), oggi: '2026-11-11', immagini: false, log: () => {}, ambiente: {} }), /segnaposto ancora da compilare/);
  } finally {
    if (prima === undefined) delete process.env.WORKERS_CI; else process.env.WORKERS_CI = prima;
    rmSync(radice, { recursive: true, force: true });
  }
});

test('TITOLARE_NOME e TITOLARE_EMAIL sostituiscono i segnaposto, anche nel contatto di sicurezza', () => {
  const s = titolareDaAmbiente(copia(), { TITOLARE_NOME: `  ${NOME} `, TITOLARE_EMAIL: ` ${EMAIL}` });
  assert.equal(s.titolare.nome, NOME);
  assert.equal(s.titolare.email, EMAIL);
  assert.equal(s.emailSicurezza, EMAIL);
});

test('senza variabili, o con variabili vuote, restano i valori di config/sito.mjs', () => {
  for (const ambiente of [{}, { TITOLARE_NOME: '   ', TITOLARE_EMAIL: '' }]) {
    const s = titolareDaAmbiente(copia(), ambiente);
    assert.deepEqual(s.titolare, sito.titolare);
    assert.equal(s.emailSicurezza, sito.emailSicurezza);
  }
});

test('valori non validi fermano la build invece di finire nelle pagine o in security.txt', () => {
  for (const ambiente of [
    { TITOLARE_EMAIL: EMAIL + A_CAPO + 'Contact: mailto:altro@esempio.it' },
    { TITOLARE_EMAIL: 'non-una-email' },
    { TITOLARE_EMAIL: 'due@esempio.it, indirizzi@esempio.it' },
    { TITOLARE_NOME: 'Nome' + A_CAPO + 'Altro' },
    { TITOLARE_NOME: 'Nome' + String.fromCharCode(8232) + 'Altro' },
    { TITOLARE_NOME: 'x'.repeat(101) },
  ]) assert.throws(() => titolareDaAmbiente(copia(), ambiente), /TITOLARE_(NOME|EMAIL) non valid/);
});

test('su Cloudflare, con le variabili, la build parte e il nome compare solo nella pagina Privacy, fuori da Google', async () => {
  const radice = mkdtempSync(join(tmpdir(), 'fermitutti-titolare-'));
  try {
    const dati = join(radice, 'dati');
    mkdirSync(dati);
    writeFileSync(join(dati, 'scioperi.json'), JSON.stringify(archivioDiProva()));
    const uscita = join(radice, 'public');
    await build({ dataDir: dati, uscita, oggi: '2026-11-11', immagini: false, log: () => {}, pubblicazione: true, ambiente: { TITOLARE_NOME: NOME, TITOLARE_EMAIL: EMAIL } });
    const conNome = tuttiIFile(uscita).filter((f) => readFileSync(f).includes(NOME)).map((f) => relative(uscita, f)).sort();
    assert.deepEqual(conNome, ['privacy/index.html']);
    const privacy = readFileSync(join(uscita, 'privacy', 'index.html'), 'utf8');
    assert.match(privacy, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(readFileSync(join(uscita, 'sitemap.xml'), 'utf8'), /privacy/);
    assert.doesNotMatch(readFileSync(join(uscita, 'robots.txt'), 'utf8'), /privacy/, 'Google deve poter leggere il noindex');
    assert.match(readFileSync(join(uscita, 'note-legali', 'index.html'), 'utf8'), /gestito dal titolare indicato nella pagina <a href="\/privacy\/">Privacy<\/a>/);
    const conEmail = tuttiIFile(uscita).filter((f) => readFileSync(f).includes(EMAIL)).map((f) => relative(uscita, f)).sort();
    assert.deepEqual(conEmail, ['.well-known/security.txt', 'contatti/index.html', 'note-legali/index.html', 'privacy/index.html']);
    assert.match(readFileSync(join(uscita, '.well-known', 'security.txt'), 'utf8'), /^Contact: mailto:contatti@fermitutti[.]com$/m);
    assert.match(readFileSync(join(uscita, 'privacy', 'index.html'), 'utf8'), /passano dal servizio di inoltro di Cloudflare/);
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});
