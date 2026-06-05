"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, X } from "lucide-react";
import { compressImage } from "@/lib/photo";

interface PhotoCardProps {
  photoDataUrl: string | undefined;
  onChange: (next: string | undefined) => void;
}

export function PhotoCard({ photoDataUrl, onChange }: PhotoCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const data = await compressImage(file);
      onChange(data);
    } catch {
      setError("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  if (photoDataUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoDataUrl}
          alt="Today's photo"
          className="block w-full max-h-72 object-cover"
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Remove photo"
          className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePick(f);
          e.target.value = "";
        }}
      />
      <motion.button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        whileTap={busy ? undefined : { scale: 0.985 }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface min-h-14 text-[14px] text-muted hover:text-foreground hover:border-accent/60 transition-colors disabled:opacity-50"
      >
        <Camera className="h-4 w-4" />
        {busy ? "Compressing…" : "Add a photo"}
      </motion.button>
      {error ? (
        <p className="mt-1.5 text-[12px] text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
