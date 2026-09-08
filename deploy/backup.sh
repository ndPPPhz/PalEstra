#!/usr/bin/env bash
# Dump notturno del database, con rotazione a 14 giorni.
#
# Installalo come timer systemd:
#   sudo cp deploy/palestra-backup.{service,timer} /etc/systemd/system/
#   sudo systemctl enable --now palestra-backup.timer
#
# Un backup che vive solo sullo stesso disco del database non e' un
# backup: sincronizza BACKUP_DIR altrove (rsync, rclone, un altro host).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/palestra}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/palestra-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump --no-owner --no-privileges palestra | gzip > "$FILE"
find "$BACKUP_DIR" -name 'palestra-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

echo "Backup salvato in $FILE"
