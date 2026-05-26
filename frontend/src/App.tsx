import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SessionList from "./pages/SessionList";
import SessionForm from "./pages/SessionForm";
import SessionView from "./pages/SessionView";
import TickSheet from "./pages/TickSheet";
import Summary from "./pages/Summary";
import Progress from "./pages/Progress";
import Design from "./pages/Design";
import { Ribbon, TabBar } from "./ui";
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
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<SessionList />} />
          <Route path="/sessions/new" element={<SessionForm />} />
          <Route path="/sessions/:id" element={<TickSheet />} />
          <Route path="/sessions/:id/summary" element={<Summary />} />
          <Route path="/sessions/:id/edit" element={<SessionView />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/design" element={<Design />} />
        </Routes>
      </main>
      {!isDesign && <TabBar />}
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
