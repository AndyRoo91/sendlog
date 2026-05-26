export type ClimbMode = "boulder" | "lead";

interface Props {
  active?: ClimbMode;
  onChange?: (mode: ClimbMode) => void;
}

/** BOULDER / LEAD top toggle. */
export default function ModeToggle({ active = "boulder", onChange }: Props) {
  const cell = (mode: ClimbMode, label: string) => (
    <div
      className="chunky"
      onClick={onChange ? () => onChange(mode) : undefined}
      style={{
        flex: 1,
        padding: "8px 0",
        textAlign: "center",
        fontSize: 13,
        background: active === mode ? "var(--ink)" : "var(--cream)",
        color: active === mode ? "var(--mustard)" : "var(--ink-2)",
        boxShadow: active === mode ? "3px 3px 0 var(--ink)" : "none",
      }}
    >
      {label}
    </div>
  );

  return (
    <div style={{ display: "flex", padding: "14px 16px 8px", gap: 8 }}>
      {cell("boulder", "BOULDER")}
      {cell("lead", "LEAD")}
    </div>
  );
}
