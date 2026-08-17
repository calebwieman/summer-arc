"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { haptic } from "@/lib/haptics";

/** The app mark, drawn inline so the gate needs no network round-trip. */
function Mark({ size = 56 }: { size?: number }) {
  const s = size;
  const cx = s * 0.35;
  const cy = s * 0.44;
  const w = s * 0.075;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      <rect
        x={cx - w / 2}
        y={cy}
        width={w}
        height={s * 0.85 - cy}
        rx={w / 2}
        className="fill-ink"
        opacity={0.32}
      />
      <rect
        x={cx - w / 2}
        y={s * 0.15}
        width={w}
        height={cy - s * 0.15}
        rx={w / 2}
        className="fill-ink"
      />
      <rect
        x={s * 0.19}
        y={cy - (s * 0.075) / 2}
        width={s * 0.63}
        height={s * 0.075}
        rx={(s * 0.075) / 2}
        className="fill-ink"
      />
    </svg>
  );
}

export default function LoginPage() {
  const reduced = useReducedMotion();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");
  // Until React has hydrated, the submit button does nothing. Tapped before
  // then, the browser performs the form's own submit and the handler below
  // never runs — which is how a password ends up in the URL bar.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || state === "checking") return;
    setState("checking");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        haptic([16, 24, 10]);
        // replace() so Back cannot land on the gate again.
        window.location.replace("/");
        return;
      }
      haptic(10);
      setState("wrong");
      setPassword("");
    } catch {
      setState("wrong");
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 pb-[env(safe-area-inset-bottom)] text-center">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="w-full max-w-[320px]"
      >
        <div className="flex justify-center">
          <Mark />
        </div>

        <h1 className="mt-6 text-[34px] font-light leading-none tracking-[-0.03em] text-ink">
          Standard
        </h1>
        <p className="kicker mt-3">Hold the standard</p>

        {/* method="post" is the second guard: if a native submit ever does
            fire, the password travels in the body, never as ?password= in the
            address bar, history and referrer. */}
        <form onSubmit={submit} method="post" className="mt-9">
          <label htmlFor="pw" className="sr-only">
            Password
          </label>
          <input
            id="pw"
            name="password"
            type="password"
            inputMode="text"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (state === "wrong") setState("idle");
            }}
            placeholder="XXXX-XXXX-XXXX"
            aria-invalid={state === "wrong"}
            aria-describedby="pw-status"
            className={`w-full rounded-sm border bg-surface-2 px-4 py-4 text-center font-mono text-[16px] tracking-[0.14em] text-ink uppercase placeholder:text-ink-3 placeholder:tracking-[0.14em] outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              state === "wrong" ? "border-bad" : "border-line-mid"
            }`}
          />

          <motion.button
            type="submit"
            disabled={!ready || !password || state === "checking"}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 520, damping: 32 }}
            className="mt-3 min-h-12 w-full rounded-sm border border-line-mid font-mono text-[11px] uppercase tracking-[0.2em] text-ink-2 transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            {state === "checking" ? "checking" : "unlock"}
          </motion.button>
        </form>

        <p
          id="pw-status"
          role="status"
          aria-live="polite"
          className="mt-5 min-h-4 font-mono text-[9.5px] uppercase tracking-[0.18em]"
        >
          <span className={state === "wrong" ? "text-bad" : "text-ink-3"}>
            {state === "wrong" ? "not that one" : "once per device"}
          </span>
        </p>
      </motion.div>
    </main>
  );
}
