import { NavLink } from "react-router-dom";
import { ICON } from "./icons";

const TABS = [
  { to: "/", label: "HOME", icon: ICON.home, end: true },
  { to: "/sessions", label: "SESSIONS", icon: ICON.list, end: false },
  { to: "/sessions/new", label: "LOG IT", icon: ICON.log, end: false },
  { to: "/progress", label: "CHARTS", icon: ICON.charts, end: false },
];

/** Phone bottom tab bar. LOG IT is the centre action. */
export default function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
          {t.icon}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
