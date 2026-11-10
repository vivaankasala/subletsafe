"""Same-origin, allowlisted Supabase HTTP gateway."""

import json
import re
from urllib.parse import unquote

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException

from .config import Settings
from .validation import RPC_FIELDS, validate_rpc, validate_write

TABLE_METHODS = {
    "universities": {"GET", "HEAD"},
    "profiles": {"GET", "HEAD", "POST", "PATCH"},
    "housing_listings": {"GET", "HEAD", "POST", "PATCH"},
    "blocks": {"GET", "HEAD", "POST", "DELETE"},
    "reports": {"GET", "HEAD", "POST"},
    "pilot_events": {"POST"},
    "conversations": {"GET", "HEAD"},
    "messages": {"GET", "HEAD"},
    "listing_images": {"GET", "HEAD"},
}
AUTH_METHODS = {
    "settings": {"GET"},
    "signup": {"POST"},
    "token": {"POST"},
    "recover": {"POST"},
    "resend": {"POST"},
    "verify": {"POST"},
    "user": {"GET", "PUT"},
    "logout": {"POST"},
}
SAFE_HEADERS = {
    "content-type",
    "accept",
    "prefer",
    "range",
    "range-unit",
    "x-supabase-api-version",
}
RESPONSE_HEADERS = {
    "content-type",
    "content-range",
    "range-unit",
    "x-supabase-api-version",
    "retry-after",
}


def error(status, message, code):
    return JSONResponse({"message": message, "code": code}, status_code=status)


def route_kind(path, method):
    # Reject encoded separators and dot segments even when ASGI has decoded once.
    decoded = unquote(path)
    if (
        decoded != path
        or any(x in {"", ".", ".."} for x in path.split("/"))
        or any(c in path for c in "\\?#\r\n\x00")
    ):
        return None
    parts = path.split("/")
    if (
        len(parts) == 3
        and parts[:2] == ["auth", "v1"]
        and method in AUTH_METHODS.get(parts[2], set())
    ):
        return "auth", parts[2]
    if (
        len(parts) == 3
        and parts[:2] == ["rest", "v1"]
        and method in TABLE_METHODS.get(parts[2], set())
    ):
        return "table", parts[2]
    if (
        len(parts) == 4
        and parts[:3] == ["rest", "v1", "rpc"]
        and parts[3] in RPC_FIELDS
        and method == "POST"
    ):
        return "rpc", parts[3]
    if (
        len(parts) >= 6
        and parts[:5] == ["storage", "v1", "object", "sign", "listing-photos"]
        and method == "POST"
    ):
        return "storage", "sign"
    if path == "functions/v1/upload-listing-image" and method == "POST":
        return "upload", "upload"
    return None


async def bounded_body(request, limit):
    declared = request.headers.get("content-length")
    if declared:
        try:
            if int(declared) < 0 or int(declared) > limit:
                raise ValueError()
        except ValueError:
            raise OverflowError()
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > limit:
            raise OverflowError()
        body.extend(chunk)
    return bytes(body)


def create_app(settings=None, transport=None):
    settings = settings if settings is not None else Settings.from_env()
    app = FastAPI(
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        redirect_slashes=False,
    )

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(
            exc.status_code,
            str(exc.detail),
            "body_too_large" if exc.status_code == 413 else "validation_error",
        )

    @app.exception_handler(RequestValidationError)
    async def request_error(request, exc):
        return error(400, "Invalid request payload", "validation_error")

    @app.middleware("http")
    async def origins(request, call_next):
        origin = request.headers.get("origin")
        same_origin = str(request.base_url).rstrip("/")
        allowed = (
            origin is None
            or origin == same_origin
            or origin in settings.allowed_origins
        )
        if not allowed:
            return error(403, "Origin is not allowed", "origin_denied")
        if request.method == "OPTIONS":
            requested = request.headers.get("access-control-request-headers", "")
            allowed_headers = SAFE_HEADERS | {
                "authorization",
                "apikey",
                "x-client-info",
            }
            if any(
                x.strip().lower() not in allowed_headers
                for x in requested.split(",")
                if x.strip()
            ):
                return error(403, "Header is not allowed", "header_denied")
            response = Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": ", ".join(sorted(allowed_headers)),
                },
            )
        else:
            response = await call_next(request)
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Expose-Headers"] = ", ".join(
                sorted(RESPONSE_HEADERS)
            )
        return response

    @app.get("/healthz")
    @app.get("/api/healthz")
    async def health():
        return {"status": "ok"}

    @app.get("/api/readyz")
    async def ready():
        return (
            {"status": "ready"}
            if settings.configured
            else error(503, "Backend is not configured", "not_configured")
        )

    @app.api_route(
        "/api/supabase/{path:path}",
        methods=[
            "GET",
            "HEAD",
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
            "OPTIONS",
            "TRACE",
            "CONNECT",
        ],
    )
    async def gateway(path: str, request: Request):
        if len(request.url.query) > 8192:
            return error(414, "Query is too long", "query_too_large")
        route = route_kind(path, request.method)
        if route is None:
            return error(403, "Operation is not allowed", "operation_denied")
        if not settings.configured:
            return error(503, "Backend is not configured", "not_configured")
        kind, target = route
        headers = {k: v for k, v in request.headers.items() if k in SAFE_HEADERS}
        # Only return/count preferences are needed. In particular, never forward
        # max-affected, handling, resolution, or arbitrary future preferences.
        if "prefer" in headers:
            headers["prefer"] = ",".join(
                x.strip()
                for x in headers["prefer"].split(",")
                if x.strip()
                in {
                    "return=representation",
                    "return=minimal",
                    "count=exact",
                    "count=planned",
                    "count=estimated",
                }
            )
        headers["apikey"] = settings.publishable_key
        bearer = request.headers.get("authorization", "")
        if bearer:
            headers["authorization"] = bearer
        protected = kind != "auth" and not (
            kind == "table"
            and target == "universities"
            and request.method in {"GET", "HEAD"}
        )
        if protected and (
            not bearer.lower().startswith("bearer ")
            or not bearer[7:].strip()
            or bearer[7:].strip() == settings.publishable_key
        ):
            return error(401, "Sign in first", "not_authenticated")
        try:
            body = await bounded_body(
                request, 6 * 1024 * 1024 if kind == "upload" else 128 * 1024
            )
        except OverflowError:
            return error(413, "Request body is too large", "body_too_large")
        async with httpx.AsyncClient(
            transport=transport, timeout=httpx.Timeout(20.0), follow_redirects=False
        ) as client:
            try:
                actor = None
                if protected:
                    verified = await client.get(
                        settings.supabase_url.rstrip("/") + "/auth/v1/user",
                        headers={
                            "apikey": settings.publishable_key,
                            "authorization": bearer,
                        },
                    )
                    if verified.status_code == 429:
                        response = error(
                            429,
                            "Authentication is temporarily rate limited. Try again shortly.",
                            "auth_rate_limited",
                        )
                        if "retry-after" in verified.headers:
                            response.headers["retry-after"] = verified.headers[
                                "retry-after"
                            ]
                        return response
                    if verified.status_code >= 500 or 300 <= verified.status_code < 400:
                        return error(
                            502,
                            "Authentication service is temporarily unavailable",
                            "upstream_unavailable",
                        )
                    if verified.status_code != 200:
                        return error(
                            401, "Session is invalid or expired", "not_authenticated"
                        )
                    try:
                        from uuid import UUID

                        actor = str(UUID(verified.json()["id"]))
                    except (ValueError, KeyError, TypeError):
                        return error(
                            401, "Session is invalid or expired", "not_authenticated"
                        )
                try:
                    if kind == "upload":
                        from .uploads import prepare_upload

                        body, headers["content-type"] = await prepare_upload(
                            body, headers.get("content-type", "")
                        )
                    elif kind == "auth" and target == "signup":
                        value = json.loads(body)
                        email = value.get("email", "")
                        if not isinstance(email, str):
                            raise ValueError()
                        email = email.strip().lower()
                        if len(email) > 254 or not re.fullmatch(
                            r"[^\s@]+@(msu\.edu|umich\.edu)", email
                        ):
                            return error(
                                400,
                                "Use your @msu.edu or @umich.edu email",
                                "validation_error",
                            )
                        value["email"] = email
                        body = json.dumps(value).encode()
                    elif kind == "table" and request.method in {"POST", "PATCH"}:
                        body = json.dumps(
                            validate_write(
                                target, json.loads(body), actor, request.method
                            )
                        ).encode()
                    elif kind == "rpc":
                        body = json.dumps(
                            validate_rpc(target, json.loads(body or b"{}"))
                        ).encode()
                    elif kind == "storage":
                        value = json.loads(body)
                        if (
                            not isinstance(value, dict)
                            or set(value) != {"expiresIn"}
                            or type(value["expiresIn"]) is not int
                            or not 1 <= value["expiresIn"] <= 3600
                        ):
                            raise ValueError()
                except (ValueError, TypeError, KeyError, AttributeError):
                    return error(400, "Invalid request payload", "validation_error")
                upstream_url = settings.supabase_url.rstrip("/") + "/" + path
                if request.url.query:
                    upstream_url += "?" + request.url.query
                upstream = await client.request(
                    request.method, upstream_url, headers=headers, content=body
                )
            except httpx.RequestError:
                return error(
                    502, "Upstream service is unavailable", "upstream_unavailable"
                )
        if 300 <= upstream.status_code < 400:
            return error(502, "Unexpected upstream redirect", "upstream_unavailable")
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers={
                k: v for k, v in upstream.headers.items() if k in RESPONSE_HEADERS
            },
        )

    return app


app = create_app()
