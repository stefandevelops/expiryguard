import { createWorker, type Worker } from "tesseract.js";
import { todayISO, type Category } from "@/lib/items";

export type ScanResult = {
  name: string;
  expiresOn: string | null;
  category: Category;
  notes: string;
  rawText: string;
  confidence: number;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const DATE_HINT =
  /\b(best\s*before|use\s*by|exp(?:iry|ires)?|bb|ub|best\s*bef)\b/i;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(y: number, m: number, d: number): string | null {
  if (y < 2000) y += y < 70 ? 2000 : 1900;
  if (y < 2020 || y > 2045) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** End of month when only month/year is printed. */
function endOfMonth(y: number, m: number): string | null {
  if (y < 2000) y += y < 70 ? 2000 : 1900;
  if (y < 2020 || y > 2045 || m < 1 || m > 12) return null;
  const d = new Date(y, m, 0).getDate();
  return toISO(y, m, d);
}

type DateHit = { iso: string; score: number; index: number };

function collectDates(text: string): DateHit[] {
  const hits: DateHit[] = [];
  const lower = text.toLowerCase();

  const push = (iso: string | null, index: number, bonus = 0) => {
    if (!iso) return;
    const nearHint = DATE_HINT.test(
      text.slice(Math.max(0, index - 40), index + 40),
    );
    hits.push({ iso, index, score: bonus + (nearHint ? 5 : 0) });
  };

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  for (const m of text.matchAll(
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g,
  )) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    // Prefer UK day-first; if day>12 swap interpretation fails as invalid
    push(toISO(y, mo, d), m.index ?? 0, 3);
  }

  // YYYY-MM-DD
  for (const m of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    push(toISO(Number(m[1]), Number(m[2]), Number(m[3])), m.index ?? 0, 4);
  }

  // MM/YYYY or MM-YYYY (common on meds / cosmetics)
  for (const m of text.matchAll(/\b(\d{1,2})[\/.\-](20\d{2})\b/g)) {
    push(endOfMonth(Number(m[2]), Number(m[1])), m.index ?? 0, 2);
  }

  // 12 JAN 2026 / 12 January 26
  for (const m of text.matchAll(
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/g,
  )) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) continue;
    push(toISO(Number(m[3]), mo, Number(m[1])), m.index ?? 0, 4);
  }

  // JAN 2026
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(20\d{2})\b/g)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (!mo) continue;
    push(endOfMonth(Number(m[2]), mo), m.index ?? 0, 2);
  }

  // Prefer dates near "best before" / in the future / soonest future
  const today = todayISO();
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aFuture = a.iso >= today ? 1 : 0;
    const bFuture = b.iso >= today ? 1 : 0;
    if (bFuture !== aFuture) return bFuture - aFuture;
    return a.iso.localeCompare(b.iso);
  });

  // Deduplicate by iso
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.iso)) return false;
    seen.add(h.iso);
    return true;
  });
}

const NOISE =
  /^(best|before|use|by|exp|expiry|expires|keep|refrigerat|ingredients|nutrition|net|wt|weight|barcode|www\.|http|tel|lot|batch|store|cool|dry|place|once|opened|consume|within|days|pack|packed|distributed|manufactur)/i;

function guessName(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/[^\w\s'&\-./%]/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3 && l.length <= 48)
    .filter((l) => !/^\d+([.,]\d+)?%?$/.test(l))
    .filter((l) => !DATE_HINT.test(l))
    .filter((l) => !NOISE.test(l))
    .filter((l) => /[A-Za-z]{2}/.test(l))
    .filter((l) => !/\b(20\d{2})\b/.test(l) || /[A-Za-z]{4,}/.test(l));

  if (!lines.length) return "";
  // Prefer title-ish lines (mixed case / short product names)
  const scored = lines.map((line, i) => {
    let score = 10 - Math.min(i, 8);
    if (/^[A-Z][a-z]/.test(line)) score += 2;
    if (line.split(" ").length <= 5) score += 2;
    if (/\d/.test(line) && line.split(" ").length === 1) score -= 3;
    return { line, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.line ?? "";
}

function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (
    /\b(tablet|capsule|syrup|pharmacy|ibuprofen|paracetamol|antibiotic|medicine|medication|ointment|drops)\b/.test(
      t,
    )
  ) {
    return "medicine";
  }
  if (
    /\b(passport|visa|licence|license|insurance|certificate|document|id card)\b/.test(
      t,
    )
  ) {
    return "docs";
  }
  if (
    /\b(battery|filter|bulb|detergent|cleaner|shampoo|toothpaste|contact lens|solution)\b/.test(
      t,
    )
  ) {
    return "home";
  }
  if (
    /\b(milk|yogurt|yoghurt|cheese|juice|bread|meat|fish|egg|butter|cream|fruit|veg|sauce|soup|chicken|beef|salmon|ham)\b/.test(
      t,
    )
  ) {
    return "food";
  }
  return "food";
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", 1, {
        // Keep logs quiet in production UI
        logger: () => undefined,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export function parseLabelText(rawText: string, confidence = 0): ScanResult {
  const dates = collectDates(rawText);
  const name = guessName(rawText);
  const category = guessCategory(rawText);
  const expiresOn = dates[0]?.iso ?? null;

  const notesParts = ["Scanned from label"];
  if (dates.length > 1) {
    notesParts.push(
      `Other dates seen: ${dates
        .slice(1, 3)
        .map((d) => d.iso)
        .join(", ")}`,
    );
  }

  return {
    name,
    expiresOn,
    category,
    notes: notesParts.join(". "),
    rawText,
    confidence,
  };
}

export async function scanLabelImage(
  source: File | Blob | string,
  onProgress?: (pct: number) => void,
): Promise<ScanResult> {
  onProgress?.(5);
  const worker = await getWorker();
  onProgress?.(15);

  const result = await worker.recognize(source);
  onProgress?.(90);

  const parsed = parseLabelText(result.data.text || "", result.data.confidence ?? 0);
  onProgress?.(100);
  return parsed;
}

/** Downscale large phone photos so OCR stays snappy. */
export async function prepareImageForScan(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 900_000) return file;

  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/jpeg",
      0.85,
    );
  });
}
