interface Props {
  size?: number;
  color?: string;
}

/** 10-point selection star — used as a grade-chip halo. */
export default function StarBurst({ size = 50, color = "var(--red)" }: Props) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <polygon
        points="50,5 58,38 92,38 64,58 75,92 50,72 25,92 36,58 8,38 42,38"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
