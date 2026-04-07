"""
face_pipeline.py
----------------
All face-recognition stages, operating on a single frame:
  1. Lighting normalisation  ← NEW pre-stage
  2. Face detection
  3. Validation  (count, size, detection zone)
  4. Crop + alignment
  5. Embedding generation
  6. Confidence-filtered cache comparison
  7. Result

Lighting normalisation (why it matters)
----------------------------------------
Raw camera frames vary widely in brightness and local contrast depending on
the time of day, lamp placement, and camera auto-exposure lag.  These
variations shift pixel intensities in ways that directly affect Haar-cascade
detection and — more critically — the embedding vectors produced by deep-
learning models.  A face captured under fluorescent overhead lighting and the
same face captured near a sun-facing window can produce embeddings far enough
apart that they fall below the similarity threshold even for the same person.

CLAHE (Contrast Limited Adaptive Histogram Equalization)
---------------------------------------------------------
Global histogram equalization (`cv2.equalizeHist`) redistributes pixel
intensities so the overall histogram is flat.  This works on average but
over-amplifies noise in already-bright regions and can wash out face texture.

CLAHE divides the image into small non-overlapping tiles (e.g. 8 × 8) and
equalises each tile independently, then interpolates at tile boundaries to
avoid hard block edges.  The *clip limit* caps how aggressively any single
bin can be boosted, which suppresses noise amplification.  The result is
locally adaptive contrast enhancement that preserves fine facial texture
while correcting large-scale illumination gradients.

Applying CLAHE to the L channel of LAB colour space (instead of directly on
BGR or grayscale) keeps hue and saturation unchanged — colour-based models
see consistent skin tones even after enhancement.

Gamma correction
----------------
CLAHE alone cannot recover detail from severely underexposed frames.  Gamma
correction first stretches dark pixel values before CLAHE operates:

    pixel_out = 255 × (pixel_in / 255) ^ (1 / γ)

With γ > 1 the curve bends upward, brightening midtones and shadows without
clipping highlights.  The normaliser only applies gamma when the frame's mean
luminance falls below a configurable threshold, so daytime frames pay zero
extra cost.

Tuning guide
------------
• `clip_limit`         — raise to 3–4 for stronger local contrast in dim offices;
                         lower to 1–1.5 in bright, uniform environments.
• `tile_grid_size`     — smaller tiles (e.g. 4×4) adapt more locally but risk
                         amplifying sensor noise; 8×8 is a good default.
• `gamma_threshold`    — fraction of max brightness (0–1) below which gamma
                         kicks in; 0.35–0.45 works for typical indoor cameras.
• `gamma_value`        — 1.2 is subtle; 2.0 is aggressive.  Start at 1.5 and
                         compare /recognition/last similarity scores before/after.

Similarity metric
-----------------
All stored embeddings are L2-normalised at insert time.  At comparison time
the query is also normalised, so the dot product equals cosine similarity:

    cosine_similarity(a, b) = a · b        (both unit vectors)

Range is [-1, 1], but face embeddings from well-trained models cluster in
[0, 1].  A threshold of 0.75 means "at least 75 % directional overlap".
This is easier to reason about than a raw Euclidean distance.

Unknown-person handling
-----------------------
If the best cosine similarity across all known employees is below
`PipelineConfig.similarity_threshold`, the result is labelled "Unknown" and
attendance is NOT recorded.  The top-N candidates are still logged at DEBUG
level so operators can tune the threshold without blind guesswork.
"""

import cv2
import logging
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple, List, Dict

logger = logging.getLogger(__name__)


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class LightingConfig:
    """
    Parameters for the pre-detection lighting normalisation stage.

    All defaults are conservative and suitable for a typical indoor entrance
    camera.  See the module docstring for a full tuning guide.
    """

    # ── CLAHE ──────────────────────────────────────────────────────────────
    # clip_limit controls how strongly contrast is enhanced per tile.
    # Values 1–2 are gentle; 3–4 are aggressive.  Too high → noise rings.
    clip_limit: float = 2.0

    # tile_grid_size defines how many non-overlapping regions the image is
    # split into.  8×8 is a good balance between locality and noise immunity.
    # Decrease (e.g. 4×4) for finer local adaptation on high-res sensors.
    tile_grid_size: Tuple[int, int] = (8, 8)

    # ── Gamma correction ───────────────────────────────────────────────────
    # When enabled, gamma correction is applied *before* CLAHE if the frame
    # is below the brightness threshold.  Brightening first gives CLAHE more
    # texture to work with in the shadow regions.
    enable_gamma: bool = True

    # Fraction of max brightness (0–1).  If the frame's mean luminance is
    # below this value, gamma correction is applied.  0.40 catches most
    # underexposed entrance-camera scenarios without touching daylight frames.
    gamma_threshold: float = 0.40

    # γ exponent used in: out = 255 × (in / 255)^(1/γ).
    # Values > 1 brighten; 1.5 is a good starting point for dim entrances.
    gamma_value: float = 1.5


@dataclass
class DetectionZone:
    """Normalised (0–1) bounding box that defines the valid face region."""
    x_min: float = 0.1
    y_min: float = 0.1
    x_max: float = 0.9
    y_max: float = 0.9


@dataclass
class PipelineConfig:
    min_face_size: int = 60         # px — smaller faces are rejected
    max_faces: int = 1              # reject frame if more than this
    zone: DetectionZone = field(default_factory=DetectionZone)

    # ── Lighting normalisation ────────────────────────────────────────────
    # Applied before every detection pass (both the main pipeline and the
    # stability pre-gate).  Set lighting=LightingConfig(enable_gamma=False)
    # to disable gamma correction while keeping CLAHE.
    lighting: LightingConfig = field(default_factory=LightingConfig)

    # ── Confidence filtering ──────────────────────────────────────────────
    # Cosine similarity must be >= this value for a match to be accepted.
    # Tune upward (e.g. 0.85) for stricter matching in controlled lighting,
    # or downward (e.g. 0.65) if employees frequently wear glasses/hats.
    similarity_threshold: float = 0.75

    # How many runner-up candidates to log for threshold-tuning diagnostics.
    top_matches_count: int = 3

    cascade_path: str = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"


@dataclass
class MatchCandidate:
    """A single ranked candidate from the embedding cache."""
    employee_id: str
    similarity: float   # cosine similarity, higher = more similar


@dataclass
class FaceResult:
    success: bool
    employee_id: Optional[str] = None   # None when unknown or no face
    similarity: float = 0.0             # best cosine similarity score
    is_unknown: bool = False            # True when face found but score < threshold
    message: str = ""
    face_crop: Optional[np.ndarray] = None          # aligned 112×112 patch
    face_rect: Optional[Tuple[int, int, int, int]] = None  # (x, y, w, h) in frame
    top_matches: List[MatchCandidate] = field(default_factory=list)

    # Number of faces whose centre falls inside the detection zone.
    # Populated by FacePipeline.process() on every call — including failures —
    # so callers can check for tailgating without running a second detection pass.
    face_count: int = 0


# ── Lighting normaliser ────────────────────────────────────────────────────────

class LightingNormalizer:
    """
    Pre-detection lighting normalisation pipeline.

    Applies two sequential enhancements to a raw BGR camera frame:

      1. Gamma correction (optional, conditional on mean brightness)
         Stretches dark pixel values so CLAHE has more texture to work with
         in underexposed regions.  A pre-computed 256-entry LUT makes this
         O(pixels) with no floating-point per-pixel cost at runtime.

      2. CLAHE on the LAB L channel
         Converts to CIE LAB, applies CLAHE *only* to the luminance (L)
         channel, then converts back to BGR.  Keeping A and B channels
         unchanged means hue and saturation are preserved — deep-learning
         embedding models see consistent skin tones regardless of lighting.

    The cv2.CLAHE object is created once in __init__ and reused for every
    frame.  It is NOT thread-safe for concurrent apply() calls, but because
    FacePipeline is called sequentially within the verifier loop this is fine.
    If you later parallelise frame processing, create one LightingNormalizer
    per worker thread.

    Performance
    -----------
    On a 1280×720 BGR frame (2.7 M pixels):
      • LAB conversion:  ~1–2 ms  (SIMD-optimised in OpenCV)
      • CLAHE apply:     ~2–5 ms  depending on tile count and clip limit
      • Gamma LUT:       ~0.5 ms  (table lookup, branch-free)
    Total overhead: ~3–8 ms per frame — well within a 66 ms frame budget
    at 15 fps.  Disable gamma (`enable_gamma=False`) to save ~0.5 ms if the
    camera environment is always well-lit.
    """

    def __init__(self, config: LightingConfig) -> None:
        self._cfg = config

        # Create the CLAHE object once; reuse across all frames.
        # clip_limit and tileGridSize are the two primary tuning knobs.
        self._clahe = cv2.createCLAHE(
            clipLimit=config.clip_limit,
            tileGridSize=config.tile_grid_size,
        )

        # Pre-compute a 256-entry gamma lookup table (uint8 → uint8).
        # Using a LUT avoids per-pixel power calls at runtime.
        # Formula: out = 255 × (in / 255) ^ (1 / γ)
        #   γ > 1  →  curve bends upward  →  shadows brighten
        #   γ = 1  →  identity (no change)
        #   γ < 1  →  curve bends downward (darkening, rarely useful here)
        self._gamma_lut: Optional[np.ndarray] = None
        if config.enable_gamma:
            self._gamma_lut = self._build_gamma_lut(config.gamma_value)

    @staticmethod
    def _build_gamma_lut(gamma: float) -> np.ndarray:
        """Build a uint8 → uint8 LUT for gamma correction with exponent 1/γ."""
        inv_gamma = 1.0 / gamma
        indices = np.arange(256, dtype=np.float32) / 255.0
        corrected = np.power(indices, inv_gamma) * 255.0
        return np.clip(corrected, 0, 255).astype(np.uint8)

    def normalize(self, frame: np.ndarray) -> np.ndarray:
        """
        Return a lighting-normalised copy of `frame` (BGR, uint8).

        The original frame is never modified; all operations produce new arrays.

        Steps
        -----
        1. If gamma is enabled and mean luminance < gamma_threshold:
               apply gamma LUT to all three BGR channels simultaneously.
        2. Convert enhanced frame to LAB.
        3. Apply CLAHE to the L (luminance) channel.
        4. Merge L back with unchanged A, B channels.
        5. Convert LAB → BGR and return.
        """
        enhanced = frame

        # ── Step 1: Conditional gamma correction ──────────────────────────
        # Only pay the cost when the frame is genuinely dark.  We measure
        # mean luminance on a grayscale thumbnail to avoid a full-res
        # conversion that we would immediately discard.
        if self._cfg.enable_gamma and self._gamma_lut is not None:
            # Use a small thumbnail for the brightness check — ~10× faster
            # than converting the full frame, and the mean is the same.
            thumb = cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA)
            mean_luminance = cv2.cvtColor(thumb, cv2.COLOR_BGR2GRAY).mean() / 255.0

            if mean_luminance < self._cfg.gamma_threshold:
                # cv2.LUT applies the table to every channel element-wise.
                # This is a single memory-bandwidth-bound pass — ~0.5 ms.
                enhanced = cv2.LUT(frame, self._gamma_lut)
                logger.debug(
                    "Gamma correction applied (mean_lum=%.3f < threshold=%.3f, γ=%.2f).",
                    mean_luminance,
                    self._cfg.gamma_threshold,
                    self._cfg.gamma_value,
                )

        # ── Step 2–5: CLAHE on LAB L channel ─────────────────────────────
        # LAB separates luminance from colour so CLAHE only touches brightness,
        # leaving skin-tone hues intact for colour-aware embedding models.
        lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # CLAHE: locally equalise contrast tile-by-tile, then interpolate.
        # clip_limit prevents runaway amplification of flat (noisy) regions.
        l_enhanced = self._clahe.apply(l_channel)

        # Merge enhanced luminance with the original colour channels.
        lab_enhanced = cv2.merge([l_enhanced, a_channel, b_channel])
        return cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)


# ── Embedding cache ────────────────────────────────────────────────────────────

class EmbeddingCache:
    """
    Thread-safe* in-memory store: employee_id → unit-normalised embedding.

    (*) Reads are safe from multiple threads; `add` should only be called
    during initialisation or under an external lock.

    Similarity is computed as cosine similarity via the dot product of two
    unit vectors — O(D) per comparison where D is the embedding dimension.
    With 500 employees and 128-D embeddings this is ~64 k FLOPs, well under
    1 ms on any modern CPU, so a vectorised numpy scan is fast enough.
    """

    def __init__(self) -> None:
        # Stored as a single matrix for fast batch dot-product in find_top_matches.
        self._ids: List[str] = []
        self._matrix: Optional[np.ndarray] = None   # shape (N, D), float32

    def add(self, employee_id: str, embedding: np.ndarray) -> None:
        """Insert or replace the embedding for employee_id."""
        norm = np.linalg.norm(embedding)
        if norm == 0:
            raise ValueError(f"Zero-norm embedding for {employee_id}.")
        unit_vec = (embedding / norm).astype(np.float32)

        if employee_id in self._ids:
            idx = self._ids.index(employee_id)
            self._matrix[idx] = unit_vec
        else:
            self._ids.append(employee_id)
            row = unit_vec.reshape(1, -1)
            self._matrix = row if self._matrix is None else np.vstack([self._matrix, row])

    def find_top_matches(
        self, query: np.ndarray, top_n: int
    ) -> List[MatchCandidate]:
        """
        Return the top_n employees sorted by cosine similarity (descending).

        Implementation note
        -------------------
        Both the stored matrix and the query are unit-normalised, so:

            similarities = matrix @ query_unit    (shape: N,)

        is a single BLAS call — O(N·D) with no Python loop.  On a 500-employee
        cache with 512-D embeddings this takes ~0.1 ms on a laptop CPU.
        """
        if self._matrix is None or len(self._ids) == 0:
            return []

        # Normalise query to unit length.
        norm = np.linalg.norm(query)
        if norm == 0:
            return []
        query_unit = (query / norm).astype(np.float32)

        # Batch cosine similarity: one matrix-vector multiply.
        similarities = self._matrix @ query_unit   # shape: (N,)

        # Partial sort: only pull the indices we actually need.
        k = min(top_n, len(self._ids))
        # argpartition gives the k largest in arbitrary order; then sort those k.
        top_indices = np.argpartition(similarities, -k)[-k:]
        top_indices = top_indices[np.argsort(similarities[top_indices])[::-1]]

        return [
            MatchCandidate(
                employee_id=self._ids[i],
                similarity=float(similarities[i]),
            )
            for i in top_indices
        ]

    def list_ids(self) -> List[str]:
        """
        Return a snapshot of all enrolled employee IDs.

        Returns a copy of the internal list so callers cannot accidentally
        mutate the cache's state.  Used by AbsenceScheduler to iterate over
        active employees without holding any lock.

        Thread safety: _ids is only appended to (never removed from) during
        normal operation, so a list copy is a safe O(N) read.
        """
        return list(self._ids)

    def __len__(self) -> int:
        return len(self._ids)


# ── Main pipeline ──────────────────────────────────────────────────────────────

class FacePipeline:
    """
    Stateless per-frame processing pipeline.
    Thread-safe: all mutable state lives in EmbeddingCache (read-only here).
    """

    def __init__(self, config: PipelineConfig, cache: EmbeddingCache) -> None:
        self._cfg = config
        self._cache = cache
        self._detector = cv2.CascadeClassifier(config.cascade_path)
        if self._detector.empty():
            raise RuntimeError(f"Could not load cascade from {config.cascade_path}")

        # Lighting normaliser — applied before every detection pass.
        # Creating it here (not per-frame) avoids reallocating the CLAHE
        # object and recomputing the gamma LUT on every call.
        self._normalizer = LightingNormalizer(config.lighting)

        logger.info(
            "FacePipeline ready. similarity_threshold=%.2f, cache_size=%d, "
            "clahe_clip=%.1f, clahe_grid=%s, gamma_enabled=%s",
            config.similarity_threshold,
            len(cache),
            config.lighting.clip_limit,
            config.lighting.tile_grid_size,
            config.lighting.enable_gamma,
        )

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    def detect_single_face_in_zone(
        self, frame: np.ndarray
    ) -> Optional[Tuple[int, int, int, int]]:
        """
        Lightweight face detection without embedding or comparison.

        Returns the bounding rect (x, y, w, h) of the single face whose
        centre is inside the detection zone, or None if:
          • no faces were detected
          • more than one face is inside the zone (tailgating)
          • the only detected face is outside the zone

        Used by StabilityDetector to track face position across frames
        without paying the cost of embedding generation (~20–80 ms saved
        per observation frame during the stability pre-gate window).

        Cost: lighting normalisation (~3–8 ms) + one Haar cascade pass
        (~5–15 ms) + O(F) zone filter.
        """
        frame = self._normalizer.normalize(frame)
        faces = self._detect(frame)
        zone_count = self._count_zone_faces(frame, faces)

        # We need exactly one face in the zone for a valid stability reading.
        if zone_count != 1:
            return None

        # Return the rect of the first face whose centre is inside the zone.
        h_frame, w_frame = frame.shape[:2]
        z = self._cfg.zone
        for (x, y, w, h) in faces:
            cx, cy = x + w / 2, y + h / 2
            if (
                z.x_min * w_frame <= cx <= z.x_max * w_frame
                and z.y_min * h_frame <= cy <= z.y_max * h_frame
            ):
                return (int(x), int(y), int(w), int(h))

        return None  # should not be reached given zone_count == 1

    def process(self, frame: np.ndarray) -> FaceResult:
        """
        Run all pipeline stages on a single BGR frame.

        Stage summary
        -------------
        detect → count zone faces → validate → crop+align → embed → rank+filter

        Returns FaceResult with:
          success=True, employee_id set      — accepted match
          success=False, is_unknown=True     — face found, score < threshold
          success=False, is_unknown=False    — no usable face in frame

        face_count is ALWAYS populated regardless of which stage fails, so
        callers (e.g. MultiFrameVerifier) can detect tailgating from any
        FaceResult without running a separate detection call.
        """
        # ── Stage 0: Lighting normalisation ───────────────────────────────
        # Preprocess once and use the enhanced frame for *all* downstream
        # stages: detection (grayscale derived from it), crop extraction, and
        # ultimately embedding generation.  This ensures the model sees the
        # same brightness/contrast distribution it was trained on.
        frame = self._normalizer.normalize(frame)

        # ── Stage 1: Detect ────────────────────────────────────────────────
        faces = self._detect(frame)
        logger.debug("Detected %d face(s).", len(faces))

        # ── Count faces inside the detection zone ──────────────────────────
        # Done immediately after detection so the count is available on every
        # early-return path below. O(faces) — negligible cost.
        face_count = self._count_zone_faces(frame, faces)

        # ── Stage 2: Validate ──────────────────────────────────────────────
        ok, msg = self._validate(frame, faces)
        if not ok:
            return FaceResult(success=False, message=msg, face_count=face_count)

        # ── Stage 3: Crop + align ─────────────────────────────────────────
        face_rect = tuple(int(v) for v in faces[0])   # (x, y, w, h)
        x, y, w, h = face_rect
        crop = self._crop_align(frame, x, y, w, h)

        # ── Stage 4: Embed ────────────────────────────────────────────────
        embedding = self._embed(crop)

        # ── Stage 5: Confidence-filtered comparison ────────────────────────
        result = self._compare(embedding, crop, face_rect)
        result.face_count = face_count   # inject count into the compare result
        return result

    # ------------------------------------------------------------------
    # Stage implementations
    # ------------------------------------------------------------------

    def _detect(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        # frame has already been CLAHE-normalised by LightingNormalizer.normalize().
        # Converting to grayscale here is sufficient — global equalizeHist is
        # intentionally omitted because CLAHE on the LAB L channel is a strictly
        # better normalisation: it adapts locally and preserves colour information
        # for any downstream colour-aware model.  Reapplying equalizeHist on top
        # of CLAHE output can actually degrade detection by over-flattening the
        # histogram that CLAHE already balanced.
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return list(
            self._detector.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(self._cfg.min_face_size, self._cfg.min_face_size),
            )
        )

    def _count_zone_faces(
        self,
        frame: np.ndarray,
        faces: List[Tuple[int, int, int, int]],
    ) -> int:
        """
        Count how many detected faces have their centre inside the detection zone.

        Uses the same zone geometry as _validate() so the two are always
        consistent.  Called on every frame so the verifier can detect tailgating
        from `FaceResult.face_count` without a separate detection pass.

        A face is "in zone" when its bounding-box centre (cx, cy) satisfies:
            zone.x_min * W  <=  cx  <=  zone.x_max * W
            zone.y_min * H  <=  cy  <=  zone.y_max * H
        """
        if not faces:
            return 0
        h_frame, w_frame = frame.shape[:2]
        z = self._cfg.zone
        count = 0
        for (x, y, w, h) in faces:
            cx, cy = x + w / 2, y + h / 2
            if (
                z.x_min * w_frame <= cx <= z.x_max * w_frame
                and z.y_min * h_frame <= cy <= z.y_max * h_frame
            ):
                count += 1
        return count

    def _validate(
        self, frame: np.ndarray, faces: List[Tuple[int, int, int, int]]
    ) -> Tuple[bool, str]:
        if len(faces) == 0:
            return False, "No face detected."

        if len(faces) > self._cfg.max_faces:
            return False, f"Multiple faces detected ({len(faces)}); please stand alone."

        h_frame, w_frame = frame.shape[:2]
        z = self._cfg.zone
        x, y, w, h = faces[0]
        cx, cy = x + w / 2, y + h / 2

        if not (
            z.x_min * w_frame <= cx <= z.x_max * w_frame
            and z.y_min * h_frame <= cy <= z.y_max * h_frame
        ):
            return False, "Face is outside the detection zone."

        if w < self._cfg.min_face_size or h < self._cfg.min_face_size:
            return False, f"Face too small ({w}×{h}px); move closer."

        return True, ""

    def _crop_align(
        self, frame: np.ndarray, x: int, y: int, w: int, h: int
    ) -> np.ndarray:
        """
        Crop the face region and resize to a standard 112×112 patch.
        Replace with landmark-based affine alignment for production accuracy.
        """
        crop = frame[y : y + h, x : x + w]
        return cv2.resize(crop, (112, 112))

    def _embed(self, face_img: np.ndarray) -> np.ndarray:
        """
        STUB — replace with your actual model inference.
        (InsightFace, FaceNet, ArcFace, DeepFace, …)

        Must return a 1-D float32 numpy array of fixed length.
        The vector does NOT need to be pre-normalised; EmbeddingCache.add()
        and find_top_matches() both normalise internally.
        """
        # ── Replace from here ─────────────────────────────────────────────
        resized = cv2.resize(face_img, (64, 64)).astype(np.float32) / 255.0
        embedding = resized.flatten()[:128]
        # ── to here with your model's forward pass ────────────────────────
        return embedding

    def _compare(
        self,
        embedding: np.ndarray,
        crop: np.ndarray,
        face_rect: Tuple[int, int, int, int],
    ) -> FaceResult:
        """
        Rank all cached embeddings by cosine similarity, apply the threshold,
        and return a structured result.

        Decision logic
        --------------
        best_similarity >= similarity_threshold  →  accepted (success=True)
        best_similarity <  similarity_threshold  →  unknown  (success=False,
                                                               is_unknown=True)
        cache is empty                           →  no employees enrolled yet

        Logging strategy
        ----------------
        • INFO  — final decision (accepted employee or unknown rejection)
        • DEBUG — full top-N ranked list for threshold-tuning
        """
        top_matches = self._cache.find_top_matches(
            embedding, top_n=self._cfg.top_matches_count
        )

        if not top_matches:
            logger.warning("Embedding cache is empty — no employees enrolled.")
            return FaceResult(
                success=False,
                message="No employees enrolled in the system.",
                face_crop=crop,
                face_rect=face_rect,
            )

        # ── Log top-N candidates at DEBUG level (for threshold tuning) ─────
        if logger.isEnabledFor(logging.DEBUG):
            lines = [
                f"  #{rank+1}  {m.employee_id}  sim={m.similarity:.4f}"
                for rank, m in enumerate(top_matches)
            ]
            logger.debug("Top-%d matches:\n%s", len(top_matches), "\n".join(lines))

        best = top_matches[0]
        threshold = self._cfg.similarity_threshold

        # ── Threshold gate ─────────────────────────────────────────────────
        if best.similarity < threshold:
            # Person is in frame but does not match any known employee well
            # enough to be trusted.  Do NOT record attendance.
            logger.info(
                "UNKNOWN person — best match: %s sim=%.4f (threshold=%.2f) REJECTED",
                best.employee_id,
                best.similarity,
                threshold,
            )
            return FaceResult(
                success=False,
                is_unknown=True,
                similarity=best.similarity,
                message=(
                    f"Unknown person. Best candidate '{best.employee_id}' "
                    f"scored {best.similarity:.2f} (need ≥ {threshold:.2f})."
                ),
                face_crop=crop,
                face_rect=face_rect,
                top_matches=top_matches,
            )

        # ── Accepted ───────────────────────────────────────────────────────
        logger.info(
            "ACCEPTED  employee=%s  sim=%.4f  (threshold=%.2f)",
            best.employee_id,
            best.similarity,
            threshold,
        )
        return FaceResult(
            success=True,
            employee_id=best.employee_id,
            similarity=best.similarity,
            message="",
            face_crop=crop,
            face_rect=face_rect,
            top_matches=top_matches,
        )
