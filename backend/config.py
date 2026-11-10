"""Public Supabase configuration; this service never uses administrator keys."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str = ""
    publishable_key: str = ""
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    )

    @classmethod
    def from_env(cls):
        origins = os.environ.get("APP_ORIGINS")
        kwargs = (
            {
                "allowed_origins": tuple(
                    x.strip().rstrip("/") for x in origins.split(",") if x.strip()
                )
            }
            if origins is not None
            else {}
        )
        return cls(
            supabase_url=os.environ.get("SUPABASE_URL")
            or os.environ.get("VITE_SUPABASE_URL", ""),
            publishable_key=os.environ.get("SUPABASE_PUBLISHABLE_KEY")
            or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", ""),
            **kwargs,
        )

    @property
    def configured(self):
        import base64
        import json
        import re
        from urllib.parse import urlsplit

        try:
            url = urlsplit(self.supabase_url)
            host = url.hostname or ""
            key = self.publishable_key
            if (
                not host
                or not re.fullmatch(r"[a-zA-Z0-9.:-]+", host)
                or url.scheme not in {"https", "http"}
                or (
                    url.scheme == "http"
                    and host not in {"localhost", "127.0.0.1", "::1"}
                )
                or url.username
                or url.password
                or url.query
                or url.fragment
                or url.path not in {"", "/"}
                or not key
                or key != key.strip()
                or key.startswith("sb_secret_")
                or any(
                    marker in (self.supabase_url + " " + key).lower()
                    for marker in (
                        "your_project",
                        "your-project",
                        "replace",
                        "placeholder",
                        "example.supabase.co",
                    )
                )
            ):
                return False
            # Legacy public JWTs have role=anon. Never accept an administrative
            # JWT supplied accidentally as the public application key.
            if key.count(".") == 2:
                payload = key.split(".")[1]
                claims = json.loads(
                    base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
                )
                if not isinstance(claims, dict) or claims.get("role") != "anon":
                    return False
            return True
        except (ValueError, TypeError, UnicodeError):
            return False
