#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PID_FILE=".devserver.pid"
PORT="${PORT:-8080}"

stopped=0
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    # mata o processo e seus filhos (vite preview roda sob o npx)
    pkill -P "$PID" 2>/dev/null || true
    kill "$PID" 2>/dev/null || true
    echo "Aplicação (PID $PID) encerrada."
    stopped=1
  else
    echo "Aplicação (PID $PID) já estava parada."
  fi
  rm -f "$PID_FILE"
fi

# Garante que nada continue ocupando a porta 8080.
if command -v fuser >/dev/null 2>&1; then
  if fuser -k "${PORT}/tcp" 2>/dev/null; then
    echo "Processos remanescentes na porta $PORT encerrados."
    stopped=1
  fi
fi

if [[ "$stopped" -eq 0 ]]; then
  echo "Nenhuma aplicação rodando."
fi
