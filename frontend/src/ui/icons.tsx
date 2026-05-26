import type { ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const ICON: Record<string, ReactNode> = {
  home: svg(<><path d="M3 11l9-8 9 8" /><path d="M5 10v11h14V10" /></>),
  log: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></>),
  charts: svg(<><path d="M4 20h16" /><path d="M7 16V9M12 16V4M17 16v-6" /></>),
  list: svg(<path d="M4 6h16M4 12h16M4 18h10" />),
};
