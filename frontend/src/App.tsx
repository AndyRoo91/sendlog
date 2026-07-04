import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SessionList from "./pages/SessionList";
import SessionForm from "./pages/SessionForm";
import SessionView from "./pages/SessionView";
import TickSheet from "./pages/TickSheet";
import Summary from "./pages/Summary";
import RoutesList from "./pages/RoutesList";
import RouteDetail from "./pages/RouteDetail";
import Design from "./pages/Design";
import LoginPage from "./pages/LoginPage";
import Settings from "./pages/Settings";
import FeedPage from "./pages/FeedPage";
import GymsPage from "./pages/GymsPage";
import PlanPage from "./pages/PlanPage";

// Heavy pages split into their own chunks
const Progress = lazy(() => import("./pages/Progress"));
import { Ribbon, TabBar, GrungeDefs } from "./ui";
import InstallPrompt from "./components/InstallPrompt";
import LockScreen from "./components/LockScreen";
import OfflineStatus from "./components/OfflineStatus";
import { AuthProvider, useAuth } from "./lib/auth";
import { useIdleLock } from "./lib/idleLock";
import "./App.css";

function BrandBar() {
  const { user } = useAuth();
  return (
    <header className="brandbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Link to="/" style={{ textDecoration: "none" }}>
        <Ribbon color="var(--red)">★ SENDLOG ★</Ribbon>
      </Link>
      {user && (
        <Link to="/settings" aria-label={`Settings — signed in as ${user.username}`}
          style={{ textDecoration: "none" }}>
          <div className="wonk" style={{
            fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
            color: "var(--ink-2)", padding: "4px 8px", border: "var(--b) solid var(--ink)",
            background: "var(--paper)", boxShadow: "2px 2px 0 var(--ink)", transform: "rotate(-0.6deg)",
          }}>
            ⚙ {user.username.toUpperCase()}
          </div>
        </Link>
      )}
    </header>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isDesign = pathname === "/design";
  const { locked, lockNow, unlock } = useIdleLock(Boolean(user?.has_pin));

  return (
    <div className="app-shell paper">
      {!isDesign && <BrandBar />}
      <main className="app-main">
        <Suspense fallback={<div className="page"><p className="muted">Loading…</p></div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions" element={<SessionList />} />
            <Route path="/sessions/new" element={<SessionForm />} />
            <Route path="/sessions/:id" element={<TickSheet />} />
            <Route path="/sessions/:id/summary" element={<Summary />} />
            <Route path="/sessions/:id/edit" element={<SessionView />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/routes" element={<RoutesList />} />
            <Route path="/routes/:id" element={<RouteDetail />} />
            <Route path="/gyms" element={<GymsPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/settings" element={<Settings onLockNow={lockNow} />} />
            <Route path="/design" element={<Design />} />
          </Routes>
        </Suspense>
      </main>
      {!isDesign && <TabBar />}
      {!isDesign && <OfflineStatus />}
      <InstallPrompt />
      {locked && <LockScreen onUnlock={unlock} />}
    </div>
  );
}

function AuthGate() {
  const { user, loading, setUser } = useAuth();
  if (loading) {
    return <div className="paper-plain" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p className="muted">Loading…</p>
    </div>;
  }
  if (!user) return <LoginPage onAuthed={setUser} />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <GrungeDefs />
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}
