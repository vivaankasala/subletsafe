import { useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useLocation,
} from "react-router";
import { House, Menu, X, ArrowUpRight, LogOut, ArrowRight } from "lucide-react";
import { AuthProvider, useAuth } from "../features/auth/AuthProvider";
import { AuthPage, UpdatePassword } from "../features/auth/AuthPage";
import { LandingPage } from "./LandingPage";
import { MarketplacePage } from "../features/listings/MarketplacePage";
import { ListingEditorPage } from "../features/listings/ListingEditorPage";
import { ListingPage } from "../features/listings/ListingPage";
import { RoommatesPage } from "../features/roommates/RoommatesPage";
import { InboxPage } from "../features/messages/InboxPage";
import { ModerationPage } from "../features/safety/ModerationPage";
import { AccountPage } from "../features/account/AccountPage";
import { OnboardingPage } from "../features/profiles/OnboardingPage";
import { configured, getSupabase } from "../lib/supabase";
import { Confirm, Loading, Notice, Setup } from "../components/ui";
import { memberGate } from "../features/profiles/profile";
function Guard({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (!configured) return <Setup />;
  const gate = memberGate(auth.loading, !!auth.session, auth.confirmed);
  if (gate === "loading") return <Loading />;
  if (auth.error)
    return (
      <Notice>
        {auth.error} <a href="/auth">Return to sign in</a>
      </Notice>
    );
  if (gate === "login")
    return (
      <Navigate
        to={
          "/auth?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  if (gate === "confirm") return <Confirm />;
  return children;
}
function Layout() {
  const { session, profile } = useAuth(),
    [menu, setMenu] = useState(false),
    [signOutError, setSignOutError] = useState(""),
    location = useLocation();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="SubletSafe home">
          <span className="brand-icon">
            <House size={22} />
          </span>
          sublet<span>safe</span>
          <span className="brand-period">.</span>
        </Link>
        <button
          className="mobile-menu icon-button"
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          className={menu ? "open" : ""}
          onClick={() => setMenu(false)}
          aria-label="Main navigation"
        >
          <NavLink to="/housing">Find housing</NavLink>
          <NavLink to="/roommates">Find roommates</NavLink>
          {session ? (
            <NavLink to="/messages">Messages</NavLink>
          ) : (
            <NavLink to="/safety">How it works</NavLink>
          )}
        </nav>
        <div className="header-actions">
          {session ? (
            <>
              <NavLink className="profile-link" to="/account">
                {profile?.display_name || "Account"}
              </NavLink>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => {
                  void getSupabase()
                    .auth.signOut()
                    .then(({ error }) => {
                      if (error) setSignOutError(error.message);
                    });
                }}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link className="login-link" to="/auth">
              Log in
            </Link>
          )}
          <Link className="button small-button" to="/housing/new">
            Post a space
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      {!configured && location.pathname !== "/" && (
        <div className="dev-banner">
          Development preview · Supabase connection required for live data
        </div>
      )}
      {signOutError && <Notice>{signOutError}</Notice>}
      <main
        id="main"
        className={location.pathname === "/" ? "landing" : "page-container"}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/auth/callback"
            element={
              <Guard>
                <Navigate to="/profile" replace />
              </Guard>
            }
          />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route
            path="/housing"
            element={
              <Guard>
                <MarketplacePage />
              </Guard>
            }
          />
          <Route
            path="/housing/new"
            element={
              <Guard>
                <ListingEditorPage />
              </Guard>
            }
          />
          <Route
            path="/housing/:id"
            element={
              <Guard>
                <ListingPage />
              </Guard>
            }
          />
          <Route
            path="/housing/:id/edit"
            element={
              <Guard>
                <ListingEditorPage />
              </Guard>
            }
          />
          <Route
            path="/roommates"
            element={
              <Guard>
                <RoommatesPage />
              </Guard>
            }
          />
          <Route
            path="/messages/:id?"
            element={
              <Guard>
                <InboxPage />
              </Guard>
            }
          />
          <Route
            path="/profile"
            element={
              <Guard>
                <OnboardingPage />
              </Guard>
            }
          />
          <Route
            path="/account"
            element={
              <Guard>
                <AccountPage />
              </Guard>
            }
          />
          <Route
            path="/moderation"
            element={
              <Guard>
                <ModerationPage />
              </Guard>
            }
          />
          <Route path="/safety" element={<SafetyPage />} />
          <Route
            path="*"
            element={
              <div className="setup-card">
                <h1>This page has moved out.</h1>
                <p>Let’s help you find your way back.</p>
                <Link className="button" to="/">
                  Back to home
                  <ArrowRight size={16} />
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        <Link className="brand" to="/">
          sublet<span>safe</span>.
        </Link>
        <p>Find your place. Find your people.</p>
        <div>
          <Link to="/safety">Safety & how it works</Link>
          {session && <Link to="/account">Account controls</Link>}
          <span>Michigan, with room to grow.</span>
        </div>
        <small>
          Invite pilot in development. Not affiliated with or endorsed by either
          university.
        </small>
      </footer>
    </>
  );
}
function SafetyPage() {
  return (
    <div className="narrow prose">
      <span className="eyebrow">THOUGHTFUL CONNECTIONS</span>
      <h1>A clearer way to find home.</h1>
      <p>
        SubletSafe brings student housing and roommate discovery together.
        Choose a campus, share your dates and budget, then start a conversation
        about a space or a potential roommate.
      </p>
      <section className="panel">
        <h2>Know what confirmation means.</h2>
        <p>
          University email confirmation checks access to an eligible university
          email inbox. It doesn’t verify identity, ownership, tenancy rights,
          property condition or listing legitimacy.
        </p>
        <h2>Keep your information yours.</h2>
        <p>
          Use an approximate neighborhood in listings. Avoid sharing exact
          addresses, private documents or financial information until you’ve
          independently verified the arrangement. Account email isn’t shown on
          your profile.
        </p>
        <h2>Check before paying.</h2>
        <p>
          Visit or independently verify the property, confirm the listing
          provider has authority to offer it, and review the agreement.
          SubletSafe doesn’t collect deposits, process rent or provide legal
          advice.
        </p>
        <h2>Set boundaries.</h2>
        <p>
          Use Report on a listing, profile or conversation to raise concerns.
          Block prevents new messages and discovery in either direction;
          existing history remains accessible to participants. Manage your
          blocks and request account removal in Account.
        </p>
        <h2>About this pilot.</h2>
        <p>
          The app is in development. Public invitations depend on completing
          moderation coverage, privacy and community policies, retention rules,
          and live system verification. This page is product guidance, not a
          finalized legal policy.
        </p>
      </section>
      <Link className="button" to="/auth?mode=signup">
        Start with your university email
        <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  );
}
