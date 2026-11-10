import asyncio
import json

import httpx
import pytest

from backend.app import create_app
from backend.config import Settings
from backend.validation import validate_write

ACTOR = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
SETTINGS = Settings("https://synthetic.supabase.co", "public-synthetic")


def run_request(
    method="GET",
    path="rest/v1/profiles",
    handler=None,
    headers=None,
    content=None,
    settings=SETTINGS,
):
    calls = []

    def upstream(request):
        calls.append(request)
        if handler:
            return handler(request)
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ACTOR})
        return httpx.Response(200, json=[])

    async def run():
        app = create_app(settings, transport=httpx.MockTransport(upstream))
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            return await client.request(
                method, "/api/supabase/" + path, headers=headers or {}, content=content
            )

    return asyncio.run(run()), calls


def test_data_requires_bearer():
    response, calls = run_request()
    assert response.status_code == 401
    assert calls == []


def test_publishable_key_is_not_session():
    response, calls = run_request(headers={"Authorization": "Bearer public-synthetic"})
    assert response.status_code == 401
    assert not calls


def test_invalid_user_stops_data_request():
    response, calls = run_request(
        headers={"Authorization": "Bearer invalid"},
        handler=lambda request: httpx.Response(401, json={"message": "expired"}),
    )
    assert response.status_code == 401
    assert len(calls) == 1


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "auth/v1/admin/users"),
        ("GET", "rest/v1/moderator_roles"),
        ("DELETE", "rest/v1/profiles"),
        ("POST", "rest/v1/messages"),
        ("POST", "rest/v1/rpc/reserve_listing_image"),
        ("POST", "storage/v1/object/listing-photos/foo.jpg"),
        ("GET", "functions/v1/upload-listing-image"),
        ("GET", "rest/v1/profiles/extra"),
        ("TRACE", "rest/v1/profiles"),
    ],
)
def test_path_and_method_allowlist(method, path):
    response, calls = run_request(method, path)
    assert response.status_code == 403
    assert not calls


def test_universities_are_public():
    response, calls = run_request(path="rest/v1/universities")
    assert response.status_code == 200
    assert len(calls) == 1


def test_query_headers_and_response_wire_preserved():
    def upstream(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ACTOR})
        assert request.url.query == b"select=*&id=eq.example&order=created_at.desc"
        assert request.headers["apikey"] == "public-synthetic"
        assert request.headers["authorization"] == "Bearer member"
        assert request.headers["range"] == "0-11"
        assert request.headers["prefer"] == "count=exact,return=representation"
        assert "origin" not in request.headers
        assert "cookie" not in request.headers
        assert "x-arbitrary" not in request.headers
        return httpx.Response(
            206,
            json=[{"id": ACTOR}],
            headers={
                "content-range": "0-0/1",
                "set-cookie": "bad=1",
                "x-supabase-api-version": "2024-01-01",
            },
        )

    response, _calls = run_request(
        path="rest/v1/profiles?select=*&id=eq.example&order=created_at.desc",
        handler=upstream,
        headers={
            "Authorization": "Bearer member",
            "apikey": "attacker",
            "Range": "0-11",
            "Origin": "http://testserver",
            "Cookie": "secret=1",
            "X-Arbitrary": "no",
            "Prefer": "count=exact,max-affected=999999,return=representation",
        },
    )
    assert response.status_code == 206
    assert response.json() == [{"id": ACTOR}]
    assert response.headers["content-range"] == "0-0/1"
    assert response.headers["x-supabase-api-version"] == "2024-01-01"
    assert "set-cookie" not in response.headers


def test_auth_error_wire_preserved():
    response, _ = run_request(
        "POST",
        "auth/v1/token?grant_type=password",
        content=b'{"email":"a@example.com","password":"x"}',
        handler=lambda request: httpx.Response(
            400,
            json={
                "message": "Invalid login credentials",
                "code": "invalid_credentials",
            },
            headers={"x-supabase-api-version": "2024-01-01"},
        ),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_credentials"
    assert response.headers["x-supabase-api-version"] == "2024-01-01"


@pytest.mark.parametrize(
    "path", ["auth/v1/token?grant_type=password", "auth/v1/recover"]
)
def test_login_and_recovery_allow_non_university_email(path):
    response, calls = run_request(
        "POST", path, content=b'{"email":"person@example.com","password":"valid"}'
    )
    assert response.status_code == 200
    assert len(calls) == 1


def test_signup_restricts_and_normalizes_email():
    response, calls = run_request(
        "POST",
        "auth/v1/signup",
        content=b'{"email":"  Student@MSU.EDU  ","password":"valid"}',
    )
    assert response.status_code == 200
    assert json.loads(calls[0].content)["email"] == "student@msu.edu"
    response, calls = run_request(
        "POST", "auth/v1/signup", content=b'{"email":"person@msu.edu.attacker.com"}'
    )
    assert response.status_code == 400
    assert not calls


def test_actor_is_clamped_and_validation_runs_before_write():
    response, calls = run_request(
        "POST",
        "rest/v1/blocks",
        headers={"Authorization": "Bearer member", "Content-Type": "application/json"},
        content=json.dumps({"blocker_id": OTHER, "blocked_id": OTHER}),
    )
    assert response.status_code == 200
    assert json.loads(calls[-1].content)["blocker_id"] == ACTOR
    response, calls = run_request(
        "PATCH",
        "rest/v1/profiles?id=eq." + ACTOR,
        headers={"Authorization": "Bearer member"},
        content=b'{"restricted":false}',
    )
    assert response.status_code == 400
    assert len(calls) == 1


@pytest.mark.parametrize(
    "table,payload",
    [
        ("profiles", {"min_budget": -1}),
        ("profiles", {"min_budget": 200, "max_budget": 100}),
        ("profiles", {"seeking_roommate": "true"}),
        ("profiles", {"move_in_date": "2026-02-30"}),
        ("profiles", {"display_name": " "}),
        ("profiles", {"deleted_at": None}),
        ("housing_listings", {"monthly_rent": True}),
        ("housing_listings", {"monthly_rent": 100.5}),
        (
            "housing_listings",
            {"available_from": "2026-12-12", "available_until": "2026-11-11"},
        ),
        ("housing_listings", {"title": None}),
        ("housing_listings", {"bathrooms": float("nan")}),
        ("housing_listings", {"status": "removed"}),
    ],
)
def test_negative_write_validation(table, payload):
    with pytest.raises(ValueError):
        validate_write(table, payload, ACTOR, "PATCH")


def test_partial_listing_and_profile_writes():
    assert validate_write(
        "housing_listings", {"status": "unavailable"}, ACTOR, "PATCH"
    ) == {"status": "unavailable"}
    assert validate_write(
        "profiles", {"display_name": " Student ", "id": OTHER}, ACTOR, "PATCH"
    ) == {"display_name": "Student"}


def test_body_limit_declared_and_chunked():
    response, calls = run_request(
        "POST", "auth/v1/token", content=b"x" * (128 * 1024 + 1)
    )
    assert response.status_code == 413
    assert not calls

    async def chunks():
        yield b"x" * (64 * 1024)
        yield b"x" * (65 * 1024)

    response, calls = run_request("POST", "auth/v1/token", content=chunks())
    assert response.status_code == 413
    assert not calls


def test_upstream_timeout_is_sanitized():
    def timeout(request):
        assert request.extensions["timeout"]["read"] == 20.0
        raise httpx.ReadTimeout("secret-token", request=request)

    response, _ = run_request("POST", "auth/v1/token", handler=timeout, content=b"{}")
    assert response.status_code == 502
    assert "secret" not in response.text


def test_redirect_not_followed():
    response, calls = run_request(
        "GET",
        "auth/v1/settings",
        handler=lambda request: httpx.Response(
            302, headers={"location": "https://attacker.example/"}
        ),
    )
    assert response.status_code == 502
    assert len(calls) == 1


def test_origin_denied():
    response, calls = run_request(headers={"Origin": "https://attacker.example"})
    assert response.status_code == 403
    assert not calls


def test_health_and_readiness():
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app(Settings())),
            base_url="http://testserver",
        ) as client:
            assert (await client.get("/healthz")).status_code == 200
            assert (await client.get("/api/healthz")).status_code == 200
            assert (await client.get("/api/readyz")).status_code == 503

    asyncio.run(run())


def test_signup_length_is_bounded():
    response, calls = run_request(
        "POST", "auth/v1/signup", content=json.dumps({"email": "a" * 250 + "@msu.edu"})
    )
    assert response.status_code == 400
    assert not calls


def test_body_validation_does_not_leak_input():
    response, _ = run_request(
        "PATCH",
        "rest/v1/profiles",
        headers={"Authorization": "Bearer member"},
        content=b'{"bio":"sensitive-synthetic-value","restricted":false}',
    )
    assert response.status_code == 400
    assert "sensitive-synthetic-value" not in response.text
    assert response.json() == {
        "message": "Invalid request payload",
        "code": "validation_error",
    }


def test_full_listing_insert_validated_and_actor_clamped():
    listing = {
        "title": " Studio ",
        "description": " Bright apartment ",
        "university_id": OTHER,
        "owner_id": OTHER,
        "monthly_rent": 95000,
        "approximate_location": "Near campus",
        "property_type": "studio",
        "available_from": "2027-01-01",
        "available_until": None,
        "bedrooms": 0,
        "bathrooms": 1,
        "status": "active",
    }
    response, calls = run_request(
        "POST",
        "rest/v1/housing_listings?select=*",
        headers={"Authorization": "Bearer member"},
        content=json.dumps(listing),
    )
    assert response.status_code == 200
    payload = json.loads(calls[-1].content)
    assert payload["owner_id"] == ACTOR
    assert payload["title"] == "Studio"
    assert payload["monthly_rent"] == 95000


def test_rpc_unknown_arguments_blocked():
    response, calls = run_request(
        "POST",
        "rest/v1/rpc/is_moderator",
        headers={"Authorization": "Bearer member"},
        content=b'{"user_id":"attacker"}',
    )
    assert response.status_code == 400
    assert len(calls) == 1


def test_signed_storage_is_authenticated_and_expiry_bounded():
    response, calls = run_request(
        "POST",
        "storage/v1/object/sign/listing-photos/a/b.jpg",
        headers={"Authorization": "Bearer member"},
        content=b'{"expiresIn":300}',
    )
    assert response.status_code == 200
    assert len(calls) == 2
    response, calls = run_request(
        "POST",
        "storage/v1/object/sign/listing-photos/a/b.jpg",
        headers={"Authorization": "Bearer member"},
        content=b'{"expiresIn":999999}',
    )
    assert response.status_code == 400
    assert len(calls) == 1


def test_patch_never_writes_identity_columns():
    for table, payload, identity in [
        ("profiles", {"display_name": "Student", "id": OTHER}, "id"),
        ("housing_listings", {"status": "draft", "owner_id": OTHER}, "owner_id"),
    ]:
        response, calls = run_request(
            "PATCH",
            "rest/v1/" + table,
            headers={"Authorization": "Bearer member"},
            content=json.dumps(payload),
        )
        assert response.status_code == 200
        assert identity not in json.loads(calls[-1].content)


@pytest.mark.parametrize(
    "url,key",
    [
        ("https://project.supabase.co", "sb_secret_do_not_use"),
        ("http://project.supabase.co", "public-synthetic"),
        ("https://YOUR_PROJECT.supabase.co", "public-synthetic"),
        ("https://project.supabase.co", "REPLACE_WITH_PUBLIC_KEY"),
    ],
)
def test_config_rejects_unsafe_or_placeholder_values(url, key):
    assert not Settings(url, key).configured


def test_config_rejects_service_role_jwt():
    import base64

    payload = base64.urlsafe_b64encode(b'{"role":"service_role"}').decode().rstrip("=")
    assert not Settings(
        "https://project.supabase.co", "header." + payload + ".signature"
    ).configured


def test_config_reads_app_origins(monkeypatch):
    monkeypatch.setenv("APP_ORIGINS", "http://localhost:8080,https://subletsafe.test")
    assert Settings.from_env().allowed_origins == (
        "http://localhost:8080",
        "https://subletsafe.test",
    )


@pytest.mark.parametrize("status", [429, 500, 503])
def test_transient_auth_failures_do_not_claim_invalid_session(status):
    def upstream(request):
        assert request.url.path == "/auth/v1/user"
        return httpx.Response(
            status,
            json={"message": "sensitive upstream detail"},
            headers={"retry-after": "12"},
        )

    response, calls = run_request(
        handler=upstream, headers={"Authorization": "Bearer member"}
    )
    assert len(calls) == 1
    assert response.status_code == (429 if status == 429 else 502)
    assert "expired" not in response.text
    assert "sensitive upstream detail" not in response.text
    if status == 429:
        assert response.headers["retry-after"] == "12"
