#!/usr/bin/env bash
set -euo pipefail

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but not found." >&2
  exit 1
fi

PADDLE_OCR_DIR="${1:-${PADDLE_OCR_DIR:-}}"
if [[ -z "${PADDLE_OCR_DIR}" ]]; then
  echo "Usage: $0 /absolute/path/to/PaddleOCR-main" >&2
  exit 1
fi

if [[ ! -d "${PADDLE_OCR_DIR}" ]]; then
  echo "PaddleOCR directory not found: ${PADDLE_OCR_DIR}" >&2
  exit 1
fi

VENV_DIR="${PADDLE_OCR_DIR}/.venv-paddleocr"

echo "[setup-paddleocr-local] creating venv at ${VENV_DIR}"
if [[ -x "${VENV_DIR}/bin/python" ]]; then
  echo "[setup-paddleocr-local] reusing existing venv"
else
  uv venv --python 3.12 "${VENV_DIR}"
fi

echo "[setup-paddleocr-local] installing PaddleOCR editable package"
SETUPTOOLS_SCM_PRETEND_VERSION_FOR_PADDLEOCR="${SETUPTOOLS_SCM_PRETEND_VERSION_FOR_PADDLEOCR:-3.2.0}" \
  uv pip install --python "${VENV_DIR}/bin/python" -e "${PADDLE_OCR_DIR}"

cat <<EOF
[setup-paddleocr-local] done
Set these env vars before starting the stack:
  POLICY_OCR_PROVIDER=paddle_local
  POLICY_OCR_PADDLE_PROJECT_DIR=${PADDLE_OCR_DIR}
  POLICY_OCR_PADDLE_PYTHON=${VENV_DIR}/bin/python
EOF
