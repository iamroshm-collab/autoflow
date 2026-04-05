#!/usr/bin/env python3
"""
Face Recognition Service
========================
Called by the Next.js server (lib/face-recognition.ts) as a short-lived
child process.  Communication protocol:
  - stdin  : one JSON line with the input payload
  - stdout : one JSON line with the result
  - stderr : diagnostic logs (not parsed by the caller)

Required Python packages:
    pip install face_recognition Pillow requests numpy

Input JSON:
{
  "captured_image_path": "/abs/path/to/captured.jpg",
  "reference_image_path": "/abs/path/to/reference.jpg"   // may be a URL
  "threshold": 0.55
}

Output JSON:
{
  "matched": bool,
  "score": float | null,     // 1 - distance, higher is better
  "distance": float | null,  // Euclidean distance, lower is better
  "status": "verified" | "rejected" | "no_face_detected" | "error",
  "reason": str | null
}
"""

import sys
import json
import os
import tempfile
import traceback
from typing import Optional

try:
    import face_recognition
    import numpy as np
    from PIL import Image
except ImportError as e:
    sys.stdout.write(json.dumps({
        "matched": False,
        "score": None,
        "distance": None,
        "status": "error",
        "reason": (
            f"Missing dependency: {e}. "
            "Install with: pip install face_recognition Pillow numpy"
        ),
    }) + "\n")
    sys.stdout.flush()
    sys.exit(1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    """Write a diagnostic message to stderr (not parsed by the caller)."""
    sys.stderr.write(f"[face_recognition_service] {msg}\n")
    sys.stderr.flush()


def load_image_from_path_or_url(path_or_url: str) -> np.ndarray:
    """
    Load an image from a local path or an http(s) URL.
    Returns an RGB numpy array as expected by face_recognition.
    """
    if path_or_url.startswith(("http://", "https://")):
        import requests
        log(f"Downloading reference image from URL: {path_or_url}")
        resp = requests.get(path_or_url, timeout=15)
        resp.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name
        try:
            img = face_recognition.load_image_file(tmp_path)
        finally:
            os.unlink(tmp_path)
        return img

    log(f"Loading image from disk: {path_or_url}")
    return face_recognition.load_image_file(path_or_url)


def get_face_encoding(image: np.ndarray, label: str) -> Optional[np.ndarray]:
    """
    Extract the first face encoding from an image.
    Returns None if no face is detected.
    """
    # Use a slightly more accurate model for better garage lighting conditions
    # model="large" is slower but more accurate; use "small" if performance is an issue
    encodings = face_recognition.face_encodings(image, model="large")
    if not encodings:
        log(f"No face detected in {label} image.")
        return None
    if len(encodings) > 1:
        log(f"Multiple faces detected in {label} image — using the first one.")
    return encodings[0]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Read one JSON line from stdin
    raw = sys.stdin.readline()
    if not raw.strip():
        result = {
            "matched": False,
            "score": None,
            "distance": None,
            "status": "error",
            "reason": "No input received on stdin.",
        }
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()
        return

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stdout.write(json.dumps({
            "matched": False,
            "score": None,
            "distance": None,
            "status": "error",
            "reason": f"Invalid JSON input: {e}",
        }) + "\n")
        sys.stdout.flush()
        return

    captured_path: str = payload.get("captured_image_path", "")
    reference_path: str = payload.get("reference_image_path", "")
    threshold: float = float(payload.get("threshold", 0.55))

    if not captured_path or not reference_path:
        sys.stdout.write(json.dumps({
            "matched": False,
            "score": None,
            "distance": None,
            "status": "error",
            "reason": "Both captured_image_path and reference_image_path are required.",
        }) + "\n")
        sys.stdout.flush()
        return

    try:
        # Load images
        captured_image = load_image_from_path_or_url(captured_path)
        reference_image = load_image_from_path_or_url(reference_path)

        # Get face encodings
        captured_encoding = get_face_encoding(captured_image, "captured")
        if captured_encoding is None:
            sys.stdout.write(json.dumps({
                "matched": False,
                "score": None,
                "distance": None,
                "status": "no_face_detected",
                "reason": "No face detected in the camera capture.",
            }) + "\n")
            sys.stdout.flush()
            return

        reference_encoding = get_face_encoding(reference_image, "reference")
        if reference_encoding is None:
            sys.stdout.write(json.dumps({
                "matched": False,
                "score": None,
                "distance": None,
                "status": "error",
                "reason": "No face detected in the employee reference photo.",
            }) + "\n")
            sys.stdout.flush()
            return

        # Compare faces
        distance = float(face_recognition.face_distance([reference_encoding], captured_encoding)[0])
        matched = bool(distance <= threshold)
        score = round(max(0.0, 1.0 - distance), 4)

        log(
            f"distance={distance:.4f}  threshold={threshold}  "
            f"matched={matched}  score={score}"
        )

        status = "verified" if matched else "rejected"
        reason = None if matched else (
            f"Face distance {distance:.4f} exceeds threshold {threshold} — not a match."
        )

        sys.stdout.write(json.dumps({
            "matched": matched,
            "score": score,
            "distance": round(distance, 4),
            "status": status,
            "reason": reason,
        }) + "\n")
        sys.stdout.flush()

    except Exception:
        error_detail = traceback.format_exc()
        log(f"Unexpected error:\n{error_detail}")
        sys.stdout.write(json.dumps({
            "matched": False,
            "score": None,
            "distance": None,
            "status": "error",
            "reason": f"Face recognition failed: {error_detail.splitlines()[-1]}",
        }) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
