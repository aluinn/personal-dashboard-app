// Change vs the comparison period. `better` says which direction is good, so the colour means something.
export default function Delta({ cur, prev, better = "up", unit = "", digits = 0 }: { cur: number | null; prev: number | null; better?: "up" | "down" | "none"; unit?: string; digits?: number }) {
  if (cur === null || prev === null) return <span className="micro">no comparison</span>;
  const d = cur - prev;
  if (Math.abs(d) < 0.5 * 10 ** -digits) return <span className="micro">→ same as before</span>;
  const good = better === "none" ? null : (d > 0) === (better === "up");
  const tone = good === null ? "text-muted" : good ? "text-teal" : "text-magenta";
  return (
    <span className={`micro normal-case tracking-wide ${tone}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(digits)}{unit} vs before
    </span>
  );
}
