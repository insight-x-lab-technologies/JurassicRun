#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE=".devserver.pid"
PORT="${PORT:-8080}"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Aplicação já rodando (PID $(cat "$PID_FILE")) na porta $PORT."
  exit 0
fi
echo "Compilando (npm run build)..."
npm run build
echo "Subindo a aplicação na porta $PORT..."
npx vite preview --port "$PORT" --strictPort >/tmp/jurassicrun-dev.log 2>&1 &
echo $! > "$PID_FILE"
echo "Aplicação iniciada (PID $(cat "$PID_FILE")) em http://localhost:$PORT. Log: /tmp/jurassicrun-dev.log"
