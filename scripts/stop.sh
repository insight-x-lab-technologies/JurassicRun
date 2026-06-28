#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE=".devserver.pid"
if [[ ! -f "$PID_FILE" ]]; then
  echo "Nenhum dev server registrado."
  exit 0
fi
PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Dev server (PID $PID) encerrado."
else
  echo "Dev server (PID $PID) já estava parado."
fi
rm -f "$PID_FILE"
