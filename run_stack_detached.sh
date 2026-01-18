#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_OUT="${ROOT_DIR}/wsl_stack.out.log"
LOG_ERR="${ROOT_DIR}/wsl_stack.err.log"

WSL_IP="${1:-127.0.0.1}"
API_HOST="${2:-$WSL_IP}"
if echo "$API_HOST" | grep -q ":"; then
  API_URL="http://${API_HOST}"
else
  API_URL="http://${API_HOST}:8000"
fi

touch "${LOG_OUT}" "${LOG_ERR}"
chmod +x "${ROOT_DIR}/run_stack.sh"

{
  echo "[INFO] Launching run_stack.sh"
  echo "[INFO] WSL_IP=${WSL_IP}"
  echo "[INFO] API_HOST=${API_HOST}"
} >> "${LOG_OUT}"

nohup env \
  AETHER_BACKEND_HOST=0.0.0.0 \
  AETHER_FRONTEND_HOST=0.0.0.0 \
  VITE_API_URL="${API_URL}" \
  "${ROOT_DIR}/run_stack.sh" >> "${LOG_OUT}" 2>> "${LOG_ERR}" < /dev/null &

STACK_PID=$!
echo "[INFO] run_stack PID=${STACK_PID}" >> "${LOG_OUT}"

sleep 2
{
  echo "[INFO] Diagnostics"
  pgrep -af uvicorn || true
  pgrep -af vite || true
  ss -lntp | grep -E ':(5173|8000)' || true
} >> "${LOG_OUT}"
