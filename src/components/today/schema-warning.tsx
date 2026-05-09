import { AlertTriangle } from "lucide-react";

export function SchemaWarning() {
  return (
    <div className="mx-5 mt-5 rounded-xl border border-[var(--warn)] bg-[var(--warn)]/10 p-4 flex gap-3 items-start">
      <AlertTriangle size={20} className="text-[var(--warn)] flex-shrink-0 mt-0.5" />
      <div className="text-sm text-[var(--text)]">
        <div className="font-semibold mb-1">Database not initialized</div>
        <div className="text-[var(--text-muted)]">
          Run the SQL in <code className="bg-[var(--surface-3)] px-1 py-0.5 rounded text-xs">docs/schema.sql</code>{" "}
          inside your Supabase project (SQL Editor → New query → paste → Run). Then refresh.
        </div>
      </div>
    </div>
  );
}
