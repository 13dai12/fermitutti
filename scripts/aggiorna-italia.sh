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
# Secondi di attesa tra un tentativo e l'altro di raggiungere GitHub (60, poi 120). Le prove li mettono a zero.
ATTESA_RETE="${FERMITUTTI_ATTESA_RETE:-60}"
ESITO=$(mktemp)
ERRORI_GIT=$(mktemp)
PROVA=""
pulisci() {
  rm -f "$ESITO" "$ERRORI_GIT"
  if [ -n "$PROVA" ]; then rm -rf "$PROVA"; fi
}
trap pulisci EXIT

# Nome del server del repository remoto (github.com), per capire se manca proprio la rete. Vuoto per un percorso locale.
server_remoto() {
  indirizzo=$(git remote get-url origin)
  case "$indirizzo" in
    *://*) indirizzo=${indirizzo#*://}; indirizzo=${indirizzo#*@}; indirizzo=${indirizzo%%[:/]*} ;;
    *@*:*) indirizzo=${indirizzo#*@}; indirizzo=${indirizzo%%:*} ;;
    *) indirizzo="" ;;
  esac
  printf '%s' "$indirizzo"
}

# Vero se questo computer non riesce nemmeno a trovare l'indirizzo del server: la connessione a internet manca.
rete_assente() {
  server=$(server_remoto)
  [ -n "$server" ] && command -v getent >/dev/null 2>&1 && ! getent hosts "$server" >/dev/null 2>&1
}

cd "$REPO"
# Se GitHub non risponde ci si ferma qui senza toccare niente: è un problema di rete di questo computer, non della fonte.
# Dopo una sospensione o un cambio di rete la connessione può tornare con qualche minuto di ritardo: si riprova due volte.
# Codice di uscita 75 = nessuna connessione a internet (lo legge anche «npm run stato»).
tentativo=1
until git fetch --quiet origin main 2>"$ERRORI_GIT"; do
  if [ "$tentativo" -ge 3 ]; then
    if rete_assente; then
      echo "Nessuna connessione a internet: questo computer non trova $(server_remoto). Non ho controllato niente e non ho toccato i dati. Riprovo da solo al prossimo giro, tra mezz'ora." >&2
      exit 75
    fi
    echo "GitHub non risponde o non accetta la chiave SSH di questo computer. Non ho toccato i dati. Messaggio di git:" >&2
    cat "$ERRORI_GIT" >&2
    exit 1
  fi
  sleep $((ATTESA_RETE * tentativo))
  tentativo=$((tentativo + 1))
done
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
  # Se l'invio non riesce (rete caduta proprio adesso) non si perde niente: il prossimo giro riparte da GitHub e rifà tutto.
  if ! git push --quiet origin HEAD:main; then
    echo "Invio a GitHub non riuscito: riprovo da solo al prossimo giro." >&2
    exit 1
  fi
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
