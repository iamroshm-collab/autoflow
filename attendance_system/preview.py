"""
preview.py
----------
Frame annotation for the live preview window.

Draws directly onto a copy of the BGR frame:
  • Detection zone boundary          — white dashed rectangle
  • Face bounding box                — green (accepted) / red (unknown) / yellow (validating)
  • Name + similarity score label    — colour-matched to the box
  • Status banner at the top         — one-line summary of the last result
  • Top-3 match table (debug mode)   — small text in the bottom-left corner

Usage
-----
    from attendance_system.preview import FrameAnnotator, PreviewConfig

    annotator = FrameAnnotator(PreviewConfig(show_top_matches=True))

    # In your display loop:
    annotated = annotator.annotate(frame, pipeline_result, pipeline_config.zone)
    cv2.imshow("Attendance", annotated)

Nothing here touches the camera or the pipeline — it only reads FaceResult
and DetectionZone and writes pixels onto a frame copy.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple

from .face_pipeline import FaceResult, DetectionZone

# BGR colour palette
_GREEN  = (34,  139, 34)    # accepted match
_RED    = (0,   0,   220)   # unknown / rejected
_YELLOW = (0,   210, 210)   # validating / no decision yet
_WHITE  = (255, 255, 255)
_BLACK  = (0,   0,   0)
_GREY   = (160, 160, 160)


@dataclass
class PreviewConfig:
    window_name: str = "Attendance Preview"
    show_top_matches: bool = False      # set True for threshold-tuning sessions
    font: int = cv2.FONT_HERSHEY_SIMPLEX
    font_scale: float = 0.6
    font_thickness: int = 1
    box_thickness: int = 2
    banner_height: int = 36             # px — top status bar
    label_padding: int = 6             # px — padding inside text labels


class FrameAnnotator:
    """
    Draws all recognition overlays onto a frame.  Stateless — safe to reuse
    across threads as long as callers do not share frame arrays.
    """

    def __init__(self, config: PreviewConfig = None) -> None:
        self._cfg = config or PreviewConfig()

    def annotate(
        self,
        frame: np.ndarray,
        result: Optional[FaceResult],
        zone: Optional[DetectionZone] = None,
    ) -> np.ndarray:
        """
        Return an annotated copy of `frame`.  The original is never modified.

        Parameters
        ----------
        frame   BGR numpy array from CameraStream.get_frame()
        result  Latest FaceResult from FacePipeline.process(), or None if
                no recognition has run yet.
        zone    DetectionZone from PipelineConfig — drawn as a guide box.
        """
        canvas = frame.copy()
        h, w = canvas.shape[:2]

        # ── 1. Detection zone guide ────────────────────────────────────────
        if zone is not None:
            self._draw_zone(canvas, zone, w, h)

        # ── 2. Face bounding box + score label ─────────────────────────────
        if result is not None and result.face_rect is not None:
            colour = self._result_colour(result)
            self._draw_face_box(canvas, result, colour)
            self._draw_score_label(canvas, result, colour)

        # ── 3. Status banner ───────────────────────────────────────────────
        self._draw_banner(canvas, result, w)

        # ── 4. Top-matches debug table ─────────────────────────────────────
        if self._cfg.show_top_matches and result is not None and result.top_matches:
            self._draw_top_matches(canvas, result, h)

        return canvas

    # ------------------------------------------------------------------
    # Drawing helpers
    # ------------------------------------------------------------------

    def _result_colour(self, result: FaceResult) -> Tuple[int, int, int]:
        """
        Green  → accepted match
        Red    → unknown person (face detected but similarity too low)
        Yellow → pipeline did not reach the comparison stage
        """
        if result.success:
            return _GREEN
        if result.is_unknown:
            return _RED
        return _YELLOW

    def _draw_zone(
        self,
        canvas: np.ndarray,
        zone: DetectionZone,
        w: int,
        h: int,
    ) -> None:
        """
        Draw a dashed guide rectangle representing the valid detection zone.
        A dashed line is approximated by drawing short segments.
        """
        x1 = int(zone.x_min * w)
        y1 = int(zone.y_min * h)
        x2 = int(zone.x_max * w)
        y2 = int(zone.y_max * h)
        self._dashed_rect(canvas, (x1, y1), (x2, y2), _WHITE, thickness=1, dash=12)

    def _dashed_rect(
        self,
        canvas: np.ndarray,
        pt1: Tuple[int, int],
        pt2: Tuple[int, int],
        colour: Tuple[int, int, int],
        thickness: int = 1,
        dash: int = 10,
    ) -> None:
        """Draw a rectangle made of dashes."""
        x1, y1 = pt1
        x2, y2 = pt2
        for edge in [
            ((x1, y1), (x2, y1)),  # top
            ((x2, y1), (x2, y2)),  # right
            ((x2, y2), (x1, y2)),  # bottom
            ((x1, y2), (x1, y1)),  # left
        ]:
            self._dashed_line(canvas, edge[0], edge[1], colour, thickness, dash)

    def _dashed_line(
        self,
        canvas: np.ndarray,
        p1: Tuple[int, int],
        p2: Tuple[int, int],
        colour: Tuple[int, int, int],
        thickness: int,
        dash: int,
    ) -> None:
        """Draw a dashed line from p1 to p2."""
        x1, y1 = p1
        x2, y2 = p2
        length = max(1, int(np.hypot(x2 - x1, y2 - y1)))
        dx, dy = (x2 - x1) / length, (y2 - y1) / length
        draw = True
        i = 0
        while i < length:
            end = min(i + dash, length)
            if draw:
                sx, sy = int(x1 + i * dx), int(y1 + i * dy)
                ex, ey = int(x1 + end * dx), int(y1 + end * dy)
                cv2.line(canvas, (sx, sy), (ex, ey), colour, thickness)
            draw = not draw
            i += dash

    def _draw_face_box(
        self,
        canvas: np.ndarray,
        result: FaceResult,
        colour: Tuple[int, int, int],
    ) -> None:
        """Draw a solid rectangle around the detected face."""
        x, y, bw, bh = result.face_rect
        cv2.rectangle(
            canvas,
            (x, y),
            (x + bw, y + bh),
            colour,
            self._cfg.box_thickness,
        )

    def _draw_score_label(
        self,
        canvas: np.ndarray,
        result: FaceResult,
        colour: Tuple[int, int, int],
    ) -> None:
        """
        Draw a filled label above (or below) the face bounding box containing:
          • Employee name  (or "UNKNOWN")
          • Similarity score as a percentage

        Label is placed above the face rect when there is room, otherwise below.
        """
        x, y, bw, bh = result.face_rect
        cfg = self._cfg

        if result.success and result.employee_id:
            name_part = result.employee_id
        elif result.is_unknown:
            name_part = "UNKNOWN"
        else:
            name_part = "—"

        sim_str = f"{result.similarity * 100:.1f}%" if result.similarity > 0 else ""
        label = f"{name_part}  {sim_str}".strip()

        (tw, th), baseline = cv2.getTextSize(
            label, cfg.font, cfg.font_scale, cfg.font_thickness
        )
        pad = cfg.label_padding
        label_h = th + baseline + 2 * pad

        # Place above the face box if there is room, else below.
        if y - label_h >= 0:
            bg_y1, bg_y2 = y - label_h, y
            text_y = y - pad - baseline
        else:
            bg_y1, bg_y2 = y + bh, y + bh + label_h
            text_y = y + bh + th + pad

        # Filled background rectangle for readability.
        cv2.rectangle(canvas, (x, bg_y1), (x + tw + 2 * pad, bg_y2), colour, -1)
        cv2.putText(
            canvas,
            label,
            (x + pad, text_y),
            cfg.font,
            cfg.font_scale,
            _WHITE,
            cfg.font_thickness,
            cv2.LINE_AA,
        )

    def _draw_banner(
        self,
        canvas: np.ndarray,
        result: Optional[FaceResult],
        frame_width: int,
    ) -> None:
        """
        Draw a semi-transparent status bar across the top of the frame.

        Content:
          Accepted  → "✓ John Smith — 92.3%"  (green)
          Unknown   → "✗ Unknown person — 61.2%"  (red)
          No face   → the pipeline message  (yellow)
          No result → "Waiting…"  (grey)
        """
        cfg = self._cfg
        bh = cfg.banner_height

        if result is None:
            text, bg = "Waiting for frame…", _GREY
        elif result.success:
            text = f"ACCEPTED: {result.employee_id}  ({result.similarity * 100:.1f}%)"
            bg = _GREEN
        elif result.is_unknown:
            text = f"UNKNOWN  ({result.similarity * 100:.1f}% — below threshold)"
            bg = _RED
        else:
            text = result.message or "Processing…"
            bg = _YELLOW

        # Semi-transparent overlay: blend a solid rectangle with the frame.
        overlay = canvas.copy()
        cv2.rectangle(overlay, (0, 0), (frame_width, bh), bg, -1)
        cv2.addWeighted(overlay, 0.6, canvas, 0.4, 0, canvas)

        cv2.putText(
            canvas,
            text,
            (10, bh - 10),
            cfg.font,
            cfg.font_scale,
            _WHITE,
            cfg.font_thickness,
            cv2.LINE_AA,
        )

    def _draw_top_matches(
        self,
        canvas: np.ndarray,
        result: FaceResult,
        frame_height: int,
    ) -> None:
        """
        Draw a small debug table in the bottom-left corner listing the
        top-N candidates and their similarity scores.

        Example:
          Top matches:
          #1  EMP002  91.3%
          #2  EMP005  74.1%
          #3  EMP001  62.8%
        """
        cfg = self._cfg
        small_scale = cfg.font_scale * 0.75
        line_h = 18
        matches = result.top_matches

        # Background panel
        lines = ["Top matches:"] + [
            f"#{i+1}  {m.employee_id}  {m.similarity * 100:.1f}%"
            for i, m in enumerate(matches)
        ]
        panel_h = (len(lines) + 1) * line_h
        panel_w = 200
        y_start = frame_height - panel_h - 10

        overlay = canvas.copy()
        cv2.rectangle(overlay, (0, y_start), (panel_w, frame_height - 5), _BLACK, -1)
        cv2.addWeighted(overlay, 0.55, canvas, 0.45, 0, canvas)

        for i, line in enumerate(lines):
            colour = _WHITE if i == 0 else (
                _GREEN if (i == 1 and result.success) else _GREY
            )
            cv2.putText(
                canvas,
                line,
                (8, y_start + (i + 1) * line_h),
                cfg.font,
                small_scale,
                colour,
                1,
                cv2.LINE_AA,
            )
