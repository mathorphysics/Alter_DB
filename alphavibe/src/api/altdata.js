/**
 * SemiResearch Alt-Data API client
 * Mirrors the openbb.js pattern: thin fetch wrappers, no business logic.
 */

const BASE = '/alt-data/v1';

async function request(path) {
  const res = await fetch(BASE + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/** Taiwan HS-8486 equipment import monthly series (default 60 months). */
export async function fetchEquipmentImports(months = 60) {
  return request(`/tsmc/equipment-imports?months=${months}`);
}

/** Taiwan HS-8486 equipment import + export combined monthly series. */
export async function fetchEquipmentTrade() {
  return request('/tsmc/equipment-trade');
}
