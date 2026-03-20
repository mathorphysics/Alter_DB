import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { fetchATEShipments } from '../api/altdata';

const RANGES = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: 'All', months: 9999 },
];

const SERIES = [
  { key: 'Japan_TW', name: 'JP → TW', color: '#34d399' },
  { key: 'USA_TW',   name: 'US → TW', color: '#22d3ee' },
  { key: 'Japan_KR', name: 'JP → KR', color: '#467897' },
  { key: 'USA_KR',   name: 'US → KR', color: '#38bdf8' },
  { key: 'Japan_CN', name: 'JP → CN', color: '#f87171' },
  { key: 'USA_CN',   name: 'US → CN', color: '#fb923c' },
];

// Default to showing TW flows only (less cluttered)
const VIEW_PRESETS = [
  { label: 'TW',  keys: ['Japan_TW', 'USA_TW'] },
  { label: 'KR',  keys: ['Japan_KR', 'USA_KR'] },
  { label: 'CN',  keys: ['Japan_CN', 'USA_CN'] },
  { label: 'All', keys: SERIES.map((s) => s.key) },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-[var(--sub)] mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: p.color }} className="font-mono font-semibold">
            ${Number(p.value).toLocaleString('en-US', { maximumFractionDigits: 1 })}M
          </span>
          <span className="text-[var(--sub)]">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function ATEShipmentsChart({ compact = false }) {
  const [data, setData]        = useState(null);
  const [error, setError]      = useState(null);
  const [rangeIdx, setRange]   = useState(1);
  const [viewIdx, setViewIdx]  = useState(0);

  useEffect(() => {
    fetchATEShipments()
      .then((res) => setData(res.results ?? []))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = (() => {
    if (!data) return [];
    const months = RANGES[rangeIdx].months;
    return months >= 9999 ? data : data.slice(-months);
  })();

  const visibleKeys = compact ? VIEW_PRESETS[0].keys : VIEW_PRESETS[viewIdx].keys;
  const visibleSeries = SERIES.filter((s) => visibleKeys.includes(s.key));

  const last = filtered[filtered.length - 1];

  const chartHeight = compact ? 160 : 240;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-6 h-6 rounded flex items-center justify-center"
               style={{ background: '#fb923c20', border: '1px solid #fb923c40' }}>
            <TrendingUp size={12} style={{ color: '#fb923c' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)]">
              ATE Shipments
            </h3>
            {!compact && (
              <p className="text-[11px] text-[var(--sub)]">
                JP + US HS-903180 test equipment to TW / KR / CN — Advantest / Teradyne proxy · USD Millions
              </p>
            )}
          </div>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium ml-1">
            LIVE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-[#fb923c]/10 border border-[#fb923c]/30 text-[#fb923c] rounded font-medium">
            OSAT
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-[#467897]/10 border border-[#467897]/30 text-[#467897] rounded font-medium">
            Supplier
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Destination filter */}
          {!compact && (
            <div className="flex items-center gap-1 bg-[var(--bg)] rounded-md p-0.5 border border-[var(--border)]">
              {VIEW_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setViewIdx(i)}
                  className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                    i === viewIdx
                      ? 'bg-[#fb923c]/20 text-[#fb923c] font-medium'
                      : 'text-[var(--sub)] hover:text-[var(--fg)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {/* Range filter */}
          <div className="flex items-center gap-1 bg-[var(--bg)] rounded-md p-0.5 border border-[var(--border)]">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRange(i)}
                className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                  i === rangeIdx
                    ? 'bg-[#fb923c]/20 text-[#fb923c] font-medium'
                    : 'text-[var(--sub)] hover:text-[var(--fg)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {!compact && data && last && (
        <div className="flex gap-4 mb-3 flex-wrap">
          {visibleSeries.map((s, i) => {
            return (
              <div key={s.key} className="flex items-center gap-4">
                {i > 0 && <div className="w-px bg-[var(--border)] h-8" />}
                <div>
                  <span className="text-[10px] text-[var(--sub)]">{s.name}</span>
                  <div className="text-sm font-mono font-semibold" style={{ color: s.color }}>
                    ${last[s.key]?.toLocaleString('en-US', { maximumFractionDigits: 1 }) ?? '—'}M
                  </div>
                </div>
              </div>
            );
          })}
          <div className="w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--sub)]">Source</span>
            <div className="text-[11px] text-[var(--muted)]">UN Comtrade · HS 903180</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {error ? (
        <div className="flex items-center justify-center text-xs text-[var(--sub)]" style={{ height: chartHeight }}>
          {error}
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center text-xs text-[var(--muted)]" style={{ height: chartHeight }}>
          Loading…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => `$${v.toFixed(0)}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            {!compact && (
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--sub)', paddingTop: 8 }}
                formatter={(val) => <span style={{ color: 'var(--sub)' }}>{val}</span>}
              />
            )}
            {visibleSeries.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 3, fill: s.color, stroke: 'var(--bg)', strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
