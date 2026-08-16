export type ViewedItem = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  mrp: number;
};

const KEY = "staple.recently-viewed";

export function trackRecentlyViewed(item: ViewedItem): void {
  try {
    const list = readRecentlyViewed();
    const next = [item, ...list.filter((v) => v.id !== item.id)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — ignore
  }
}

export function readRecentlyViewed(): ViewedItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as ViewedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
