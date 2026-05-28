import { useEffect, useState } from "react";
import { onKey } from "../lib/a11y";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setDeferredPrompt(null);
    }
  }

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 12, right: 12, zIndex: 80,
      maxWidth: 416, margin: "0 auto",
      background: "var(--ink)", color: "var(--mustard)",
      border: "var(--bw) solid var(--mustard)",
      boxShadow: "4px 4px 0 var(--mustard)",
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.1em" }}>
          ★ ADD TO HOME SCREEN
        </div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "var(--cream)", marginTop: 2 }}>
          Install Sendlog for quick access at the wall
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <div role="button" tabIndex={0} className="chunky" onClick={install} onKeyDown={onKey(install)}
          style={{ padding: "6px 12px", background: "var(--mustard)", color: "var(--ink)", fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.06em", textAlign: "center" }}>
          INSTALL
        </div>
        <div role="button" tabIndex={0} onClick={() => setDismissed(true)} onKeyDown={onKey(() => setDismissed(true))}
          style={{ textAlign: "center", fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", cursor: "pointer", letterSpacing: "0.06em" }}>
          NOT NOW
        </div>
      </div>
    </div>
  );
}
