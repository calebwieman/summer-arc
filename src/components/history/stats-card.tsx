interface StatsCardProps {
  label: string;
  value: string | number;
  suffix?: string;
}

export function StatsCard({ label, value, suffix }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <span className="text-[22px] font-semibold tracking-tight text-foreground tabular-nums leading-none">
        {value}
        {suffix ? (
          <span className="text-[12px] font-normal text-muted ml-0.5">
            {suffix}
          </span>
        ) : null}
      </span>
    </div>
  );
}
