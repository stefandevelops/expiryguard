export type Category = "food" | "medicine" | "docs" | "home" | "other";

export type ExpiryItem = {
  id: string;
  name: string;
  category: Category;
  /** ISO date YYYY-MM-DD — the day it becomes unsafe / invalid */
  expiresOn: string;
  notes: string;
  createdAt: string;
};

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "medicine", label: "Medicine" },
  { id: "docs", label: "Documents" },
  { id: "home", label: "Home" },
  { id: "other", label: "Other" },
];

export type Urgency = "expired" | "today" | "week" | "later";

export type RankedItem = ExpiryItem & {
  daysLeft: number;
  urgency: Urgency;
};

export function uid(prefix = "i") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Local calendar day as YYYY-MM-DD */
export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from today to expiresOn (negative = already expired). */
export function daysUntil(expiresOn: string, from = new Date()) {
  const start = parseISODate(todayISO(from));
  const end = parseISODate(expiresOn);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft < 0) return "expired";
  if (daysLeft === 0) return "today";
  if (daysLeft <= 7) return "week";
  return "later";
}

export function rankItems(items: ExpiryItem[]): RankedItem[] {
  return items
    .map((item) => {
      const daysLeft = daysUntil(item.expiresOn);
      return { ...item, daysLeft, urgency: urgencyFor(daysLeft) };
    })
    .sort((a, b) => {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      return a.name.localeCompare(b.name);
    });
}

export function formatDaysLeft(daysLeft: number) {
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return n === 1 ? "Expired yesterday" : `Expired ${n} days ago`;
  }
  if (daysLeft === 0) return "Expires today";
  if (daysLeft === 1) return "Expires tomorrow";
  if (daysLeft <= 7) return `${daysLeft} days left`;
  if (daysLeft <= 30) return `${daysLeft} days left`;
  const months = Math.round(daysLeft / 30);
  return months === 1 ? "~1 month left" : `~${months} months left`;
}

export function addDaysISO(iso: string, days: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function demoItems(): ExpiryItem[] {
  const t = todayISO();
  return [
    {
      id: uid(),
      name: "Greek yogurt",
      category: "food",
      expiresOn: addDaysISO(t, 2),
      notes: "Opened yesterday — finish this week",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Allergy tablets",
      category: "medicine",
      expiresOn: addDaysISO(t, -3),
      notes: "Replace before hay-fever season",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Passport",
      category: "docs",
      expiresOn: addDaysISO(t, 45),
      notes: "Renewal takes ~6 weeks",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Contact lens solution",
      category: "home",
      expiresOn: addDaysISO(t, 0),
      notes: "Discard 90 days after opening",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Gift card — bookstore",
      category: "other",
      expiresOn: addDaysISO(t, 12),
      notes: "€25 balance",
      createdAt: new Date().toISOString(),
    },
  ];
}

export function categoryLabel(id: Category) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
