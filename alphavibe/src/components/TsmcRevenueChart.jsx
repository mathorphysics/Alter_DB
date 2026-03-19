import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const BASE = (import.meta.env.VITE_ALTDATA_BASE ?? '') + '/alt-data/v1';

const RANGES = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: 'All', months: 9999 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-[var(--sub)] mb-1.5">{label}</div>
      <div className="font-mono font-semibold text-[#34d399]">
        NT${Number(d.revenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}M
      </div>
      {d.mom != null && (
        <div className={`text-[10px] mt-0.5 ${d.mom >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
          MoM {d.mom >= 0 ? '+' : ''}{d.mom}%
        </div>
      )}
      {d.yoy != null && (
        <div className={`text-[10px] ${d.yoy >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
          YoY {d.yoy >= 0 ? '+' : ''}{d.yoy}%
        </div>
      )}
    </div>
  );
}

export default function TsmcRevenueChart() {
  const [data, setData]      = useState(null);
  const [error, setError]    = useState(null);
  const [rangeIdx, setRange] = useState(1);

  useEffect(() => {
    fetch(`${BASE}/tsmc/monthly-revenue`, { headers: { Accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setData(json.results))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = (() => {
    if (!data) return [];
    const months = RANGES[rangeIdx].months;
    return months >= 9999 ? data : data.slice(-months);
  })();

  const last    = filtered[filtered.length - 1];
  const prev    = filtered[filtered.length - 2];
  const momText = last?.mom != null
    ? `${last.mom >= 0 ? '+' : ''}${last.mom}% MoM`
    : prev && last
      ? `${(((last.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1)}% MoM`
      : null;

  // Peak revenue for color scaling
  const maxRev = filtered.length ? Math.max(...filtered.map((d) => d.revenue)) : 1;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
               style={{ background: '#34d39920', border: '1px solid #34d39940' }}>
            <TrendingUp size={12} style={{ color: '#34d399' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)]">TSMC Monthly Revenue</h3>
            <p className="text-[11px] text-[var(--sub)]">NT$ Millions · investor.tsmc.com</p>
          </div>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium ml-1">
            LIVE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399] rounded font-medium">
            TSMC
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg)] rounded-md p-0.5 border border-[var(--border)]">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRange(i)}
              className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                i === rangeIdx
                  ? 'bg-[#34d399]/20 text-[#34d399] font-medium'
                  : 'text-[var(--sub)] hover:text-[var(--fg)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {data && last && (
        <div className="flex gap-4 mb-3">
          <div>
            <span className="text-[10px] text-[var(--sub)]">Latest ({last.label})</span>
            <div className="text-sm font-mono font-semibold text-[#34d399]">
              NT${Number(last.revenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}M
              {momText && (
                <span className={`ml-1.5 text-[11px] ${last.mom >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                  {momText}
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--sub)]">Period</span>
            <div className="text-[11px] text-[var(--muted)]">
              {filtered[0]?.label} → {last.label}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {error ? (
        <div className="flex items-center justify-center text-xs text-[var(--sub)] h-52">{error}</div>
      ) : !data ? (
        <div className="flex items-center justify-center text-xs text-[var(--muted)] h-52">Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
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
              width={56}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}B`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)' }} />
            <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
              {filtered.map((entry) => (
                <Cell
                  key={entry.date}
                  fill={`rgba(52,211,153,${0.35 + 0.55 * (entry.revenue / maxRev)})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
