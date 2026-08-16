const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function inr(amount: number): string {
  return inrFormatter.format(amount);
}

export function discountPct(price: number, mrp: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function deliveryEta(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Quick-commerce pack label — explicit unit, else parsed from the name. */
export function unitLabel(name: string, unit?: string): string {
  if (unit) return unit;
  const emDash = name.split("—");
  if (emDash.length > 1) return emDash[emDash.length - 1].trim();
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  return "";
}

/** Deterministic delivery estimate (1–5 days) for a pincode + product id. */
export function pincodeEta(pincode: string, seed: string): number {
  let hash = 0;
  for (let i = 0; i < pincode.length; i++) {
    hash = (hash * 31 + pincode.charCodeAt(i)) % 100000;
  }
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 17 + seed.charCodeAt(i)) % 100000;
  }
  return 1 + (hash % 5);
}
