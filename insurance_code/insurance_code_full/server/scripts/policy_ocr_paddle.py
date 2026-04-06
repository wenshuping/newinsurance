#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "BOS")


def fail(message: str, code: int = 1) -> None:
    sys.stderr.write(f"{message}\n")
    raise SystemExit(code)


def load_image_path() -> str:
    if len(sys.argv) < 2:
        fail("POLICY_OCR_INPUT_REQUIRED")
    image_path = Path(sys.argv[1]).expanduser().resolve()
    if not image_path.exists():
        fail("POLICY_OCR_INPUT_NOT_FOUND")
    return str(image_path)


def is_warmup_mode() -> bool:
    return "--warmup" in sys.argv[1:]


def bootstrap_project_dir() -> None:
    project_dir = os.environ.get("POLICY_OCR_PADDLE_PROJECT_DIR", "").strip()
    if project_dir and project_dir not in sys.path:
        sys.path.insert(0, project_dir)


def collect_lines(result) -> list[str]:
    lines: list[str] = []
    for item in result or []:
        payload = getattr(item, "res", item)
        if not isinstance(payload, dict):
            continue
        texts = payload.get("rec_texts") or []
        if isinstance(texts, list):
            lines.extend(str(text).strip() for text in texts if str(text).strip())
    return lines


def env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


def main() -> None:
    bootstrap_project_dir()

    try:
        from paddleocr import PaddleOCR
    except Exception:
        fail("POLICY_OCR_PADDLE_IMPORT_FAILED")

    try:
        ocr = PaddleOCR(
            lang=os.environ.get("POLICY_OCR_PADDLE_LANG", "ch"),
            device=os.environ.get("POLICY_OCR_PADDLE_DEVICE", "cpu"),
            text_detection_model_name=os.environ.get("POLICY_OCR_PADDLE_DET_MODEL_NAME", "PP-OCRv5_mobile_det"),
            text_recognition_model_name=os.environ.get("POLICY_OCR_PADDLE_REC_MODEL_NAME", "PP-OCRv5_mobile_rec"),
            use_doc_orientation_classify=env_flag("POLICY_OCR_PADDLE_USE_DOC_ORIENTATION_CLASSIFY", True),
            use_doc_unwarping=env_flag("POLICY_OCR_PADDLE_USE_DOC_UNWARPING", True),
            use_textline_orientation=env_flag("POLICY_OCR_PADDLE_USE_TEXTLINE_ORIENTATION", True),
        )
    except Exception:
        fail("POLICY_OCR_FAILED")

    if is_warmup_mode():
        sys.stdout.write(json.dumps({"ok": True, "warmup": True}, ensure_ascii=False))
        return

    image_path = load_image_path()

    try:
        result = ocr.predict(image_path)
        lines = collect_lines(result)
    except Exception:
        fail("POLICY_OCR_FAILED")

    if not lines:
        fail("POLICY_OCR_EMPTY")

    output = {
        "ok": True,
        "lines": lines,
        "ocrText": "\n".join(lines),
    }
    sys.stdout.write(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
