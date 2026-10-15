"use client";

import { useRef, useState } from "react";
import {
  prepareImageForScan,
  scanLabelImage,
  type ScanResult,
} from "@/lib/scan";

type Props = {
  onResult: (result: ScanResult) => void;
};

export function CameraScan({ onResult }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [lastRaw, setLastRaw] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setLastRaw("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    setScanning(true);
    setProgress(0);
    try {
      const prepared = await prepareImageForScan(file);
      const result = await scanLabelImage(prepared, setProgress);
      setLastRaw(result.rawText);
      if (!result.name && !result.expiresOn) {
        setError(
          "Couldn’t read a name or date — try a sharper photo of the best-before line.",
        );
      } else {
        onResult(result);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Scan failed. Try again with more light.",
      );
    } finally {
      setScanning(false);
      setProgress(0);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent-soft)]/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg">
            Scan with camera
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Point at the product name and best-before / use-by date. Works on
            iPhone — no typing needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={scanning}
            onClick={() => cameraRef.current?.click()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {scanning ? "Reading label…" : "Open camera"}
          </button>
          <button
            type="button"
            disabled={scanning}
            onClick={() => libraryRef.current?.click()}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm disabled:opacity-60"
          >
            Choose photo
          </button>
        </div>
      </div>

      {/* capture=environment → rear camera on iPhone */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFile(file);
          e.target.value = "";
        }}
      />

      {preview ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Label preview"
            className="max-h-48 w-full object-contain"
          />
        </div>
      ) : null}

      {scanning ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Running on-device OCR ({Math.round(progress)}%) — nothing is uploaded.
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {lastRaw && !scanning ? (
        <details className="mt-3 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">Show text the scanner read</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-2">
            {lastRaw}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
