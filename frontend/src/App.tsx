import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SessionList from "./pages/SessionList";
import SessionForm from "./pages/SessionForm";
import SessionView from "./pages/SessionView";
import Progress from "./pages/Progress";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <span className="nav-logo">🧗 ClimbLog</span>
        <div className="nav-links">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/sessions">Sessions</NavLink>
          <NavLink to="/progress">Progress</NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions" element={<SessionList />} />
        <Route path="/sessions/new" element={<SessionForm />} />
        <Route path="/sessions/:id" element={<SessionView />} />
        <Route path="/sessions/:id/edit" element={<SessionForm />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </BrowserRouter>
  );
}
