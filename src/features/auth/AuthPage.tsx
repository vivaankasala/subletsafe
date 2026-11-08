import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { configured, errorMessage, getSupabase } from "../../lib/supabase";
import { Loading, Notice, Setup } from "../../components/ui";
import { useAuth } from "./AuthProvider";
import { safeReturnPath } from "../profiles/profile";
import { PasswordField } from "./PasswordField";
import { normalizeUniversityEmail } from "./universityEmail";
export function AuthPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "reset">(
      params.get("mode") === "signup"
        ? "signup"
        : params.get("mode") === "reset"
          ? "reset"
          : "login",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  const navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email")).trim().toLowerCase(),
      password = String(f.get("password") || "");
    try {
      const db = getSupabase();
      if (mode === "signup") {
        const { error } = await db.auth.signUp({
          email: normalizeUniversityEmail(email),
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (error) throw error;
        setInfo(
          "If this address needs confirmation, check your inbox and junk folder. If you already confirmed it, sign in instead.",
        );
      } else if (mode === "reset") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth/update-password",
        });
        if (error) throw error;
        setInfo("If an account exists, you’ll receive a password reset link.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.code === "invalid_credentials")
            throw Error(
              "Email or password wasn’t recognized. Check your email address and use Show password to check what you typed, or choose Forgot your password.",
            );
          throw error;
        }
        void navigate(safeReturnPath(params.get("next")));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h1>
          A place to land.
          <br />
          People to share it with.
        </h1>
        <p>Housing and roommate discovery, built around your campus.</p>
        <div className="auth-seal">
          <ShieldCheck />
          <span>
            University email confirmation.
            <br />
            <small>Real conversations. Clear information.</small>
          </span>
        </div>
        <div className="story-lines" aria-hidden="true" />
      </div>
      <div className="auth-form">
        <Link to="/" className="back">
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <span className="eyebrow">WELCOME TO SUBLETSAFE</span>
        <h1>
          {mode === "signup"
            ? "Find your people."
            : mode === "reset"
              ? "Reset your password."
              : "Welcome back."}
        </h1>
        <p className="muted">
          {mode === "signup"
            ? "Your next chapter starts with a university email."
            : "Pick up where your search left off."}
        </p>
        {!configured && (
          <Notice>
            Supabase isn’t connected yet. Sign-in will be available after
            project setup.
          </Notice>
        )}
        <form ref={formRef} onSubmit={submit}>
          <label>
            University email
            <div className="input-icon">
              <Mail size={18} />
              <input
                type="email"
                name="email"
                placeholder="you@umich.edu"
                required
                autoComplete="email"
                maxLength={254}
                aria-describedby="university-email-help"
              />
            </div>
          </label>
          <p id="university-email-help" className="fineprint">
            Only @msu.edu and @umich.edu addresses can create an account.
          </p>
          {mode !== "reset" && (
            <PasswordField
              key={mode}
              label="Password"
              name="password"
              placeholder={
                mode === "signup"
                  ? "At least 10 characters"
                  : "Enter your password"
              }
              minLength={mode === "signup" ? 10 : 1}
              required
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          )}
          {error && <Notice>{error}</Notice>}
          {info && <Notice>{info}</Notice>}
          <button className="button full" disabled={busy || !configured}>
            {busy
              ? "One moment…"
              : mode === "signup"
                ? "Create your account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
            <ArrowRight size={17} />
          </button>
          {mode === "signup" && (
            <button
              type="button"
              className="plain full"
              disabled={busy || !configured}
              onClick={async () => {
                setError("");
                setInfo("");
                setBusy(true);
                try {
                  const email = normalizeUniversityEmail(
                    String(new FormData(formRef.current!).get("email") || ""),
                  );
                  const { error } = await getSupabase().auth.resend({
                    type: "signup",
                    email,
                    options: {
                      emailRedirectTo:
                        window.location.origin + "/auth/callback",
                    },
                  });
                  if (error) throw error;
                  setInfo(
                    "If your account still needs confirmation, a new link has been requested. Check your inbox and junk folder. If already confirmed, sign in.",
                  );
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend confirmation email
            </button>
          )}
        </form>
        <button
          className="plain"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
            setInfo("");
          }}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
        {mode === "login" && (
          <button className="plain small" onClick={() => setMode("reset")}>
            Forgot your password?
          </button>
        )}
        <p className="fineprint">
          University email confirmation does not verify identity, property
          ownership or listing legitimacy. The invite pilot is not yet open to
          the public.
        </p>
      </div>
    </div>
  );
}
export function UpdatePassword() {
  const { session, loading } = useAuth();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!configured) return <Setup />;
  if (loading) return <Loading />;
  if (!session)
    return (
      <div className="setup-card">
        <h1>Open your password-reset link.</h1>
        <p>
          Use the latest link sent to your university email before choosing a
          new password. If it has expired, request another one.
        </p>
        <Link className="button" to="/auth?mode=reset">
          Request a password reset
        </Link>
      </div>
    );
  return (
    <div className="setup-card">
      <h1>Choose a new password</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const password = String(
              new FormData(e.currentTarget).get("password"),
            );
            const { error } = await getSupabase().auth.updateUser({ password });
            if (error) throw error;
            setMessage("Password updated. You can continue to housing.");
          } catch (err) {
            setMessage(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <PasswordField
          label="New password"
          name="password"
          minLength={10}
          autoComplete="new-password"
          required
        />

        <button className="button" disabled={!configured || busy}>
          Update password
        </button>
        {message && <Notice>{message}</Notice>}
      </form>
      <Link to="/housing">Continue to housing</Link>
    </div>
  );
}
