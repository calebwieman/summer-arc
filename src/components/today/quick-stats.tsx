import { Card, CardHeader, CardBody, CardLabel } from "@/components/ui/card";
import { formatMoneyFull } from "@/lib/utils";
import { TrendingUp, Zap, Briefcase } from "lucide-react";

interface Props {
  outreachThisWeek: number;
  outreachTarget: number;
  closedThisWeek: number;
  earnedThisWeek: number;
}

export function QuickStats({
  outreachThisWeek,
  outreachTarget,
  closedThisWeek,
  earnedThisWeek,
}: Props) {
  return (
    <Card className="mx-5 my-3">
      <CardHeader>
        <CardLabel>AIGENTIC · THIS WEEK</CardLabel>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-3 gap-3">
          <Stat
            icon={<Zap size={14} />}
            label="Outreach"
            value={`${outreachThisWeek}`}
            sub={`/ ${outreachTarget}`}
          />
          <Stat
            icon={<Briefcase size={14} />}
            label="Closed"
            value={`${closedThisWeek}`}
            sub="deals"
          />
          <Stat
            icon={<TrendingUp size={14} />}
            label="Earned"
            value={formatMoneyFull(earnedThisWeek)}
            sub="this wk"
          />
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[var(--text-dim)]">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.15em] font-medium">
          {label}
        </span>
      </div>
      <div className="display text-2xl font-bold text-[var(--text)] tabular">
        {value}
      </div>
      <div className="text-[10px] text-[var(--text-dim)] tabular">{sub}</div>
    </div>
  );
}
