export type SplitAddress = { line1: string; city: string; state: string; zip: string };

const FULL_ADDRESS = /^(.+?),\s*([^,\d]+?),\s*([A-Za-z]{2})\.?\s+(\d{5})(?:-\d{4})?(?:\s*,.*)?$/;

export function splitFullAddress(value: string): SplitAddress | null {
  const match = FULL_ADDRESS.exec(value.trim().replace(/\s+/g, " "));
  if (!match) return null;
  const [, line1, city, state, zip] = match;
  if (!/\d/.test(line1)) return null;
  return { line1: line1.trim(), city: city.trim(), state: state.toUpperCase(), zip };
}
