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

// Heavy pages split into their own chunks
const Progress = lazy(() => import("./pages/Progress"));
import { Ribbon, TabBar } from "./ui";
import InstallPrompt from "./components/InstallPrompt";
import "./App.css";

function BrandBar() {
  return (
    <header className="brandbar">
      <Link to="/" style={{ textDecoration: "none" }}>
        <Ribbon color="var(--red)">★ SENDLOG ★</Ribbon>
      </Link>
    </header>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const isDesign = pathname === "/design";

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
            <Route path="/progress" element={<Progress />} />
            <Route path="/routes" element={<RoutesList />} />
            <Route path="/routes/:id" element={<RouteDetail />} />
            <Route path="/design" element={<Design />} />
          </Routes>
        </Suspense>
      </main>
      {!isDesign && <TabBar />}
      <InstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
