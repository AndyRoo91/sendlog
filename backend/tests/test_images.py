import io

import pytest
from PIL import Image

import images


def _jpeg_bytes(w: int, h: int, color=(120, 80, 200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "JPEG", quality=90)
    return buf.getvalue()


def _heic_bytes(w: int, h: int) -> bytes | None:
    """Encode a HEIC via pillow_heif if the encoder is available locally."""
    try:
        import pillow_heif
    except ImportError:
        return None
    if not getattr(pillow_heif, "register_heif_opener", None):
        return None
    buf = io.BytesIO()
    img = Image.new("RGB", (w, h), (200, 30, 30))
    try:
        img.save(buf, "HEIF")
    except Exception:
        return None
    return buf.getvalue()


def test_resize_writes_jpeg_and_thumb(tmp_path):
    raw = _jpeg_bytes(3000, 2000)
    name = images.process_upload(raw, photos_dir=tmp_path, prefix="t")
    assert name.endswith(".jpg")
    main = tmp_path / name
    thumb = tmp_path / images.thumb_name(name)
    assert main.exists() and thumb.exists()

    with Image.open(main) as im:
        assert max(im.size) == images.MAX_LONG_EDGE_PX
    with Image.open(thumb) as im:
        assert max(im.size) == images.THUMB_LONG_EDGE_PX


def test_small_image_not_upscaled(tmp_path):
    raw = _jpeg_bytes(400, 300)
    name = images.process_upload(raw, photos_dir=tmp_path, prefix="t")
    with Image.open(tmp_path / name) as im:
        assert im.size == (400, 300)


def test_rejects_oversized(tmp_path):
    raw = b"\x00" * (images.MAX_UPLOAD_BYTES + 1)
    with pytest.raises(images.ImageError):
        images.process_upload(raw, photos_dir=tmp_path, prefix="t")


def test_rejects_empty(tmp_path):
    with pytest.raises(images.ImageError):
        images.process_upload(b"", photos_dir=tmp_path, prefix="t")


def test_rejects_not_an_image(tmp_path):
    with pytest.raises(images.ImageError):
        images.process_upload(b"not an image at all", photos_dir=tmp_path, prefix="t")


def test_exif_orientation_applied(tmp_path):
    # Build a portrait image tagged with EXIF orientation 6 (rotate 90 CW on display).
    # After process_upload the saved file should be landscape: orientation baked in.
    portrait = Image.new("RGB", (200, 600), (10, 200, 10))
    buf = io.BytesIO()
    exif = portrait.getexif()
    exif[0x0112] = 6  # Orientation tag
    portrait.save(buf, "JPEG", exif=exif.tobytes())
    name = images.process_upload(buf.getvalue(), photos_dir=tmp_path, prefix="t")
    with Image.open(tmp_path / name) as im:
        assert im.width > im.height, "EXIF rotation should have been baked in"


def test_heic_converted_to_jpeg(tmp_path):
    raw = _heic_bytes(800, 600)
    if raw is None:
        pytest.skip("HEIC encoder not available in test env")
    name = images.process_upload(raw, photos_dir=tmp_path, prefix="t")
    assert name.endswith(".jpg")
    with Image.open(tmp_path / name) as im:
        assert im.format == "JPEG"


def test_delete_image_removes_thumb(tmp_path):
    raw = _jpeg_bytes(800, 600)
    name = images.process_upload(raw, photos_dir=tmp_path, prefix="t")
    images.delete_image(tmp_path, name)
    assert not (tmp_path / name).exists()
    assert not (tmp_path / images.thumb_name(name)).exists()


def test_upload_endpoint_persists_files(client, tmp_path, monkeypatch):
    # Need an entry to attach to
    s = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    e = client.post(f"/api/sessions/{s['id']}/lead",
                    json={"grade": "21", "grade_system": "ewbank", "send_type": "redpoint"}).json()
    raw = _jpeg_bytes(2400, 1800)
    r = client.post(
        f"/api/photos/upload?entry_type=lead&entry_id={e['id']}",
        files={"file": ("topo.jpg", raw, "image/jpeg")},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["filename"].endswith(".jpg")


def test_upload_endpoint_rejects_garbage(client):
    s = client.post("/api/sessions", json={"date": "2026-05-28"}).json()
    e = client.post(f"/api/sessions/{s['id']}/lead",
                    json={"grade": "21", "grade_system": "ewbank", "send_type": "redpoint"}).json()
    r = client.post(
        f"/api/photos/upload?entry_type=lead&entry_id={e['id']}",
        files={"file": ("not-an-image.jpg", b"definitely not an image", "image/jpeg")},
    )
    assert r.status_code == 400
