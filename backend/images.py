"""Image upload pipeline: HEIC→JPEG, EXIF auto-rotate, resize + thumbnail.

All uploads pass through ``process_upload`` so the on-disk files are always
JPEG, correctly oriented, capped at ``MAX_LONG_EDGE_PX``, and accompanied by a
matching ``*_thumb.jpg`` for list views.
"""
from __future__ import annotations

import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_LONG_EDGE_PX = 1600
THUMB_LONG_EDGE_PX = 400
JPEG_QUALITY = 88


class ImageError(ValueError):
    """Raised for invalid or oversized uploads."""


def thumb_name(filename: str) -> str:
    """Return the thumbnail filename next to ``filename``."""
    return f"{Path(filename).stem}_thumb.jpg"


def process_upload(
    raw: bytes,
    *,
    photos_dir: Path,
    prefix: str,
) -> str:
    """Validate, normalise, and persist an uploaded image.

    Returns the stored filename (always ``.jpg``). A matching ``*_thumb.jpg``
    is written alongside.
    """
    if len(raw) == 0:
        raise ImageError("Empty upload")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ImageError(f"Image exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit")

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:  # Pillow raises a tangle of types
        raise ImageError(f"Not a readable image: {exc}") from exc

    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    if max(img.size) > MAX_LONG_EDGE_PX:
        img.thumbnail((MAX_LONG_EDGE_PX, MAX_LONG_EDGE_PX), Image.Resampling.LANCZOS)

    filename = f"{prefix}_{uuid.uuid4().hex}.jpg"
    photos_dir.mkdir(parents=True, exist_ok=True)
    img.save(photos_dir / filename, "JPEG", quality=JPEG_QUALITY, progressive=True, optimize=True)

    thumb = img.copy()
    thumb.thumbnail((THUMB_LONG_EDGE_PX, THUMB_LONG_EDGE_PX), Image.Resampling.LANCZOS)
    thumb.save(photos_dir / thumb_name(filename), "JPEG", quality=82, progressive=True, optimize=True)

    return filename


def delete_image(photos_dir: Path, filename: str) -> None:
    """Remove an image and its thumbnail, ignoring missing files."""
    for name in (filename, thumb_name(filename)):
        p = photos_dir / name
        if p.exists():
            p.unlink()
