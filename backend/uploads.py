"""Bounded photo sanitization before forwarding to the hosted storage worker.

The worker retains ownership checks and privileged storage access. This module
accepts only static JPEG, PNG and WebP photos and removes their metadata.
"""

import warnings
from hashlib import sha256
from io import BytesIO
from uuid import UUID

import httpx
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from python_multipart.exceptions import MultipartParseError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException
from starlette.requests import Request

MAX_BODY = 6 * 1024 * 1024
MAX_IMAGE = 5 * 1024 * 1024
MAX_PIXELS = 12_000_000
PHOTO_ERROR = "Choose a valid JPEG, PNG or WebP photo."
TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


def clean_image(data: bytes, mime: str) -> bytes:
    """Decode a bounded static photo, normalize it, and emit metadata-free JPEG."""
    if len(data) > MAX_IMAGE:
        raise HTTPException(413, "Photos must be 5 MB or smaller.")
    if mime not in TYPES.values():
        raise HTTPException(400, PHOTO_ERROR)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as probe:
                if TYPES.get(probe.format) != mime:
                    raise HTTPException(400, PHOTO_ERROR)
                if probe.width * probe.height > MAX_PIXELS:
                    raise HTTPException(
                        400, "Photos must contain 12 million pixels or fewer."
                    )
                if getattr(probe, "n_frames", 1) != 1:
                    raise HTTPException(
                        400, "Choose a still photo; animated images are not supported."
                    )
                probe.verify()
            # Verification checks the container; loading again also rejects truncated pixels.
            with Image.open(BytesIO(data)) as decoded:
                decoded.load()
                image = ImageOps.exif_transpose(decoded)
                if image.width > 4096 or image.height > 4096:
                    image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                # A fresh canvas strips EXIF, XMP, ICC, comments and other source metadata.
                canvas = Image.new("RGB", image.size, "white")
                if "A" in image.getbands() or "transparency" in image.info:
                    rgba = image.convert("RGBA")
                    canvas.paste(rgba, mask=rgba.getchannel("A"))
                else:
                    canvas.paste(image.convert("RGB"))
                output = BytesIO()
                canvas.save(output, format="JPEG", quality=85)
                result = output.getvalue()
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise HTTPException(400, PHOTO_ERROR) from error
    if len(result) > MAX_IMAGE:
        raise HTTPException(
            413, "The processed photo is too large. Choose a smaller photo."
        )
    return result


def _identifier(value: object) -> str:
    if not isinstance(value, str):
        raise HTTPException(400, "Invalid upload identifiers.")
    try:
        return str(UUID(value))
    except (ValueError, AttributeError) as error:
        raise HTTPException(400, "Invalid upload identifiers.") from error


def _multipart(fields: dict[str, str], image: bytes | None) -> tuple[bytes, str]:
    # Derive a stable boundary from the outgoing data, never from credentials.
    digest = sha256(repr(sorted(fields.items())).encode() + (image or b"")).hexdigest()
    boundary = "subletsafe-" + digest
    while image and boundary.encode() in image:
        boundary += "x"
    parts = [(name, (None, value)) for name, value in fields.items()]
    if image is not None:
        parts.append(("file", ("photo.jpg", image, "image/jpeg")))
    content_type = "multipart/form-data; boundary=" + boundary
    request = httpx.Request(
        "POST",
        "https://storage.invalid",
        files=parts,
        headers={"content-type": content_type},
    )
    return request.read(), content_type


async def prepare_upload(body: bytes, content_type: str) -> tuple[bytes, str]:
    """Validate a multipart request and return a sanitized worker request body."""
    if len(body) > MAX_BODY:
        raise HTTPException(413, "Photo too large.")
    if content_type.split(";", 1)[0].strip().lower() != "multipart/form-data":
        raise HTTPException(400, "Choose a photo using a multipart upload.")

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request = Request(
        {
            "type": "http",
            "headers": [(b"content-type", content_type.encode("latin-1"))],
        },
        receive,
    )
    try:
        async with request.form(max_files=1, max_fields=3, max_part_size=1024) as form:
            values: dict[str, object] = {}
            for name, value in form.multi_items():
                if (
                    name not in {"listing_id", "request_id", "action", "file"}
                    or name in values
                ):
                    raise HTTPException(400, "Invalid or repeated upload fields.")
                values[name] = value
            fields = {
                "listing_id": _identifier(values.get("listing_id")),
                "request_id": _identifier(values.get("request_id")),
            }
            action = values.get("action", "upload")
            if action not in ("upload", "delete"):
                raise HTTPException(400, "Invalid photo action.")
            fields["action"] = action
            file = values.get("file")
            if action == "delete":
                if file is not None:
                    raise HTTPException(400, "Delete requests cannot contain a photo.")
                return _multipart(fields, None)
            if not isinstance(file, UploadFile):
                raise HTTPException(400, "Choose a photo.")
            data = await file.read(MAX_IMAGE + 1)
            cleaned = await run_in_threadpool(
                clean_image, data, file.content_type or ""
            )
            return _multipart(fields, cleaned)
    except (MultiPartException, MultipartParseError, UnicodeError, ValueError) as error:
        raise HTTPException(400, "Invalid photo upload form.") from error
