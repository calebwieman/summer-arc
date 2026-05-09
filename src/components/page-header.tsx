import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  back?: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, back, right }: Props) {
  return (
    <div className="px-5 pt-7 pb-4 flex items-end justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <Link
            href={back}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] mt-1"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        <div className="min-w-0">
          {subtitle && (
            <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-dim)] font-semibold mb-1">
              {subtitle}
            </div>
          )}
          <h1 className="display text-3xl font-bold text-[var(--text)] tracking-tight">
            {title}
          </h1>
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
