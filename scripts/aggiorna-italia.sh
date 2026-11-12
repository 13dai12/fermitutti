#!/bin/sh
# Aggiornamento degli scioperi da un computer in Italia.
#
# Il server del Ministero accetta solo connessioni dall'Italia, quindi GitHub non può leggerlo: lo legge questo computer.
# Lo avvia ogni 30 minuti il timer installato da scripts/installa-aggiornamento-italia.sh.
#
# Sicurezza:
# - esegue solo la copia fissa del codice in $BASE/codice, che cambia soltanto rilanciando l'installazione:
#   il codice che arriva da GitHub qui non viene mai eseguito;
# - nella copia del repository in $BASE/repo modifica e invia soltanto data/scioperi.json e data/stato.json,
#   più l'etichetta «stato» con l'ora dell'ultimo controllo;
# - prima di inviare costruisce il sito per prova, come farà Cloudflare.
# Uso a mano, per esempio dopo aver controllato un calo improvviso sul sito del Ministero:
#   ACCETTA_VARIAZIONE=1 sh ~/.local/share/fermitutti/aggiorna-italia.sh
set -eu

BASE="${FERMITUTTI_BASE:-$HOME/.local/share/fermitutti}"
CODICE="$BASE/codice"
REPO="$BASE/repo"
ESITO=$(mktemp)
PROVA=""
pulisci() {
  rm -f "$ESITO"
  if [ -n "$PROVA" ]; then rm -rf "$PROVA"; fi
}
trap pulisci EXIT

cd "$REPO"
# Se GitHub non risponde ci si ferma qui senza toccare niente: è un problema di rete di questo computer, non della fonte.
git fetch --quiet origin main
git reset --quiet --hard origin/main

set +e
GITHUB_OUTPUT="$ESITO" DATA_DIR="$REPO/data" node "$CODICE/scripts/aggiorna.mjs" "$@"
codice=$?
set -e
# 0 = tutto bene, 3 = fonte guasta (gestita: si pubblica lo stato). Qualsiasi altro codice è un errore vero.
if [ "$codice" -ne 0 ] && [ "$codice" -ne 3 ]; then
  echo "Aggiornamento interrotto da un errore (codice $codice): non invio niente." >&2
  exit "$codice"
fi

esito=$(sed -n 's/^esito=//p' "$ESITO" | tail -n 1)
if [ -z "$esito" ]; then
  echo "Lo script di aggiornamento non ha prodotto nessun esito: non invio niente." >&2
  exit 1
fi
pubblica=$(sed -n 's/^pubblica=//p' "$ESITO" | tail -n 1)
motivo=$(sed -n 's/^motivo=//p' "$ESITO" | tail -n 1)
pubblica_dati() {
  for file in data/scioperi.json data/stato.json; do
    if [ -e "$file" ]; then git add -- "$file"; fi
  done
  if git diff --cached --quiet; then
    echo "Nessun file cambiato."
    return 0
  fi

  # Prova di costruzione completa con il codice fisso e i dati nuovi: se fallisce non si invia niente.
  PROVA=$(mktemp -d)
  # Il percorso di build.mjs passa da una variabile: se fosse il primo argomento, build.mjs si crederebbe il programma principale.
  FERMITUTTI_BUILD="$CODICE/scripts/build.mjs" node --input-type=module -e "const { build } = await import(process.env.FERMITUTTI_BUILD); await build({ dataDir: process.argv[1], uscita: process.argv[2], log: () => {}, ambiente: {}, pubblicazione: false });" "$REPO/data" "$PROVA/public"

  git -c user.name='Fermi Tutti' -c user.email='sito@fermitutti.com' commit --quiet -m "Dati aggiornati: $motivo"
  git push --quiet origin HEAD:main
  echo "Pubblicato: $motivo."
}

# Ora dell'ultimo controllo per il sito, senza ripubblicarlo: un commit a parte, senza genitori, con il solo stato.json,
# inviato sull'etichetta «stato». Cloudflare costruisce solo i commit sui rami, quindi non consuma build; la sigla
# [CF-Pages-Skip] gli dice comunque di saltarlo. La legge functions/api/stato.js. Qui si arriva solo se i dati, quando
# andavano pubblicati, sono stati inviati: altrimenti lo script si è già fermato e il sito non mostra un controllo
# i cui dati non sono online. Le && servono perché dentro «if !» set -e non vale.
invia_ora_controllo() {
  oggetto=$(git hash-object -w data/stato.json) &&
    albero=$(printf '100644 blob %s\tstato.json\n' "$oggetto" | git mktree) &&
    commit=$(git -c user.name='Fermi Tutti' -c user.email='sito@fermitutti.com' commit-tree "$albero" -m "[CF-Pages-Skip] Ora dell'ultimo controllo") &&
    git push --quiet --force origin "$commit:refs/tags/stato"
}

if [ "$pubblica" = "true" ]; then
  pubblica_dati
else
  echo "Niente da pubblicare: $motivo."
fi
if ! invia_ora_controllo; then
  echo "Ora del controllo non inviata: si riprova al prossimo giro." >&2
fi
