#!/usr/bin/env bash
# Ri-deploy di PalEstra sul server: aggiorna il codice, ricostruisce,
# applica le migrazioni e riavvia il servizio.
#
# Da lanciare con un tuo utente normale con sudo (NON con l'utente di
# servizio `palestra`, che non ha shell ne' sudo). Il primo setup a mano e'
# descritto nel README.
#
# Le migrazioni sono additive e idempotenti: rilanciarle e' sicuro. Nessuno
# script qui cancella dati: lo storico degli allenamenti e' il valore del
# prodotto.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="palestra"
SERVICE_USER="palestra"

run_as_app() { sudo -u "$SERVICE_USER" env -C "$APP_DIR" "$@"; }

echo "==> Aggiorno il codice in $APP_DIR..."
run_as_app git pull --ff-only

echo "==> Installo le dipendenze..."
# `npm ci` include le devDependencies: servono per compilare (next, tsc,
# tailwind). Il bundle standalone che ne esce non le contiene.
run_as_app npm ci

echo "==> Compilo..."
run_as_app npm run build

# Il server standalone si aspetta static e public accanto a se'.
echo "==> Copio gli asset statici..."
run_as_app cp -r .next/static .next/standalone/.next/static
run_as_app cp -r public .next/standalone/public 2>/dev/null || true

echo "==> Applico le migrazioni..."
run_as_app npm run db:migrate

echo "==> Riavvio $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

echo "==> Fatto. Stato:"
sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
