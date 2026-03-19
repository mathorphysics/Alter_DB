/**
 * timeSeries.js — Multi-granularity time series normalization utilities
 *
 * Handles mixed date formats (YYYY-MM-DD, YYYY-MM, YYYY-Qn, YYYY) and
 * merges sparse alt-data onto a continuous stock-price date backbone.
 */

const QUARTER_END = { '1': '03-31', '2': '06-30', '3': '09-30', '4': '12-31' };

/**
 * Normalize any date string → YYYY-MM-DD.
 *
 *   "2024-Q1"    → "2024-03-31"
 *   "2024-01"    → "2024-01-31"
 *   "2024"       → "2024-12-31"
 *   "2024-01-15" → "2024-01-15"
 */
export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // YYYY-Qn
  const qm = s.match(/^(\d{4})-Q([1-4])$/i);
  if (qm) return `${qm[1]}-${QUARTER_END[qm[2]]}`;

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${s}-${String(lastDay).padStart(2, '0')}`;
  }

  // YYYY
  if (/^\d{4}$/.test(s)) return `${s}-12-31`;

  // Already YYYY-MM-DD (or ISO with time — strip time)
  return s.slice(0, 10);
}

/**
 * Snap an alt-data date to the nearest available stock trading day
 * (the first trading day on or after `targetDate`).
 * Falls back to the last available trading day if target is beyond the range.
 *
 * @param {string}   targetDate  YYYY-MM-DD
 * @param {string[]} stockDates  sorted ascending list of trading-day strings
 * @returns {string|null}
 */
function snapToTradingDay(targetDate, stockDates) {
  const match = stockDates.find((d) => d >= targetDate);
  return match ?? stockDates[stockDates.length - 1] ?? null;
}

/**
 * Merge stock prices and one or more alt-data series into a single array
 * keyed by trading date.
 *
 * Alt-data points are "snapped" to the nearest trading day — they appear as
 * a bar/scatter value on that specific day (not forward-filled), so the chart
 * is honest about when each data point was recorded.
 *
 * @param {Array<{date:string, close:number}>} stockData
 *   Daily price rows — must have `.date` (YYYY-MM-DD) and `.close`.
 *
 * @param {Array<{key:string, points:Array<{date:string, value:number|null}>}>} altSeries
 *   Each alt series has a unique `key` and `points` array.
 *   Dates in `points` may be any supported format (normalizeDate is applied internally).
 *
 * @returns {Array<object>} merged rows suitable for recharts ComposedChart.
 */
export function mergeTimeSeries(stockData, altSeries) {
  if (!stockData?.length) return [];

  // Build stock map: date → close
  const stockMap = new Map(stockData.map((r) => [r.date.slice(0, 10), r.close]));
  const stockDates = [...stockMap.keys()].sort();

  // Start with stock backbone
  const rows = stockDates.map((date) => ({ date, price: stockMap.get(date) }));
  const rowMap = new Map(rows.map((r) => [r.date, r]));

  // Merge each alt series
  for (const { key, points } of altSeries) {
    // Initialize all rows with null for this series
    rows.forEach((r) => { r[key] = null; });

    for (const pt of points) {
      if (pt.value == null) continue;
      const normalized = normalizeDate(pt.date);
      if (!normalized) continue;
      const snapped = snapToTradingDay(normalized, stockDates);
      if (!snapped) continue;
      const row = rowMap.get(snapped);
      if (row) {
        // Keep the larger value if multiple alt points snap to the same day
        row[key] = row[key] == null ? pt.value : Math.max(row[key], pt.value);
        // Carry extra metadata (flagged, etc.)
        if (pt.flagged != null) row[`${key}_flagged`] = pt.flagged;
      }
    }
  }

  return rows;
}

/**
 * Compute a sensible X-axis tick interval so recharts shows ~N labels
 * regardless of how many data points are in the series.
 */
export function xTickInterval(totalPoints, targetLabels = 10) {
  if (totalPoints <= targetLabels) return 0;
  return Math.ceil(totalPoints / targetLabels) - 1;
}

/**
 * Date range helpers — return YYYY-MM-DD strings.
 */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
