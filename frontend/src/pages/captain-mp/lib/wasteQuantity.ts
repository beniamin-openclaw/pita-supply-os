export type WasteUnit = string;

// Curated display grams are whole; master base units use exact thousandths.
export function parseWasteQuantity(raw: string, unit: WasteUnit, baseUnit = false): number | null {
  const value = raw.trim();
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(value);
  if (!match || (unit === "g" && !baseUnit && match[2])) return null;
  if (match[1].length > (unit === "g" && !baseUnit ? 9 : 6)) return null;
  const integer = match[1].replace(/^0+/, "") || "0";
  const scaled = unit === "g" && !baseUnit
    ? Number(integer)
    : Number(integer) * 1000 + Number((match[2] || "").padEnd(3, "0"));
  return Number.isSafeInteger(scaled) && scaled <= 999999999 ? scaled : null;
}

export function addWasteQuantity(raw: string, addition: string, unit: WasteUnit, baseUnit = false): string | null {
  const current = raw.trim() ? parseWasteQuantity(raw, unit, baseUnit) : 0;
  const increment = parseWasteQuantity(addition, unit, baseUnit);
  if (current === null || increment === null) return null;
  const sum = current + increment;
  if (!Number.isSafeInteger(sum) || sum > 999999999) return null;
  if (unit === "g" && !baseUnit) return String(sum);
  const whole = Math.floor(sum / 1000);
  const fraction = String(sum % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}
