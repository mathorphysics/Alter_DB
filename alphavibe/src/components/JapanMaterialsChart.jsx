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
import { FlaskConical } from 'lucide-react';
import { fetchJapanKoreaMaterials } from '../api/altdata';

const RANGES = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
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
          <span style={{ color: p.color }} className="font-mono font-semibold">
            ${Number(p.value).toLocaleString('en-US', { maximumFractionDigits: 1 })}M
          </span>
          <span className="text-[var(--sub)]">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function JapanMaterialsChart({ compact = false }) {
  const [data, setData]      = useState(null);
  const [error, setError]    = useState(null);
  const [rangeIdx, setRange] = useState(1);

  useEffect(() => {
    fetchJapanKoreaMaterials()
      .then((res) => setData(res.results ?? []))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = (() => {
    if (!data) return [];
    const months = RANGES[rangeIdx].months;
    return months >= 9999 ? data : data.slice(-months);
  })();

  const last = filtered[filtered.length - 1];
  const prev = filtered[filtered.length - 2];
  const siDelta = last?.SiliconWafers && prev?.SiliconWafers
    ? ((last.SiliconWafers - prev.SiliconWafers) / prev.SiliconWafers * 100).toFixed(1)
    : null;
  const prDelta = last?.Photoresist && prev?.Photoresist
    ? ((last.Photoresist - prev.Photoresist) / prev.Photoresist * 100).toFixed(1)
    : null;

  const chartHeight = compact ? 160 : 240;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
               style={{ background: '#34d39920', border: '1px solid #34d39940' }}>
            <FlaskConical size={12} style={{ color: '#34d399' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)]">
              Japan → Korea Semiconductor Materials
            </h3>
            {!compact && (
              <p className="text-[11px] text-[var(--sub)]">
                Silicon wafers (HS 381800) & photoresist (HS 370790) — USD Millions · UN Comtrade
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
      {!compact && data && last && (
        <div className="flex gap-4 mb-3">
          <div>
            <span className="text-[10px] text-[var(--sub)]">Silicon Wafers</span>
            <div className="text-sm font-mono font-semibold text-[#467897]">
              ${last.SiliconWafers?.toLocaleString('en-US', { maximumFractionDigits: 1 })}M
              {siDelta && (
                <span className={`ml-1.5 text-[11px] ${Number(siDelta) >= 0 ? 'text-[#467897]' : 'text-red-400'}`}>
                  {Number(siDelta) >= 0 ? '+' : ''}{siDelta}% MoM
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--sub)]">Photoresist</span>
            <div className="text-sm font-mono font-semibold text-[#e7cd79]">
              ${last.Photoresist?.toLocaleString('en-US', { maximumFractionDigits: 1 })}M
              {prDelta && (
                <span className={`ml-1.5 text-[11px] ${Number(prDelta) >= 0 ? 'text-[#e7cd79]' : 'text-red-400'}`}>
                  {Number(prDelta) >= 0 ? '+' : ''}{prDelta}% MoM
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--sub)]">Source</span>
            <div className="text-[11px] text-[var(--muted)]">UN Comtrade · JP → KR</div>
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
            <Line
              type="monotone"
              dataKey="SiliconWafers"
              name="Silicon Wafers (HS 381800)"
              stroke="#467897"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 3, fill: '#467897', stroke: 'var(--bg)', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="Photoresist"
              name="Photoresist (HS 370790)"
              stroke="#e7cd79"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 3, fill: '#e7cd79', stroke: 'var(--bg)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
