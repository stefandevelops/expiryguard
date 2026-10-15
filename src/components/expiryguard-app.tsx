"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  addDaysISO,
  categoryLabel,
  formatDaysLeft,
  rankItems,
  todayISO,
  uid,
  type Category,
  type ExpiryItem,
  type Urgency,
} from "@/lib/items";
import { CameraScan } from "@/components/camera-scan";
import { ensureNotificationPermission, nudgeExpiring } from "@/lib/notify";
import type { ScanResult } from "@/lib/scan";
import { loadStore, resetStore, saveStore } from "@/lib/storage";

const URGENCY_META: Record<
  Urgency,
  { label: string; className: string; chip: string }
> = {
  expired: {
    label: "Expired",
    className: "border-red-700/30 bg-red-50 text-red-950",
    chip: "bg-red-700 text-white",
  },
  today: {
    label: "Today",
    className: "border-amber-600/35 bg-amber-50 text-amber-950",
    chip: "bg-amber-600 text-white",
  },
  week: {
    label: "This week",
    className: "border-sky-700/25 bg-sky-50 text-sky-950",
    chip: "bg-sky-800 text-white",
  },
  later: {
    label: "Later",
    className: "border-[var(--line)] bg-white text-[var(--ink)]",
    chip: "bg-[var(--ink)]/80 text-white",
  },
};

type Filter = "all" | Urgency | Category;

export function ExpiryGuardApp() {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [notifyDays, setNotifyDays] = useState(3);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [notifyStatus, setNotifyStatus] = useState<string>("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "food" as Category,
    expiresOn: addDaysISO(todayISO(), 7),
    notes: "",
    openedMode: false,
    shelfDays: "7",
  });

  useEffect(() => {
    const store = loadStore();
    setItems(store.items);
    setNotifyDays(store.notifyDays);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveStore({ items, notifyDays });
  }, [items, notifyDays, ready]);

  const ranked = useMemo(() => rankItems(items), [items]);

  const counts = useMemo(() => {
    const c = { expired: 0, today: 0, week: 0, later: 0 };
    for (const item of ranked) c[item.urgency] += 1;
    return c;
  }, [ranked]);

  const visible = useMemo(() => {
    if (filter === "all") return ranked;
    if (
      filter === "expired" ||
      filter === "today" ||
      filter === "week" ||
      filter === "later"
    ) {
      return ranked.filter((i) => i.urgency === filter);
    }
    return ranked.filter((i) => i.category === filter);
  }, [ranked, filter]);

  useEffect(() => {
    if (!ready) return;
    nudgeExpiring(ranked, notifyDays);
  }, [ranked, notifyDays, ready]);

  function applyScan(result: ScanResult) {
    setForm((f) => ({
      ...f,
      name: result.name || f.name,
      category: result.category,
      expiresOn: result.expiresOn || f.expiresOn,
      notes: result.notes || f.notes,
      openedMode: false,
    }));
    setFormError("");
    // Scroll add form into view on phone after scan fills fields
    document.getElementById("add-item-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("Give it a name — e.g. “oat milk” or “passport”.");
      return;
    }
    let expiresOn = form.expiresOn;
    if (form.openedMode) {
      const shelf = Number(form.shelfDays);
      if (!Number.isFinite(shelf) || shelf < 1) {
        setFormError("Shelf life must be at least 1 day.");
        return;
      }
      expiresOn = addDaysISO(todayISO(), Math.floor(shelf));
    }
    if (!expiresOn) {
      setFormError("Pick an expiry date.");
      return;
    }
    const item: ExpiryItem = {
      id: uid(),
      name,
      category: form.category,
      expiresOn,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [item, ...prev]);
    setForm((f) => ({
      ...f,
      name: "",
      notes: "",
      expiresOn: addDaysISO(todayISO(), 7),
      openedMode: false,
      shelfDays: "7",
    }));
    setFormError("");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function bumpExpiry(id: string, days: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, expiresOn: addDaysISO(i.expiresOn, days) } : i,
      ),
    );
  }

  async function enableNotifications() {
    const perm = await ensureNotificationPermission();
    if (perm === "unsupported") {
      setNotifyStatus("This browser doesn’t support notifications.");
      return;
    }
    if (perm === "denied") {
      setNotifyStatus("Notifications blocked — enable them in browser settings.");
      return;
    }
    setNotifyStatus("Notifications on — you’ll get a nudge for soon-to-expire items.");
    nudgeExpiring(ranked, notifyDays);
  }

  function loadDemo() {
    const store = resetStore();
    setItems(store.items);
    setNotifyDays(store.notifyDays);
    setFilter("all");
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-full max-w-5xl items-center justify-center px-4 py-16">
        <p className="text-[var(--muted)]">Loading your pantry…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          ExpiryGuard
        </p>
        <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          Catch what expires before it becomes trash — or a wasted trip
        </h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Food, medicine, documents, gift cards. Snap the label with your phone
          camera — on-device OCR fills the name and best-before. Everything stays
          in this browser — no account, nothing uploaded.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["expired", counts.expired],
            ["today", counts.today],
            ["week", counts.week],
            ["later", counts.later],
          ] as const
        ).map(([key, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              filter === key
                ? URGENCY_META[key].className + " ring-2 ring-[var(--accent)]/30"
                : "border-[var(--line)] bg-white/70"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.14em] opacity-70">
              {URGENCY_META[key].label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
              {count}
            </p>
          </button>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl">
                Your list
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {visible.length} shown · sorted by soonest expiry
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
              >
                <option value="all">All items</option>
                <optgroup label="Urgency">
                  <option value="expired">Expired</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="later">Later</option>
                </optgroup>
                <optgroup label="Category">
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button
                type="button"
                onClick={loadDemo}
                className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                Reset demo
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-6 rounded-xl bg-[var(--bg)] px-4 py-10 text-center">
              <p className="font-[family-name:var(--font-display)] text-xl">
                Nothing in this filter
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Add something on the right, or switch the filter back to All.
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {visible.map((item) => {
                const meta = URGENCY_META[item.urgency];
                return (
                  <li
                    key={item.id}
                    className={`rounded-2xl border px-4 py-4 ${meta.className}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-[family-name:var(--font-display)] text-lg">
                            {item.name}
                          </h3>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${meta.chip}`}
                          >
                            {formatDaysLeft(item.daysLeft)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm opacity-80">
                          {categoryLabel(item.category)} · expires{" "}
                          {item.expiresOn}
                        </p>
                        {item.notes ? (
                          <p className="mt-2 text-sm opacity-75">{item.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => bumpExpiry(item.id, 7)}
                          className="rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs"
                        >
                          +7 days
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs"
                        >
                          Used / remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-5">
          <CameraScan onResult={applyScan} />

          <form
            id="add-item-form"
            onSubmit={addItem}
            className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Add something
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Scan a label above, or type the printed date / “opened today + lasts X days”.
            </p>

            <label className="mt-4 block text-sm font-medium">
              Name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Almond milk"
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
              />
            </label>

            <label className="mt-3 block text-sm font-medium">
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as Category,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.openedMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, openedMode: e.target.checked }))
                }
                className="size-4 rounded border-[var(--line)]"
              />
              Opened today — set shelf life instead of a printed date
            </label>

            {form.openedMode ? (
              <label className="mt-3 block text-sm font-medium">
                Good for (days)
                <input
                  type="number"
                  min={1}
                  value={form.shelfDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shelfDays: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
                />
              </label>
            ) : (
              <label className="mt-3 block text-sm font-medium">
                Expires on
                <input
                  type="date"
                  value={form.expiresOn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiresOn: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
                />
              </label>
            )}

            <label className="mt-3 block text-sm font-medium">
              Notes{" "}
              <span className="font-normal text-[var(--muted)]">(optional)</span>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                placeholder="Fridge door · top shelf"
                className="mt-1.5 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
              />
            </label>

            {formError ? (
              <p className="mt-3 text-sm text-red-700">{formError}</p>
            ) : null}

            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 font-medium text-white"
            >
              Add to list
            </button>
          </form>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--ink)] p-5 text-white">
            <h2 className="font-[family-name:var(--font-display)] text-lg">
              Reminders
            </h2>
            <p className="mt-2 text-sm text-white/75">
              Optional browser notifications when something is within your
              warning window. Still works offline in this tab either way.
            </p>
            <label className="mt-4 block text-sm">
              Warn me within (days)
              <input
                type="number"
                min={0}
                max={30}
                value={notifyDays}
                onChange={(e) => setNotifyDays(Number(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void enableNotifications()}
              className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)]"
            >
              Enable notifications
            </button>
            {notifyStatus ? (
              <p className="mt-3 text-xs text-white/65">{notifyStatus}</p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
