// Regole di sicurezza per i workflow di GitHub Actions (controlli testuali, senza dipendenze).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const cartella = new URL('../.github/workflows/', import.meta.url);
const workflow = readdirSync(cartella).filter((f) => f.endsWith('.yml')).map((f) => ({ nome: f, testo: readFileSync(new URL(f, cartella), 'utf8') }));

test('ci sono i workflow attesi', () => {
  assert.deepEqual(workflow.map((w) => w.nome).sort(), ['aggiorna.yml', 'controllo-online.yml', 'verifica.yml']);
});

for (const { nome, testo } of workflow) {
  test(`${nome}: azioni bloccate al commit, permessi minimi, timeout`, () => {
    for (const m of testo.matchAll(/uses:\s*([^\s#]+)/g)) {
      assert.match(m[1], /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `azione non bloccata a uno SHA completo: ${m[1]}`);
    }
    assert.match(testo, /^permissions: \{\}$/m, 'permessi predefiniti vuoti');
    assert.doesNotMatch(testo, /pull_request_target|workflow_run/, 'eventi pericolosi');
    const lavori = testo.slice(testo.indexOf('\njobs:\n')).split(/\n  (?=[a-z-]+:\n    )/).slice(1);
    assert.ok(lavori.length >= 1);
    for (const l of lavori) {
      assert.match(l, /timeout-minutes: \d+/, `timeout mancante in ${l.split(':')[0]}`);
      assert.match(l, /permissions:\n/, `permessi mancanti in ${l.split(':')[0]}`);
      assert.doesNotMatch(l, /write-all|read-all/);
    }
    assert.doesNotMatch(testo, /persist-credentials: true/);
    for (const m of testo.matchAll(/uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n(\s+with:\n(?:\s{10}.*\n)+)?/g)) {
      assert.match(m[0], /persist-credentials: false/, 'checkout senza credenziali salvate');
    }
  });

  test(`${nome}: nessuna espressione \${{ }} dentro gli script (iniezione di comandi)`, () => {
    const righe = testo.split('\n');
    let dentroRun = false, rientro = 0;
    for (const riga of righe) {
      const r = /^(\s*)(?:- )?run: \|/.exec(riga);
      if (r) { dentroRun = true; rientro = r[1].length; continue; }
      if (dentroRun) {
        const spazi = /^(\s*)/.exec(riga)[1].length;
        if (riga.trim() && spazi <= rientro) dentroRun = false;
        else assert.ok(!riga.includes('${{'), `espressione dentro uno script: ${riga.trim()}`);
      }
      if (/^\s*(?:- )?run: (?!\|)/.test(riga)) assert.ok(!riga.includes('${{'), `espressione dentro uno script: ${riga.trim()}`);
    }
  });
}

test('il lavoro con permesso di scrittura non installa dipendenze npm', () => {
  const t = workflow.find((w) => w.nome === 'aggiorna.yml').testo;
  const lavoro = t.slice(t.indexOf('  aggiorna:'), t.indexOf('  prova-build:'));
  assert.match(lavoro, /contents: write/);
  assert.doesNotMatch(lavoro, /npm (ci|install)|npx /);
  const prova = t.slice(t.indexOf('  prova-build:'), t.indexOf('  segnala:'));
  assert.match(prova, /contents: read/);
  assert.match(prova, /npm ci --omit=dev --ignore-scripts/);
});

test('Dependabot controlla npm e le azioni di GitHub', () => {
  const d = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');
  assert.match(d, /package-ecosystem: npm/);
  assert.match(d, /package-ecosystem: github-actions/);
});
