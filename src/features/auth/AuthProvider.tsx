import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, getSupabase, errorMessage } from "../../lib/supabase";
import type { Profile } from "../profiles/profile";
interface AuthState {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  confirmed: boolean;
  error: string;
  refresh: () => Promise<void>;
}
const Context = createContext<AuthState>({
  session: null,
  loading: true,
  profile: null,
  confirmed: false,
  error: "",
  refresh: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(configured),
    [profile, setProfile] = useState<Profile | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    if (!configured) return;
    const db = getSupabase();
    const { data, error: e } = await db.auth.getSession();
    if (e) throw e;
    setSession(data.session);
    if (!data.session) {
      setProfile(null);
      setConfirmed(false);
      return;
    }
    const [p, m] = await Promise.all([
      db
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .maybeSingle(),
      db.rpc("is_confirmed_member"),
    ]);
    if (p.error || m.error) throw p.error || m.error;
    setProfile(p.data);
    setConfirmed(m.data === true);
  }
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const db = getSupabase();
    let generation = 0;
    async function load(next: Session | null) {
      const token = ++generation;
      setSession(next);
      setProfile(null);
      setConfirmed(false);
      setLoading(true);
      setError("");
      try {
        if (next) {
          const [p, m] = await Promise.all([
            db
              .from("profiles")
              .select("*")
              .eq("id", next.user.id)
              .maybeSingle(),
            db.rpc("is_confirmed_member"),
          ]);
          if (p.error || m.error) throw p.error || m.error;
          if (alive && token === generation) {
            setProfile(p.data);
            setConfirmed(m.data === true);
          }
        }
      } catch (e) {
        if (alive && token === generation) setError(errorMessage(e));
      } finally {
        if (alive && token === generation) setLoading(false);
      }
    }
    db.auth.getSession().then(({ data, error: e }) => {
      if (!alive) return;
      if (e) {
        setError(e.message);
        setLoading(false);
      } else void load(data.session);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, next) => {
      if (alive) void load(next);
    });
    return () => {
      alive = false;
      generation++;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{ session, profile, confirmed, loading, error, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  return useContext(Context);
}
