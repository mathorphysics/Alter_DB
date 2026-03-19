/**
 * SemiResearch Alt-Data API client
 * Mirrors the openbb.js pattern: thin fetch wrappers, no business logic.
 */

const BASE = (import.meta.env.VITE_ALTDATA_BASE ?? '') + '/alt-data/v1';

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

/** Korea HS-848620 equipment inflow from Netherlands & USA (UN Comtrade). */
export async function fetchKoreaEquipmentInflow() {
  return request('/samsung/korea-equipment-inflow');
}

/** Japan → Korea semiconductor materials: silicon wafers + photoresist (UN Comtrade). */
export async function fetchJapanKoreaMaterials() {
  return request('/samsung/japan-korea-materials');
}

/** Netherlands → Oregon HS-848620 equipment imports (US Census statehs). Proxy for ASML → Intel D1X deliveries. */
export async function fetchIntelOregonEquipment() {
  return request('/intel/oregon-equipment-inflow');
}
