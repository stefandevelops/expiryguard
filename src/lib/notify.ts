import type { RankedItem } from "@/lib/items";

const SEEN_KEY = "expiryguard-notified-v1";

function loadSeen(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) || "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function saveSeen(map: Record<string, string>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify(map));
}

export async function ensureNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/** Fire once per item+urgency band per browser session. */
export function nudgeExpiring(items: RankedItem[], withinDays: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const seen = loadSeen();
  const due = items.filter(
    (i) => i.daysLeft <= withinDays && i.urgency !== "later",
  );

  for (const item of due.slice(0, 3)) {
    const key = `${item.id}:${item.urgency}`;
    if (seen[key]) continue;
    seen[key] = new Date().toISOString();
    const body =
      item.daysLeft < 0
        ? `${item.name} already expired — toss or renew.`
        : item.daysLeft === 0
          ? `${item.name} expires today.`
          : `${item.name} expires in ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}.`;
    try {
      new Notification("ExpiryGuard", { body, tag: key });
    } catch {
      // ignore
    }
  }
  saveSeen(seen);
}
