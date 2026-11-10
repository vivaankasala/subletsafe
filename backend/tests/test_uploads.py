import asyncio
from io import BytesIO
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from PIL import Image
from starlette.requests import Request

from backend.uploads import clean_image, prepare_upload

LISTING = str(uuid4())
REQUEST = str(uuid4())


def photo(fmt="PNG", size=(16, 10), mode="RGB", **save):
    output = BytesIO()
    Image.new(mode, size, "white").save(output, format=fmt, **save)
    return output.getvalue()


def multipart(fields=None, files=None):
    parts = [
        (name, (None, value))
        for name, value in (
            fields or [("listing_id", LISTING), ("request_id", REQUEST)]
        )
    ]
    parts.extend(files or [])
    request = httpx.Request("POST", "https://example.test", files=parts)
    return request.read(), request.headers["content-type"]


def prepare(fields=None, files=None):
    return asyncio.run(prepare_upload(*multipart(fields, files)))


def decode_form(body, content_type):
    async def run():
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(
            {"type": "http", "headers": [(b"content-type", content_type.encode())]},
            receive,
        )
        async with request.form() as form:
            values = {
                key: value for key, value in form.items() if isinstance(value, str)
            }
            image = form.get("file")
            return (
                values,
                await image.read() if image else None,
                image.content_type if image else None,
            )

    return asyncio.run(run())


def test_metadata_and_orientation_are_removed():
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = "private caption"
    output = clean_image(photo("JPEG", exif=exif), "image/jpeg")
    with Image.open(BytesIO(output)) as result:
        assert result.format == "JPEG"
        assert result.size == (10, 16)
        assert not result.getexif()
        assert "icc_profile" not in result.info


@pytest.mark.parametrize(
    "data,mime",
    [
        (photo(), "image/jpeg"),
        (b"bad image", "image/png"),
        (photo("JPEG")[:-20], "image/jpeg"),
    ],
)
def test_rejects_wrong_type_and_corruption(data, mime):
    with pytest.raises(HTTPException) as error:
        clean_image(data, mime)
    assert error.value.status_code == 400


def test_rejects_large_input():
    with pytest.raises(HTTPException) as error:
        clean_image(b"x" * (5 * 1024 * 1024 + 1), "image/jpeg")
    assert error.value.status_code == 413


def test_rejects_pixel_limit():
    with pytest.raises(HTTPException) as error:
        clean_image(photo(size=(4000, 3001)), "image/png")
    assert error.value.status_code == 400


def test_resizes_tall_photo_preserving_aspect():
    with Image.open(
        BytesIO(clean_image(photo(size=(1000, 5000)), "image/png"))
    ) as result:
        assert result.size == (410, 2048)


def test_flattens_transparency_to_white():
    source = BytesIO()
    Image.new("RGBA", (2, 2), (255, 0, 0, 0)).save(source, format="PNG")
    with Image.open(BytesIO(clean_image(source.getvalue(), "image/png"))) as result:
        assert result.getpixel((0, 0)) == (255, 255, 255)


def test_rejects_animated_image():
    source = BytesIO()
    Image.new("RGB", (2, 2), "red").save(
        source,
        format="PNG",
        save_all=True,
        append_images=[Image.new("RGB", (2, 2), "blue")],
    )
    with pytest.raises(HTTPException):
        clean_image(source.getvalue(), "image/png")


def test_upload_rebuilds_jpeg_multipart():
    body, content_type = prepare(
        files=[("file", ("private-name.png", photo(), "image/png"))]
    )
    values, data, mime = decode_form(body, content_type)
    assert values == {"listing_id": LISTING, "request_id": REQUEST, "action": "upload"}
    assert mime == "image/jpeg"
    assert "multipart/form-data; boundary=" in content_type
    assert b"private-name" not in body
    with Image.open(BytesIO(data)) as image:
        assert image.format == "JPEG"


def test_delete_has_no_file():
    fields = [("listing_id", LISTING), ("request_id", REQUEST), ("action", "delete")]
    body, content_type = prepare(fields)
    assert decode_form(body, content_type) == (
        {"listing_id": LISTING, "request_id": REQUEST, "action": "delete"},
        None,
        None,
    )


@pytest.mark.parametrize(
    "fields,files",
    [
        ([("listing_id", "-" * 36), ("request_id", REQUEST), ("action", "delete")], []),
        ([("listing_id", LISTING), ("request_id", "bad"), ("action", "delete")], []),
        ([("listing_id", LISTING), ("request_id", REQUEST), ("action", "remove")], []),
        (
            [("listing_id", LISTING), ("listing_id", LISTING), ("request_id", REQUEST)],
            [],
        ),
        (
            [
                ("listing_id", LISTING),
                ("request_id", REQUEST),
                ("action", "delete"),
                ("action", "delete"),
            ],
            [],
        ),
        (
            None,
            [
                ("file", ("a.png", photo(), "image/png")),
                ("file", ("b.png", photo(), "image/png")),
            ],
        ),
        (
            [("listing_id", LISTING), ("request_id", REQUEST), ("action", "delete")],
            [("file", ("a.png", photo(), "image/png"))],
        ),
        (None, []),
    ],
)
def test_rejects_invalid_fields(fields, files):
    with pytest.raises(HTTPException) as error:
        prepare(fields, files)
    assert error.value.status_code == 400


def test_rejects_non_multipart():
    with pytest.raises(HTTPException):
        asyncio.run(prepare_upload(b"{}", "application/json"))


def test_rejects_malformed_multipart():
    with pytest.raises(HTTPException):
        asyncio.run(prepare_upload(b"not multipart", "multipart/form-data; boundary=x"))


def test_rejects_oversized_envelope():
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            prepare_upload(
                b"x" * (6 * 1024 * 1024 + 1), "multipart/form-data; boundary=x"
            )
        )
    assert error.value.status_code == 413


@pytest.mark.parametrize(
    "fmt,mime", [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")]
)
def test_accepts_supported_static_formats(fmt, mime):
    with Image.open(BytesIO(clean_image(photo(fmt), mime))) as result:
        assert result.format == "JPEG"
        assert result.size == (16, 10)


def test_rejects_decompression_bomb_header():
    import struct
    import zlib

    data = bytearray(photo())
    data[16:24] = struct.pack(">II", 100_000, 100_000)
    data[29:33] = struct.pack(">I", zlib.crc32(data[12:29]))
    with pytest.raises(HTTPException) as error:
        clean_image(bytes(data), "image/png")
    assert error.value.status_code == 400


def test_rejects_unexpected_fields_and_files():
    fields = [("listing_id", LISTING), ("request_id", REQUEST), ("unexpected", "value")]
    with pytest.raises(HTTPException):
        prepare(fields, [("file", ("a.png", photo(), "image/png"))])


def test_canonicalizes_uuid_values():
    fields = [
        ("listing_id", LISTING.upper()),
        ("request_id", REQUEST.upper()),
        ("action", "delete"),
    ]
    body, content_type = prepare(fields)
    values, _, _ = decode_form(body, content_type)
    assert values["listing_id"] == LISTING
    assert values["request_id"] == REQUEST
