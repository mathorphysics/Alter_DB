import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BookMarked } from 'lucide-react';

const BASE = (import.meta.env.VITE_ALTDATA_BASE ?? '') + '/alt-data/v1';

const RANGES = [
  { label: '1Y', months: 12 },
  { label: '3Y', months: 36 },
  { label: 'All', months: 9999 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-[var(--sub)] mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: p.color }} className="font-mono font-semibold">{p.value}</span>
          <span className="text-[var(--sub)]">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function SamsungPatentChart({ compact = false }) {
  const [data, setData]      = useState(null);
  const [error, setError]    = useState(null);
  const [rangeIdx, setRange] = useState(0);

  useEffect(() => {
    fetch(`${BASE}/samsung/patents`, { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) return r.json().then((b) => Promise.reject(new Error(b?.detail ?? `HTTP ${r.status}`)));
        return r.json();
      })
      .then((res) => setData(res))
      .catch((e) => setError(e.message));
  }, []);

  const timeseries = data?.timeseries ?? [];

  const filtered = (() => {
    const months = RANGES[rangeIdx].months;
    return months >= 9999 ? timeseries : timeseries.slice(-months);
  })();

  const last   = filtered[filtered.length - 1];
  const prev   = filtered[filtered.length - 2];
  const totDelta = last?.count && prev?.count
    ? ((last.count - prev.count) / prev.count * 100).toFixed(1)
    : null;

  const chartHeight = compact ? 160 : 240;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
               style={{ background: '#a78bfa20', border: '1px solid #a78bfa40' }}>
            <BookMarked size={12} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)]">
              Samsung Semiconductor Patent Filings
            </h3>
            {!compact && (
              <p className="text-[11px] text-[var(--sub)]">
                Monthly H01L 21/29 patent applications — advanced process highlighted
              </p>
            )}
          </div>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium ml-1">
            LIVE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-[#467897]/10 border border-[#467897]/30 text-[#467897] rounded font-medium">
            Samsung
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg)] rounded-md p-0.5 border border-[var(--border)]">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRange(i)}
              className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                i === rangeIdx
                  ? 'bg-[#a78bfa]/20 text-[#a78bfa] font-medium'
                  : 'text-[var(--sub)] hover:text-[var(--fg)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {!compact && data && last && (
        <div className="flex gap-4 mb-3">
          <div>
            <span className="text-[10px] text-[var(--sub)]">Last Year</span>
            <div className="text-sm font-mono font-semibold text-[#a78bfa]">
              {last.count} patents
              {totDelta && (
                <span className={`ml-1.5 text-[11px] ${Number(totDelta) >= 0 ? 'text-[#a78bfa]' : 'text-red-400'}`}>
                  {Number(totDelta) >= 0 ? '+' : ''}{totDelta}% YoY
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--sub)]">Source</span>
            <div className="text-[11px] text-[var(--muted)]">KIPRIS · H01L</div>
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
          <ComposedChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            {!compact && (
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--sub)', paddingTop: 8 }}
                formatter={(val) => <span style={{ color: 'var(--sub)' }}>{val}</span>}
              />
            )}
            <Bar dataKey="count" name="H01L Patents" fill="#a78bfa" opacity={0.5} radius={[2,2,0,0]} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
