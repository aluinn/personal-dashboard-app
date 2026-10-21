import CountUp from "./CountUp";

export default function Stat({
  label,
  value,
  decimals = 0,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="micro">{label}</div>
      <div className="font-mono text-4xl font-light text-teal glow-text">
        <CountUp to={value} decimals={decimals} suffix={suffix} />
      </div>
      {hint && <div className="micro mt-1 normal-case tracking-wide">{hint}</div>}
    </div>
  );
}
