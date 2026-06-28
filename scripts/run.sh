#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE=".devserver.pid"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Dev server já rodando (PID $(cat "$PID_FILE"))."
  exit 0
fi
npm run dev >/tmp/jurassicrun-dev.log 2>&1 &
echo $! > "$PID_FILE"
echo "Dev server iniciado (PID $(cat "$PID_FILE")). Log: /tmp/jurassicrun-dev.log"
