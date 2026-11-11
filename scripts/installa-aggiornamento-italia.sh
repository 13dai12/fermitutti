#!/bin/sh
# Installa l'aggiornamento automatico degli scioperi su questo computer, che deve trovarsi in Italia.
# Crea una copia fissa del codice, una copia del repository per i dati e un timer di systemd che parte ogni 30 minuti.
# Rilancialo dopo ogni modifica al codice: è l'unico modo in cui cambia il codice eseguito dal timer.
# Per vedere cosa ha fatto:  journalctl --user-unit fermitutti-aggiorna -n 30
# Per toglierlo:             systemctl --user disable --now fermitutti-aggiorna.timer
set -eu

SORGENTE=$(cd "$(dirname "$0")/.." && pwd)
BASE="${FERMITUTTI_BASE:-$HOME/.local/share/fermitutti}"
UNITA="$HOME/.config/systemd/user"

for programma in git node npm tar systemctl; do
  command -v "$programma" >/dev/null || { echo "Manca il programma $programma." >&2; exit 1; }
done
REMOTO=$(git -C "$SORGENTE" remote get-url origin)
if [ -n "$(git -C "$SORGENTE" status --porcelain)" ]; then
  echo "Nota: ci sono modifiche non salvate nella cartella del progetto. Installo l'ultimo commit." >&2
fi

mkdir -p "$BASE" "$UNITA"
systemctl --user stop fermitutti-aggiorna.service 2>/dev/null || true

echo "1/4 Copia fissa del codice, presa dall'ultimo commit, con le sole dipendenze della build..."
rm -rf "$BASE/codice.nuovo"
mkdir -p "$BASE/codice.nuovo"
git -C "$SORGENTE" archive HEAD | tar -x -C "$BASE/codice.nuovo"
(cd "$BASE/codice.nuovo" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error)
git -C "$SORGENTE" rev-parse --short HEAD > "$BASE/codice.nuovo/VERSIONE"
rm -rf "$BASE/codice"
mv "$BASE/codice.nuovo" "$BASE/codice"

echo "2/4 Copia del repository usata solo per i dati..."
if [ ! -d "$BASE/repo/.git" ]; then
  git clone --quiet "$REMOTO" "$BASE/repo"
fi

echo "3/4 Script e timer di systemd..."
cp "$SORGENTE/scripts/aggiorna-italia.sh" "$BASE/aggiorna-italia.sh"
chmod 700 "$BASE/aggiorna-italia.sh"
cat > "$UNITA/fermitutti-aggiorna.service" <<FINE
[Unit]
Description=Fermi Tutti: legge il calendario degli scioperi del Ministero e pubblica i dati

[Service]
Type=oneshot
Environment=FERMITUTTI_BASE=$BASE
ExecStart=/bin/sh $BASE/aggiorna-italia.sh
TimeoutStartSec=15min
Nice=10
FINE
cat > "$UNITA/fermitutti-aggiorna.timer" <<'FINE'
[Unit]
Description=Fermi Tutti: aggiornamento degli scioperi ogni 30 minuti

[Timer]
OnCalendar=*-*-* *:07,37:00
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
FINE
systemctl --user daemon-reload
systemctl --user enable --now fermitutti-aggiorna.timer

echo "4/4 Primo aggiornamento adesso..."
systemctl --user start fermitutti-aggiorna.service || true
journalctl --user-unit fermitutti-aggiorna -n 12 --no-pager -o cat || true

echo
echo "Fatto. Codice alla versione $(cat "$BASE/codice/VERSIONE")."
systemctl --user list-timers fermitutti-aggiorna.timer --no-pager || true
