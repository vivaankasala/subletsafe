import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  LoaderCircle,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      <h2>Getting things ready…</h2>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <SlidersHorizontal />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Setup() {
  return (
    <div className="setup-card">
      <span className="eyebrow">DEVELOPMENT SETUP</span>
      <h2>Your campus community starts here.</h2>
      <p>
        The app is built to connect to Supabase. Add your project URL and
        publishable key in <code>.env.local</code>, apply the migrations, then
        restart the app.
      </p>
      <Notice>No live accounts or listings are connected yet.</Notice>
      <Link className="text-link" to="/">
        Back to SubletSafe <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}
export function Confirm() {
  return (
    <div className="setup-card">
      <ShieldCheck size={32} />
      <h2>Finish joining your campus.</h2>
      <p>
        Confirm your university email and make sure the pilot operator has
        invited that address. Then sign in again to browse and connect.
      </p>
      <p className="muted">
        If your email is confirmed but access is unavailable, contact the pilot
        operator to review your account.
      </p>
      <Link className="button" to="/auth">
        Return to sign in
      </Link>
    </div>
  );
}
export function AsyncButton({
  action,
  children,
  className = "button secondary",
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  return (
    <>
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await action();
            setDone(true);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Action failed. Try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : done ? (
          <Check size={16} />
        ) : null}
        {children}
      </button>
      {error && <Notice>{error}</Notice>}
    </>
  );
}
