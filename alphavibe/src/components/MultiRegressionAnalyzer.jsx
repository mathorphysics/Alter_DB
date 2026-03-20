/**
 * MultiRegressionAnalyzer
 * ─────────────────────────────────────────────────────────────────────────────
 * Discovers hidden links between alternative data signals (X₁…Xₖ) and a
 * stock's daily close price (Y) using Ordinary Least Squares regression,
 * powered by ml-regression-multivariate-linear.
 *
 * Key design decisions:
 *   • Any alt-data signal from the backend catalog can be an X feature.
 *   • Y is always the daily close price of a user-selected ticker.
 *   • Time-series alignment uses forward-fill so monthly/quarterly signals
 *     are matched to each trading day (see alignDataMatrix below).
 *   • The Actual vs. Predicted scatter chart reduces multi-dimensional data
 *     to 2-D; a dashed y = x diagonal shows perfect-prediction quality.
 */

import { useState, useRef, useEffect } from 'react';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';
import {
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Activity, Play, TrendingUp, ChevronDown } from 'lucide-react';

import { fetchHistoricalPrice } from '../api/openbb';
import {
  fetchIntelOregonEquipment,
  fetchIntelChipsFunding,
  fetchTsmcRevenue,
  fetchTaiwanEquipmentImports,
  fetchEquipmentTrade,
  fetchKoreaEquipmentInflow,
  fetchJapanKoreaMaterials,
  fetchFredMacro,
} from '../api/altdata';
import { normalizeDate, daysAgo, today } from '../utils/timeSeries';

// ── Palette ───────────────────────────────────────────────────────────────────

const ACCENT      = '#e7cd79';  // gold
const ACCENT2     = '#467897';  // blue
const SERIES_COLORS = ['#a78bfa', '#34d399', '#467897', '#fb923c', '#f87171', '#38bdf8'];

// ── Ticker list (Y selector) ──────────────────────────────────────────────────

const TICKERS = [
  { value: 'TSM',       label: 'TSMC',            group: 'Frontend' },
  { value: 'INTC',      label: 'Intel',           group: 'Frontend' },
  { value: '005930.KS', label: 'Samsung',         group: 'Frontend' },
  { value: 'NVDA',      label: 'Nvidia',          group: 'Designer' },
  { value: 'AMD',       label: 'AMD',             group: 'Designer' },
  { value: 'ASML',      label: 'ASML',            group: 'Supplier' },
  { value: 'AMAT',      label: 'Applied Matl.',   group: 'Supplier' },
  { value: 'LRCX',      label: 'Lam Research',    group: 'Supplier' },
  { value: 'KLAC',      label: 'KLA',             group: 'Inspection' },
  { value: 'AMKR',      label: 'Amkor',           group: 'OSAT' },
];

// ── Alt-data feature catalog (X selectors) ────────────────────────────────────
//
// Each entry mirrors the shape in AltDataOverlayChart's ALT_CATALOG.
// Two entries that share the same `fetch` function will be deduplicated
// at request time — the raw response is cached and re-extracted for each key.

const X_CATALOG = [
  // ── Intel ──────────────────────────────────────────────────────────────────
  {
    key:     'intel-oregon',
    label:   'ASML Equip. Imports (OR)',
    unit:    'USD M',
    color:   SERIES_COLORS[0],
    fetch:   fetchIntelOregonEquipment,
    extract: (r) => (r.results ?? []).map((p) => ({ date: p.period, value: p.value })),
  },
  {
    key:     'intel-dod',
    label:   'DoD Federal Contracts',
    unit:    'USD M',
    color:   SERIES_COLORS[2],
    fetch:   fetchIntelChipsFunding,
    extract: (r) => (r.live_awards ?? []).map((a) => ({
      date: a.action_date,
      value: +(a.amount_usd / 1e6).toFixed(2),
    })),
  },

  // ── TSMC ───────────────────────────────────────────────────────────────────
  {
    key:     'tsmc-revenue',
    label:   'TSMC Monthly Revenue',
    unit:    'NT$B',
    color:   SERIES_COLORS[1],
    fetch:   fetchTsmcRevenue,
    extract: (r) => (r.results ?? []).map((p) => ({ date: p.date, value: +(p.revenue / 1000).toFixed(1) })),
  },
  {
    key:     'tw-equipment',
    label:   'Taiwan Equip. Imports (HS-8486)',
    unit:    'USD M',
    color:   SERIES_COLORS[3],
    fetch:   fetchTaiwanEquipmentImports,
    extract: (r) => (r.results ?? []).map((p) => ({ date: p.date, value: p.value })),
  },
  {
    key:     'tw-equipment-export',
    label:   'Taiwan Equip. Exports (HS-8486)',
    unit:    'USD M',
    color:   SERIES_COLORS[5],
    fetch:   fetchEquipmentTrade,
    extract: (r) => (r.exports ?? []).map((p) => ({ date: p.date, value: p.value })),
  },

  // ── Samsung ────────────────────────────────────────────────────────────────
  {
    key:     'korea-nl',
    label:   'Korea Equip. Inflow (NL→KR)',
    unit:    'USD M',
    color:   SERIES_COLORS[2],
    fetch:   fetchKoreaEquipmentInflow,
    extract: (r) => (r.results ?? []).map((p) => ({ date: p.period, value: p.Netherlands ?? 0 })),
  },
  {
    key:     'korea-usa',
    label:   'Korea Equip. Inflow (US→KR)',
    unit:    'USD M',
    color:   SERIES_COLORS[5],
    fetch:   fetchKoreaEquipmentInflow,
    extract: (r) => (r.results ?? []).map((p) => ({ date: p.period, value: p.USA ?? 0 })),
  },
  {
    key:     'japan-materials',
    label:   'Japan→KR Materials (Si+PR)',
    unit:    'USD M',
    color:   SERIES_COLORS[4],
    fetch:   fetchJapanKoreaMaterials,
    extract: (r) => (r.results ?? []).map((p) => ({
      date:  p.period,
      value: (p.SiliconWafers ?? 0) + (p.Photoresist ?? 0),
    })),
  },

  // ── FRED Macro ─────────────────────────────────────────────────────────────
  {
    key:     'fred-capacity',
    label:   'Semicon. Capacity Utilization',
    unit:    '%',
    color:   ACCENT,
    fetch:   fetchFredMacro,
    extract: (r) => (r.capacity_utilization?.observations ?? []).map((p) => ({ date: p.date, value: p.value })),
  },
  {
    key:     'fred-ip',
    label:   'Industrial Production Index',
    unit:    'Idx',
    color:   SERIES_COLORS[1],
    fetch:   fetchFredMacro,
    extract: (r) => (r.industrial_production?.observations ?? []).map((p) => ({ date: p.date, value: p.value })),
  },
  {
    key:     'fred-durables',
    label:   'Durable Goods New Orders',
    unit:    '$B',
    color:   SERIES_COLORS[0],
    fetch:   fetchFredMacro,
    extract: (r) => (r.durable_goods_orders?.observations ?? []).map((p) => ({
      date:  p.date,
      value: +(p.value / 1000).toFixed(1),
    })),
  },
];

// ── Time ranges ───────────────────────────────────────────────────────────────

const RANGES = [
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '3Y', days: 1095 },
];

// ── alignDataMatrix ───────────────────────────────────────────────────────────
/**
 * Aligns multiple X time series onto Y's date backbone via forward-fill
 * (Last Observation Carried Forward — LOCF).
 *
 * Problem: alt-data signals are published monthly or quarterly while stock
 * prices are daily. To build a regression matrix we need every feature to
 * have a value on every trading day.
 *
 * Algorithm per X series:
 *   1. Normalize all raw date strings to YYYY-MM-DD (handles YYYY-MM, YYYY-Qn, etc.)
 *   2. Sort observations ascending by date.
 *   3. For each Y trading day, scan the sorted X series and carry forward the
 *      most recent observation whose date is ≤ the trading day.
 *   4. Drop Y rows where at least one X feature has no prior observation
 *      (i.e., the trading day predates the first known X reading).
 *
 * @param {Array<{date: string, value: number}>} yPoints  Daily stock close prices.
 * @param {Array<{key: string, points: Array<{date: string, value: number}>}>} xSeries
 * @returns {{ X: number[][], Y: number[], dates: string[], xKeys: string[] } | null}
 */
function alignDataMatrix(yPoints, xSeries) {
  if (!yPoints.length || !xSeries.length) return null;

  // Normalize Y dates and sort ascending
  const yNorm = yPoints
    .map((p) => ({ date: normalizeDate(p.date), value: p.value }))
    .filter((p) => p.date && p.value != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build a forward-fill lookup function for each X series
  const xLookups = xSeries.map(({ key, points }) => {
    const sorted = points
      .map((p) => ({ date: normalizeDate(p.date), value: p.value }))
      .filter((p) => p.date && p.value != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Return most recent X value whose date ≤ targetDate, or null if none exists yet
    function forwardFill(targetDate) {
      let best = null;
      for (const p of sorted) {
        if (p.date <= targetDate) best = p.value;
        else break;
      }
      return best;
    }

    return { key, forwardFill };
  });

  // Build aligned matrix — only include rows where every X is known
  const rows = [];
  for (const yPt of yNorm) {
    const xVals = xLookups.map((lk) => lk.forwardFill(yPt.date));
    if (xVals.every((v) => v != null)) {
      rows.push({ date: yPt.date, y: yPt.value, x: xVals });
    }
  }

  // Need at least (k + 2) observations to fit k features + intercept
  if (rows.length < xSeries.length + 2) return null;

  return {
    X:     rows.map((r) => r.x),
    Y:     rows.map((r) => r.y),
    dates: rows.map((r) => r.date),
    xKeys: xSeries.map((s) => s.key),
  };
}

// ── R² quality helpers ────────────────────────────────────────────────────────

function r2Color(r2) {
  if (r2 >= 0.7) return '#34d399';
  if (r2 >= 0.4) return ACCENT;
  if (r2 >= 0.2) return '#fb923c';
  return '#f87171';
}

function r2Label(r2) {
  if (r2 >= 0.7) return 'Strong';
  if (r2 >= 0.4) return 'Moderate';
  if (r2 >= 0.2) return 'Weak';
  return 'Very Weak';
}

// ── Custom scatter tooltip ────────────────────────────────────────────────────

function RegressionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { predicted, actual } = payload[0]?.payload ?? {};
  const residual = actual != null && predicted != null ? actual - predicted : null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 shadow-xl text-xs min-w-[148px]">
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-[var(--sub)]">Actual</span>
        <span className="font-mono font-semibold text-[var(--fg)]">{actual?.toFixed(2)}</span>
      </div>
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-[var(--sub)]">Predicted</span>
        <span className="font-mono font-semibold" style={{ color: ACCENT2 }}>{predicted?.toFixed(2)}</span>
      </div>
      {residual != null && (
        <div className="flex justify-between gap-4 pt-1.5 mt-1 border-t border-[var(--border)]">
          <span className="text-[var(--sub)]">Residual</span>
          <span className={`font-mono font-semibold ${residual >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
            {residual >= 0 ? '+' : ''}{residual.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Actual vs. Predicted chart ────────────────────────────────────────────────

function ActualVsPredictedChart({ data, yTicker }) {
  if (!data?.length) return null;

  const allVals = data.flatMap((d) => [d.predicted, d.actual]);
  const minVal  = Math.min(...allVals) * 0.97;
  const maxVal  = Math.max(...allVals) * 1.03;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 8, right: 20, bottom: 24, left: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />

        <XAxis
          type="number"
          dataKey="predicted"
          name="Predicted"
          domain={[minVal, maxVal]}
          tick={{ fontSize: 10, fill: 'var(--muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.toFixed(0)}
          label={{
            value: `Predicted ${yTicker} (ŷ)`,
            position: 'insideBottom',
            offset: -12,
            fontSize: 10,
            fill: 'var(--sub)',
          }}
        />

        <YAxis
          type="number"
          dataKey="actual"
          name="Actual"
          domain={[minVal, maxVal]}
          tick={{ fontSize: 10, fill: 'var(--muted)' }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => v.toFixed(0)}
          label={{
            value: `Actual ${yTicker} (y)`,
            angle: -90,
            position: 'insideLeft',
            offset: 14,
            fontSize: 10,
            fill: 'var(--sub)',
          }}
        />

        <Tooltip content={<RegressionTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border2)' }} />

        {/* y = x diagonal — perfect-prediction benchmark */}
        <ReferenceLine
          segment={[{ x: minVal, y: minVal }, { x: maxVal, y: maxVal }]}
          stroke="var(--border2)"
          strokeDasharray="6 4"
          strokeWidth={1.5}
          ifOverflow="extendDomain"
        />

        <Scatter
          data={data}
          fill={ACCENT2}
          fillOpacity={0.65}
          r={3}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiRegressionAnalyzer() {
  const [yTicker,    setYTicker]    = useState('TSM');
  const [xKeys,      setXKeys]      = useState(['tsmc-revenue', 'tw-equipment']);
  const [rangeIdx,   setRangeIdx]   = useState(1);   // default 2Y
  const [xDropOpen,  setXDropOpen]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [result,     setResult]     = useState(null);

  const dropRef = useRef(null);

  // Close X dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setXDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleX = (key) =>
    setXKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const selectedXDefs = xKeys.map((k) => X_CATALOG.find((d) => d.key === k)).filter(Boolean);

  // ── Run regression ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!yTicker || xKeys.length === 0) {
      setError('Please select at least one feature variable X and a target Y.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { days } = RANGES[rangeIdx];
      const startDate = daysAgo(days);
      const endDate   = today();

      // 1. Fetch Y — daily close prices for the chosen ticker
      let stockRows;
      try {
        stockRows = await fetchHistoricalPrice(yTicker, startDate, endDate);
      } catch (e) {
        throw new Error(`Failed to fetch price data for ${yTicker}: ${e.message}`);
      }
      if (!stockRows?.length) {
        throw new Error(`No trading data found for ${yTicker} in the selected period. Try a different ticker or a wider time range.`);
      }
      const yPoints = stockRows.map((r) => ({ date: r.date, value: r.close }));

      // 2. Fetch X — deduplicate API calls when multiple features share the same endpoint
      //    (e.g. korea-nl and korea-usa both call fetchKoreaEquipmentInflow once)
      const fetchGroupMap = new Map(); // fetch fn → [def, ...]
      for (const def of selectedXDefs) {
        if (!fetchGroupMap.has(def.fetch)) fetchGroupMap.set(def.fetch, []);
        fetchGroupMap.get(def.fetch).push(def);
      }

      const rawCache  = new Map();  // key → [{date, value}]
      const fetchErrs = [];         // collect partial failures without aborting everything
      await Promise.all(
        [...fetchGroupMap.entries()].map(async ([fn, defs]) => {
          try {
            const raw = await fn();
            for (const def of defs) {
              rawCache.set(def.key, def.extract(raw));
            }
          } catch (e) {
            const labels = defs.map((d) => d.label).join(', ');
            fetchErrs.push(`${labels} (${e.message})`);
          }
        }),
      );

      if (fetchErrs.length > 0 && fetchErrs.length === fetchGroupMap.size) {
        // Every alt-data request failed — nothing to regress on
        throw new Error(`All feature requests failed — check that the backend is reachable:\n${fetchErrs.join('\n')}`);
      }

      // Filter out features whose fetch failed so we can still run with the rest
      const validXDefs = selectedXDefs.filter((def) => rawCache.has(def.key));
      if (fetchErrs.length > 0) {
        // Non-fatal: surface as a warning embedded in the error state after results render
        console.warn('[MultiRegressionAnalyzer] Some features failed and were dropped:', fetchErrs);
      }

      const xSeries = validXDefs.map((def) => ({
        key:    def.key,
        points: rawCache.get(def.key) ?? [],
      }));

      if (xSeries.length === 0) {
        throw new Error('No valid data available for any selected feature. Check the backend or choose different features.');
      }

      // 3. Align data matrix (forward-fill X onto Y's daily backbone)
      const matrix = alignDataMatrix(yPoints, xSeries);
      if (!matrix) {
        const minObs = xSeries.length + 2;
        throw new Error(
          `Not enough aligned observations after forward-fill (need at least ${minObs} rows = features + 2).\n` +
          `Possible causes:\n` +
          `① The selected features have a much shorter history than ${yTicker} prices\n` +
          `② The time range is too narrow — try switching to 2Y or 3Y\n` +
          `③ One or more features are extremely sparse (e.g. event-driven data with very few points)`,
        );
      }

      // 4. Run OLS via ml-regression-multivariate-linear
      //    Y must be 2-D: [[y₁], [y₂], …] (single-output multivariate form)
      let mlr;
      try {
        const Y2D = matrix.Y.map((v) => [v]);
        mlr = new MultivariateLinearRegression(matrix.X, Y2D);
      } catch (e) {
        // Most common cause: perfect multicollinearity — SVD fails or weights are NaN
        throw new Error(
          `OLS matrix decomposition failed: ${e.message}\n` +
          `This is usually caused by perfect multicollinearity — two or more features are linearly dependent. Try removing one of the highly correlated features.`,
        );
      }

      // weights is a plain 2D array of shape [(k+1) × 1].
      // The intercept column is appended LAST by the library (x.addColumn at the end),
      // so the layout is:
      //   weights[0..k-1][0] → feature coefficients β₁…βₖ
      //   weights[mlr.inputs][0] → intercept β₀  (mlr.inputs === k)
      const intercept    = mlr.weights[mlr.inputs][0];
      const coefficients = validXDefs.map((_, i) => mlr.weights[i][0]);

      if (!isFinite(intercept) || coefficients.some((b) => !isFinite(b))) {
        throw new Error(
          'Regression produced non-finite coefficients (NaN / Infinity) — model failed to converge.\n' +
          'This is typically caused by perfect multicollinearity (e.g. selecting both Taiwan Equip. Imports and Exports simultaneously). Remove one of the correlated features and retry.',
        );
      }

      // 5. Compute predictions and R²
      const yPred  = matrix.X.map((row) => mlr.predict(row)[0]);
      const yMean  = matrix.Y.reduce((s, v) => s + v, 0) / matrix.Y.length;
      const SStot  = matrix.Y.reduce((s, v) => s + (v - yMean) ** 2, 0);
      const SSres  = matrix.Y.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
      const r2     = 1 - SSres / SStot;

      // 6. Pearson r between each Xᵢ and Y
      const pearsonR = matrix.X[0].map((_, col) => {
        const xs    = matrix.X.map((row) => row[col]);
        const xMean = xs.reduce((s, v) => s + v, 0) / xs.length;
        const num   = xs.reduce((s, v, i) => s + (v - xMean) * (matrix.Y[i] - yMean), 0);
        const den   = Math.sqrt(
          xs.reduce((s, v) => s + (v - xMean) ** 2, 0) * SStot,
        );
        return den === 0 ? 0 : num / den;
      });

      // 7. Build scatter data (Actual vs. Predicted)
      const scatterData = matrix.Y.map((actual, i) => ({
        predicted: +yPred[i].toFixed(4),
        actual:    +actual.toFixed(4),
      }));

      setResult({
        r2,
        intercept,
        coefficients,
        pearsonR,
        xLabels:      validXDefs.map((d) => d.label),
        xColors:      validXDefs.map((d) => d.color),
        xUnits:       validXDefs.map((d) => d.unit),
        xKeys:        validXDefs.map((d) => d.key),
        scatterData,
        nObs:         matrix.Y.length,
        partialFail:  fetchErrs.length > 0 ? fetchErrs : null,
      });
    } catch (e) {
      setError(e.message);
      console.error('[MultiRegressionAnalyzer]', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT2 + '20', border: `1px solid ${ACCENT2}40` }}
        >
          <Activity size={13} style={{ color: ACCENT2 }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--fg)]">
            Multi-Dimensional Regression Analyzer
          </h3>
          <p className="text-[11px] text-[var(--sub)]">
            Fit Y = β₀ + β₁X₁ + … + βₖXₖ — uncover hidden alt-data signals driving stock prices
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{ color: ACCENT2, borderColor: ACCENT2 + '45', background: ACCENT2 + '12' }}
          >
            OLS
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{ color: '#34d399', borderColor: '#34d39945', background: '#34d39912' }}
          >
            LIVE
          </span>
        </div>
      </div>

      {/* ── Control panel ── */}
      <div className="px-4 py-4 flex flex-wrap gap-3 items-end border-b border-[var(--border)]">

        {/* Y: target variable */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Target Variable Y
          </label>
          <select
            value={yTicker}
            onChange={(e) => { setYTicker(e.target.value); setResult(null); }}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-2 text-xs text-[var(--fg)] focus:outline-none focus:border-[var(--border2)] cursor-pointer appearance-none"
          >
            {TICKERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} ({t.value})
              </option>
            ))}
          </select>
          <div className="text-[9px] text-[var(--muted)] mt-1">Daily close price</div>
        </div>

        {/* X: multi-select feature variables */}
        <div className="flex-[2] min-w-[220px]" ref={dropRef}>
          <label className="block text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Feature Variables X
            <span className="ml-1 normal-case text-[var(--muted)]">
              ({xKeys.length} selected)
            </span>
          </label>
          <div className="relative">
            <button
              onClick={() => setXDropOpen((v) => !v)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-2 text-xs text-left flex items-center justify-between gap-2 transition-colors hover:border-[var(--border2)]"
            >
              <span className="text-[var(--fg)] truncate flex-1 min-w-0">
                {xKeys.length === 0
                  ? <span className="text-[var(--muted)]">Select features…</span>
                  : selectedXDefs.map((d) => d.label).join(', ')}
              </span>
              <ChevronDown
                size={12}
                className={`text-[var(--muted)] flex-shrink-0 transition-transform ${xDropOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {xDropOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto py-1.5">
                {X_CATALOG.map((def) => {
                  const checked = xKeys.includes(def.key);
                  return (
                    <label
                      key={def.key}
                      className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-[var(--bg)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleX(def.key)}
                        className="flex-shrink-0 accent-violet-400"
                      />
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: def.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[var(--fg)] truncate">{def.label}</div>
                        <div className="text-[9px] text-[var(--muted)]">{def.unit}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-[9px] text-[var(--muted)] mt-1">Alt-data + macro indicators</div>
        </div>

        {/* Time range */}
        <div>
          <label className="block text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Time Range
          </label>
          <div className="flex gap-1">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => { setRangeIdx(i); setResult(null); }}
                className="px-3 py-2 text-[11px] rounded transition-all"
                style={
                  rangeIdx === i
                    ? { background: ACCENT + '20', color: ACCENT, border: `1px solid ${ACCENT}40` }
                    : { background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={loading || xKeys.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          style={{ background: ACCENT2, color: '#fff' }}
        >
          <Play size={12} />
          {loading ? 'Running…' : 'Run Regression'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-4 px-3 py-3 rounded border border-red-400/25 bg-red-400/8">
          {error.split('\n').map((line, i) => (
            <p key={i} className={`text-xs text-red-400 ${i > 0 ? 'mt-1' : ''}`}>{line}</p>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center h-52 text-xs text-[var(--muted)]">
          Fetching data and fitting model…
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <div className="p-4 space-y-5">

          {/* Partial-failure warning — some features were fetched but others failed */}
          {result.partialFail && (
            <div className="px-3 py-2.5 rounded border border-yellow-400/25 bg-yellow-400/8">
              <p className="text-xs text-yellow-400 font-medium mb-1">
                The following features failed to load and were excluded from the model:
              </p>
              {result.partialFail.map((msg, i) => (
                <p key={i} className="text-[11px] text-yellow-400/80">· {msg}</p>
              ))}
            </div>
          )}

          {/* R² metric card */}
          <div className="flex gap-3">
            <div
              className="flex-1 rounded-lg px-4 py-3.5 flex items-center gap-4 border"
              style={{ background: ACCENT2 + '0d', borderColor: ACCENT2 + '30' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: ACCENT2 + '22', border: `1px solid ${ACCENT2}50` }}
              >
                <TrendingUp size={15} style={{ color: ACCENT2 }} />
              </div>
              <div>
                <div className="text-[10px] text-[var(--sub)] uppercase tracking-wider mb-0.5">
                  R² — Coefficient of Determination
                </div>
                <div className="text-[28px] leading-tight font-mono font-bold" style={{ color: ACCENT2 }}>
                  {result.r2.toFixed(4)}
                </div>
                <div className="text-[10px] text-[var(--muted)] mt-0.5">
                  Model explains {(result.r2 * 100).toFixed(1)}% of price variance
                  · {result.nObs} observations
                </div>
              </div>
            </div>

            {/* Fit quality badge */}
            <div
              className="flex flex-col items-center justify-center px-5 rounded-lg border"
              style={{
                borderColor: r2Color(result.r2) + '40',
                background:  r2Color(result.r2) + '10',
              }}
            >
              <div className="text-[9px] text-[var(--muted)] uppercase tracking-wider mb-1">Fit</div>
              <div
                className="text-base font-bold"
                style={{ color: r2Color(result.r2) }}
              >
                {r2Label(result.r2)}
              </div>
            </div>
          </div>

          {/* Coefficients table */}
          <div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">
              Model Coefficients&ensp;—&ensp;ŷ = β₀ + β₁X₁ + β₂X₂ + …
            </div>
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">
                      Variable
                    </th>
                    <th className="text-right px-3 py-2 text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium">
                      Coefficient β
                    </th>
                    <th className="text-right px-3 py-2 text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium hidden sm:table-cell">
                      Pearson r
                    </th>
                    <th className="text-right px-3 py-2 text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium hidden sm:table-cell">
                      Per unit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Intercept */}
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[var(--muted)]" />
                        <span className="text-[var(--sub)] font-medium">β₀ — Intercept</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[var(--fg)]">
                      {result.intercept.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--muted)] hidden sm:table-cell">—</td>
                    <td className="px-3 py-2.5 text-right text-[var(--muted)] hidden sm:table-cell">—</td>
                  </tr>

                  {/* Feature coefficients */}
                  {result.coefficients.map((beta, i) => (
                    <tr
                      key={xKeys[i]}
                      className={i < result.coefficients.length - 1 ? 'border-b border-[var(--border)]' : ''}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: result.xColors[i] }}
                          />
                          <span style={{ color: result.xColors[i] }} className="font-medium">
                            β{i + 1} — {result.xLabels[i]}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className="font-mono font-semibold"
                          style={{ color: beta >= 0 ? '#34d399' : '#f87171' }}
                        >
                          {beta >= 0 ? '+' : ''}{beta.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                        {(() => {
                          const r = result.pearsonR[i];
                          const color = Math.abs(r) >= 0.7 ? '#34d399'
                            : Math.abs(r) >= 0.4 ? ACCENT
                            : 'var(--muted)';
                          return (
                            <span className="font-mono font-semibold" style={{ color }}>
                              {r >= 0 ? '+' : ''}{r.toFixed(3)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[var(--muted)] text-[10px] hidden sm:table-cell">
                        per {result.xUnits[i]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actual vs. Predicted scatter chart */}
          <div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">
              Actual vs. Predicted — Goodness of Fit
            </div>
            <p className="text-[10px] text-[var(--muted)] mb-3 leading-relaxed">
              Each dot is one aligned observation. Points along the dashed diagonal (y&nbsp;=&nbsp;x)
              indicate a perfect prediction — the tighter the cluster, the better the model.
            </p>
            <ActualVsPredictedChart data={result.scatterData} yTicker={yTicker} />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-52 gap-3 text-center px-6">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: ACCENT2 + '15', border: `1px solid ${ACCENT2}30` }}
          >
            <Activity size={18} style={{ color: ACCENT2 }} />
          </div>
          <div>
            <p className="text-xs text-[var(--sub)] mb-0.5">
              Select features and run the regression
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Discover hidden alt-data relationships driving stock price variance
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
