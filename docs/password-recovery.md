# Password visibility and recovery

Password inputs on login, signup, and password update have an accessible show/hide button. The button preserves the entered value and does not submit the form. Passwords remain masked by default.

The observed sign-in requests reached Supabase and returned invalid_credentials. The existing account was confirmed, had a password set, and was not banned. Its password was not changed administratively. Users can inspect their typed password and request recovery using `/auth?mode=reset`.

Direct recovery navigation now opens the reset form. Password updates require an authenticated session; missing or expired sessions show instructions for requesting a fresh email link. An actual recovery email and password change still need user verification, including the hosted redirect allowlist for `/auth/update-password`.

Validation: 52 tests pass, including DOM checks for visibility, value retention, no accidental submission, recovery navigation, missing recovery sessions, and invalid credentials. Test auth requests use synthetic configuration and a local HTTP fixture.
