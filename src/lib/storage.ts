import { demoItems, type ExpiryItem } from "@/lib/items";

const KEY = "expiryguard-v1";

export type Store = {
  items: ExpiryItem[];
  notifyDays: number;
};

export function loadStore(): Store {
  if (typeof window === "undefined") {
    return { items: demoItems(), notifyDays: 3 };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const store = { items: demoItems(), notifyDays: 3 };
      localStorage.setItem(KEY, JSON.stringify(store));
      return store;
    }
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : demoItems(),
      notifyDays:
        typeof parsed.notifyDays === "number" ? parsed.notifyDays : 3,
    };
  } catch {
    return { items: demoItems(), notifyDays: 3 };
  }
}

export function saveStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function resetStore() {
  const store = { items: demoItems(), notifyDays: 3 };
  saveStore(store);
  return store;
}
