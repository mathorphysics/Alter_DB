/**
 * AltDataOverlayChart
 * ───────────────────
 * Overlays high-frequency daily stock prices (left Y-axis, line)
 * with low-frequency alt-data signals (right Y-axis, bar or scatter)
 * in a single recharts ComposedChart.
 *
 * Layout: 75% chart | 25% slicer
 */

import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  ComposedChart, Line, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';

import { fetchHistoricalPrice } from '../api/openbb';
import {
  fetchIntelOregonEquipment,
  fetchIntelChipsFunding,
  fetchTsmcRevenue,
  fetchTaiwanEquipmentImports,
  fetchEquipmentTrade,
  fetchKoreaEquipmentInflow,
  fetchJapanKoreaMaterials,
} from '../api/altdata';
import { mergeTimeSeries, xTickInterval, today, daysAgo } from '../utils/timeSeries';

// ── Palette ───────────────────────────────────────────────────────────────────

const PRICE_COLOR   = '#e7cd79';
const SERIES_COLORS = ['#a78bfa', '#34d399', '#467897', '#fb923c', '#f87171', '#38bdf8'];

// ── Ticker catalogue (mirrors SupplyChainPage data.js) ────────────────────────

const TICKER_STAGES = [
  {
    stage: 'Designer',
    color: '#e7cd79',
    tickers: [
      { value: 'NVDA',    label: 'Nvidia',       sub: 'GPU Design' },
      { value: 'AMD',     label: 'AMD',          sub: 'CPU/GPU' },
      { value: 'ON',      label: 'onsemi',       sub: 'Power IDM' },
      { value: 'WBT.AX',  label: 'Weebit Nano',  sub: 'Memory IP' },
      { value: 'ARM',     label: 'ARM',          sub: 'Arch IP' },
    ],
  },
  {
    stage: 'Supplier',
    color: '#467897',
    tickers: [
      { value: 'ASML',   label: 'ASML',              sub: 'Lithography' },
      { value: 'AMAT',   label: 'Applied Matl.',     sub: 'Deposition' },
      { value: 'LRCX',   label: 'Lam Research',      sub: 'Etch' },
      { value: 'SHECY',  label: 'Shin-Etsu',         sub: 'Materials' },
      { value: 'SNPS',   label: 'Synopsys',          sub: 'EDA' },
    ],
  },
  {
    stage: 'Frontend',
    color: '#34d399',
    tickers: [
      { value: 'TSM',        label: 'TSMC',            sub: 'Pure-Play' },
      { value: '005930.KS',  label: 'Samsung',         sub: 'IDM Foundry' },
      { value: 'INTC',       label: 'Intel IFS',       sub: 'IDM Foundry' },
      { value: 'SMICY',      label: 'SMIC',            sub: 'Mature Node' },
      { value: 'GFS',        label: 'GlobalFoundries', sub: 'Specialty' },
    ],
  },
  {
    stage: 'Inspection',
    color: '#a78bfa',
    tickers: [
      { value: 'KLAC',   label: 'KLA',             sub: 'Process Ctrl' },
      { value: 'ONTO',   label: 'Onto Innovation', sub: 'Defect' },
      { value: 'NVMI',   label: 'Nova',            sub: 'Metrology' },
      { value: 'ATEYY',  label: 'Advantest',       sub: 'ATE' },
      { value: 'TER',    label: 'Teradyne',        sub: 'ATE' },
    ],
  },
  {
    stage: 'OSAT',
    color: '#fb923c',
    tickers: [
      { value: 'ASX',    label: 'ASE Group', sub: 'OSAT #1' },
      { value: 'AMKR',   label: 'Amkor',     sub: 'OSAT' },
      { value: 'JEVTY',  label: 'JCET',      sub: 'OSAT CN' },
      { value: 'PIIMF',  label: 'PTI',       sub: 'Memory OSAT' },
    ],
  },
];

// ── Alt-data catalogue ────────────────────────────────────────────────────────
//
// Each entry defines:
//   key         unique series key (used as dataKey in recharts)
//   label       display name in slicer / tooltip
//   unit        right Y-axis label suffix
//   granularity 'monthly' | 'quarterly' | 'event'
//   chartType   'bar' | 'scatter'
//   tickers     which tickers this signal is relevant for
//   color       series color
//   fetch       async function → raw API response
//   extract     (apiResponse) → [{date, value, ?flagged}]

const ALT_CATALOG = [
  // ── Intel ──────────────────────────────────────────────────────────────────
  {
    key:         'intel-oregon',
    label:       'ASML Equip. Imports (OR)',
    unit:        'USD M',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['INTC'],
    color:       SERIES_COLORS[0],
    fetch:       fetchIntelOregonEquipment,
    extract:     (r) => (r.results ?? []).map((p) => ({ date: p.period, value: p.value, flagged: p.flagged })),
  },
  {
    key:         'intel-dod',
    label:       'DoD Federal Contracts',
    unit:        'USD M',
    granularity: 'event',
    chartType:   'scatter',
    tickers:     ['INTC'],
    color:       SERIES_COLORS[2],
    fetch:       fetchIntelChipsFunding,
    extract:     (r) => (r.live_awards ?? []).map((a) => ({ date: a.action_date, value: +(a.amount_usd / 1e6).toFixed(2) })),
  },

  // ── TSMC ───────────────────────────────────────────────────────────────────
  {
    key:         'tsmc-revenue',
    label:       'TSMC Monthly Revenue',
    unit:        'NT$B',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['TSM'],
    color:       SERIES_COLORS[1],
    fetch:       fetchTsmcRevenue,
    extract:     (r) => (r.results ?? []).map((p) => ({ date: p.date, value: +(p.revenue / 1000).toFixed(1) })),
  },
  {
    key:         'tw-equipment',
    label:       'Taiwan Equip. Imports (HS-8486)',
    unit:        'USD M',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['TSM'],
    color:       SERIES_COLORS[3],
    fetch:       fetchTaiwanEquipmentImports,
    extract:     (r) => (r.results ?? []).map((p) => ({ date: p.date, value: p.value })),
  },
  {
    key:         'tw-equipment-export',
    label:       'Taiwan Equip. Exports (HS-8486)',
    unit:        'USD M',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['TSM'],
    color:       SERIES_COLORS[5],
    fetch:       fetchEquipmentTrade,
    extract:     (r) => (r.exports ?? []).map((p) => ({ date: p.date, value: p.value })),
  },

  // ── Samsung ────────────────────────────────────────────────────────────────
  {
    key:         'korea-nl',
    label:       'Korea Equip. Inflow (NL→KR)',
    unit:        'USD M',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['005930.KS'],
    color:       SERIES_COLORS[2],
    fetch:       fetchKoreaEquipmentInflow,
    extract:     (r) => (r.results ?? []).map((p) => ({ date: p.period, value: p.Netherlands ?? 0 })),
  },
  {
    key:         'korea-usa',
    label:       'Korea Equip. Inflow (US→KR)',
    unit:        'USD M',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['005930.KS'],
    color:       SERIES_COLORS[5],
    fetch:       fetchKoreaEquipmentInflow,
    extract:     (r) => (r.results ?? []).map((p) => ({ date: p.period, value: p.USA ?? 0 })),
  },
  {
    key:         'japan-materials',
    label:       'Japan→KR Materials (Si+PR)',
    unit:        'USD M',
    granularity: 'monthly',
    chartType:   'line',
    tickers:     ['005930.KS'],
    color:       SERIES_COLORS[4],
    fetch:       fetchJapanKoreaMaterials,
    extract:     (r) => (r.results ?? []).map((p) => ({ date: p.period, value: (p.SiliconWafers ?? 0) + (p.Photoresist ?? 0) })),
  },

  // ── ASML: 无买方侧数据 ─────────────────────────────────────────────────────
];

// ── Time range options ────────────────────────────────────────────────────────

const RANGES = [
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '3Y', days: 1095 },
];

// ── State reducer ─────────────────────────────────────────────────────────────

const init = {
  ticker:       'INTC',
  rangeIdx:     1,
  activeKeys:   ['intel-oregon'],
  stockData:    null,
  altCache:     {},          // key → raw API response
  stockLoading: false,
  stockError:   null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TICKER':
      return { ...state, ticker: action.value, stockData: null, activeKeys: [], stockError: null };
    case 'SET_RANGE':
      return { ...state, rangeIdx: action.value, stockData: null, stockError: null };
    case 'TOGGLE_KEY': {
      const has = state.activeKeys.includes(action.key);
      return { ...state, activeKeys: has
        ? state.activeKeys.filter((k) => k !== action.key)
        : [...state.activeKeys, action.key] };
    }
    case 'STOCK_LOADING':
      return { ...state, stockLoading: true, stockError: null };
    case 'STOCK_OK':
      return { ...state, stockLoading: false, stockData: action.data };
    case 'STOCK_ERR':
      return { ...state, stockLoading: false, stockError: action.msg };
    case 'ALT_OK':
      return { ...state, altCache: { ...state.altCache, [action.key]: action.data } };
    default:
      return state;
  }
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function OverlayTooltip({ active, payload, label, activeSeries }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  return (
    <div className="bg-[#1c2128] border border-[#21262d] rounded-lg px-3 py-2.5 shadow-xl text-xs min-w-[160px]">
      <div className="text-[#8b949e] mb-2 font-medium">{label}</div>
      {row.price != null && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRICE_COLOR }} />
          <span className="font-mono font-semibold" style={{ color: PRICE_COLOR }}>
            ${Number(row.price).toFixed(2)}
          </span>
          <span className="text-[#8b949e]">price</span>
        </div>
      )}
      {activeSeries.map((s) =>
        row[s.key] != null ? (
          <div key={s.key} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="font-mono font-semibold" style={{ color: s.color }}>
              {Number(row[s.key]).toLocaleString('en-US', { maximumFractionDigits: 1 })}
              <span className="text-[#8b949e] font-normal ml-1">{s.unit}</span>
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AltDataOverlayChart() {
  const [state, dispatch] = useReducer(reducer, init);
  const { ticker, rangeIdx, activeKeys, stockData, altCache, stockLoading, stockError } = state;

  const range      = RANGES[rangeIdx];
  const startDate  = daysAgo(range.days);
  const endDate    = today();

  // Fetch stock price when ticker / range changes
  useEffect(() => {
    dispatch({ type: 'STOCK_LOADING' });
    fetchHistoricalPrice(ticker, startDate, endDate)
      .then((rows) => dispatch({ type: 'STOCK_OK', data: rows }))
      .catch((e) => dispatch({ type: 'STOCK_ERR', msg: e.message }));
  }, [ticker, rangeIdx]);

  // Fetch alt data on demand (cached)
  useEffect(() => {
    for (const key of activeKeys) {
      if (altCache[key]) continue;
      const def = ALT_CATALOG.find((d) => d.key === key);
      if (!def) continue;
      def.fetch()
        .then((raw) => dispatch({ type: 'ALT_OK', key, data: raw }))
        .catch(() => {});
    }
  }, [activeKeys]);

  // Available alt series for current ticker
  const availableSeries = ALT_CATALOG.filter((d) => d.tickers.includes(ticker));
  const activeSeries    = availableSeries.filter((d) => activeKeys.includes(d.key));

  // Build merged dataset
  const chartData = useMemo(() => {
    if (!stockData?.length) return [];
    const altSeries = activeSeries
      .map((def) => {
        const raw = altCache[def.key];
        if (!raw) return null;
        return { key: def.key, points: def.extract(raw) };
      })
      .filter(Boolean);
    return mergeTimeSeries(
      stockData.map((r) => ({ date: r.date, close: r.close })),
      altSeries,
    );
  }, [stockData, activeKeys, altCache]);

  // Y-axis domains
  const prices     = chartData.map((r) => r.price).filter(Boolean);
  const priceMin   = prices.length ? Math.min(...prices) * 0.96 : 'auto';
  const priceMax   = prices.length ? Math.max(...prices) * 1.02 : 'auto';

  const altValues  = activeSeries.flatMap((s) => chartData.map((r) => r[s.key]).filter((v) => v != null));
  const altMax     = altValues.length ? Math.max(...altValues) * 1.15 : 'auto';

  const tickEvery  = xTickInterval(chartData.length, 10);

  // Format X-axis label: "Jan 24" from "2024-01-31"
  const fmtDate = (d) => {
    if (!d || typeof d !== 'string') return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Right axis formatter
  const fmtRight = (v) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}B`;
    return `${v.toFixed(0)}`;
  };

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#21262d]">
        <div className="w-6 h-6 rounded flex items-center justify-center"
             style={{ background: PRICE_COLOR + '20', border: `1px solid ${PRICE_COLOR}40` }}>
          <BarChart2 size={12} style={{ color: PRICE_COLOR }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#e6edf3]">Alt Data × Stock Price Overlay</h3>
          <p className="text-[11px] text-[#8b949e]">
            Multi-granularity signal alignment — daily price vs. monthly / event alt data
          </p>
        </div>
      </div>

      {/* ── Body: chart + slicer ── */}
      <div className="flex">

        {/* ── Left: Chart (75%) ── */}
        <div className="flex-1 min-w-0 p-4">

          {/* Price summary strip */}
          {stockData && chartData.length > 0 && (() => {
            const last  = chartData[chartData.length - 1];
            const first = chartData.find((r) => r.price);
            const chg   = first ? ((last.price - first.price) / first.price * 100) : null;
            return (
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <span className="text-[10px] text-[#8b949e]">{ticker}</span>
                  <div className="text-sm font-mono font-bold" style={{ color: PRICE_COLOR }}>
                    ${last.price?.toFixed(2)}
                  </div>
                </div>
                {chg != null && (
                  <>
                    <div className="w-px h-6 bg-[#21262d]" />
                    <div>
                      <span className="text-[10px] text-[#8b949e]">{range.label} return</span>
                      <div className={`text-sm font-mono font-semibold ${chg >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                        {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                      </div>
                    </div>
                  </>
                )}
                {activeSeries.map((s) => {
                  const vals = chartData.map((r) => r[s.key]).filter((v) => v != null);
                  const latest = vals[vals.length - 1];
                  return latest != null ? (
                    <div key={s.key} className="w-px h-6 bg-[#21262d]" />,
                    <div key={s.key + '_v'}>
                      <span className="text-[10px] text-[#8b949e]">{s.label}</span>
                      <div className="text-sm font-mono font-semibold" style={{ color: s.color }}>
                        {Number(latest).toFixed(1)}<span className="text-[10px] text-[#484f58] ml-0.5">{s.unit}</span>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            );
          })()}

          {/* Chart area */}
          {stockError && (
            <div className="flex items-center justify-center h-72 text-xs text-[#8b949e]">
              {stockError}
            </div>
          )}
          {stockLoading && (
            <div className="flex items-center justify-center h-72 text-xs text-[#484f58]">
              Loading prices…
            </div>
          )}
          {!stockLoading && !stockError && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#484f58' }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickEvery}
                  tickFormatter={fmtDate}
                />

                {/* Left Y: Stock price */}
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  domain={[priceMin, priceMax]}
                  tick={{ fontSize: 10, fill: '#484f58' }}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                  tickFormatter={(v) => `$${v.toFixed(0)}`}
                />

                {/* Right Y: Alt data */}
                {activeSeries.length > 0 && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, altMax]}
                    tick={{ fontSize: 10, fill: '#484f58' }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={fmtRight}
                  />
                )}

                <Tooltip
                  content={<OverlayTooltip activeSeries={activeSeries} />}
                  cursor={{ stroke: '#30363d', strokeWidth: 1 }}
                />

                {/* Alt data series */}
                {activeSeries.map((s) =>
                  s.chartType === 'line' ? (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      yAxisId="right"
                      stroke={s.color}
                      strokeWidth={1.5}
                      dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: s.color, stroke: '#0d1117', strokeWidth: 1.5 }}
                      connectNulls={true}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Scatter
                      key={s.key}
                      dataKey={s.key}
                      yAxisId="right"
                      fill={s.color}
                      r={4}
                      isAnimationActive={false}
                    />
                  )
                )}

                {/* Stock price line — rendered last so it's on top */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="price"
                  stroke={PRICE_COLOR}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                  activeDot={{ r: 3, fill: PRICE_COLOR, stroke: '#0d1117', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          {activeSeries.length > 0 && (
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-5 border-t-2 flex-shrink-0" style={{ borderColor: PRICE_COLOR }} />
                <span className="text-[10px] text-[#8b949e]">Stock Price (L)</span>
              </div>
              {activeSeries.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="w-5 border-t-2 flex-shrink-0" style={{ borderColor: s.color }} />
                  <span className="text-[10px] text-[#8b949e]">{s.label} (R)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Slicer ── */}
        <div className="w-52 flex-shrink-0 border-l border-[#21262d] flex flex-col">

          {/* ── Ticker scroll list ── */}
          <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: 420 }}>
            <div className="text-[10px] text-[#484f58] uppercase tracking-wider mb-2 px-1">Ticker</div>
            {TICKER_STAGES.map(({ stage, color, tickers }) => {
              const hasSignal = (v) => ALT_CATALOG.some((d) => d.tickers.includes(v));
              return (
                <div key={stage} className="mb-3">
                  {/* Stage label */}
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color }}>{stage}</span>
                  </div>
                  {/* Ticker rows */}
                  {tickers.map((t) => {
                    const active  = ticker === t.value;
                    const hasAlt  = hasSignal(t.value);
                    return (
                      <button
                        key={t.value}
                        onClick={() => dispatch({ type: 'SET_TICKER', value: t.value })}
                        className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-all mb-0.5"
                        style={
                          active
                            ? { background: color + '18', border: `1px solid ${color}40` }
                            : { background: 'transparent', border: '1px solid transparent' }
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium leading-tight truncate"
                               style={{ color: active ? color : '#8b949e' }}>
                            {t.label}
                          </div>
                          <div className="text-[9px] text-[#484f58]">{t.sub}</div>
                        </div>
                        {hasAlt && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#34d399]" title="Alt data available" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ── Time range + Alt signals (fixed bottom) ── */}
          <div className="border-t border-[#21262d] p-3 space-y-4">

            {/* Time range */}
            <div>
              <div className="text-[10px] text-[#484f58] uppercase tracking-wider mb-1.5">Time Range</div>
              <div className="flex gap-1">
                {RANGES.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => dispatch({ type: 'SET_RANGE', value: i })}
                    className="flex-1 py-1 text-[11px] rounded transition-all"
                    style={
                      rangeIdx === i
                        ? { background: PRICE_COLOR + '20', color: PRICE_COLOR, border: `1px solid ${PRICE_COLOR}40` }
                        : { background: '#0d1117', color: '#484f58', border: '1px solid #21262d' }
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alt data checkboxes */}
            <div>
              <div className="text-[10px] text-[#484f58] uppercase tracking-wider mb-1.5">Alt Signals</div>
              {availableSeries.length === 0 ? (
                <div className="text-[10px] text-[#484f58] italic">No signals for {ticker}</div>
              ) : (
                <div className="space-y-1.5">
                  {availableSeries.map((s, idx) => {
                    const active = activeKeys.includes(s.key);
                    const color  = SERIES_COLORS[idx % SERIES_COLORS.length];
                    return (
                      <label key={s.key} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => dispatch({ type: 'TOGGLE_KEY', key: s.key })}
                          className="mt-0.5 flex-shrink-0 accent-violet-400"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] leading-tight"
                               style={{ color: active ? color : '#484f58' }}>
                            {s.label}
                          </div>
                          <div className="text-[9px] text-[#484f58]">{s.granularity} · {s.unit}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
