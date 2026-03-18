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
import { Package } from 'lucide-react';

const BASE = (import.meta.env.VITE_ALTDATA_BASE ?? '') + '/alt-data/v1';

const SERIES = [
  { key: 'Apple_Mobile', label: 'Apple (Mobile)',  color: '#e7cd79' },
  { key: 'Nvidia_HPC',   label: 'Nvidia (HPC)',    color: '#467897' },
  { key: 'Amazon_CSP',   label: 'Amazon (CSP)',    color: '#34d399' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2128] border border-[#21262d] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-[#8b949e] mb-1.5 font-medium">{label}</div>
      {SERIES.map(({ key, label: name, color }) => {
        const entry = payload.find((p) => p.dataKey === key);
        if (!entry || entry.value == null) return null;
        return (
          <div key={key} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[#8b949e]">{name}</span>
            <span className="font-mono font-semibold ml-auto" style={{ color }}>
              ${Number(entry.value).toFixed(2)}B
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FablessInventoryChart() {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/tsmc/fabless-inventory`, { headers: { Accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setData(json.results))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
               style={{ background: '#a78bfa20', border: '1px solid #a78bfa40' }}>
            <Package size={12} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#e6edf3]">Top Fabless Inventory Index</h3>
            <p className="text-[11px] text-[#8b949e]">Quarterly inventory · Billions USD</p>
          </div>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium">
            LIVE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399] rounded font-medium">
            TSMC
          </span>
        </div>
      </div>


      {/* Description */}
      <p className="text-[11px] text-[#484f58] mb-3">
        Downstream inventory signal for TSMC's Mobile, HPC, and CSP segments —
        sourced from quarterly balance sheets (AAPL / NVDA / AMZN).
      </p>

      {/* Chart */}
      {error ? (
        <div className="flex items-center justify-center text-xs text-[#8b949e] h-52">{error}</div>
      ) : !data ? (
        <div className="flex items-center justify-center text-xs text-[#484f58] h-52">Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 10, fill: '#484f58' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#484f58' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `$${v}B`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(val) => {
                const s = SERIES.find((s) => s.key === val);
                return <span style={{ color: '#8b949e' }}>{s?.label ?? val}</span>;
              }}
            />
            {SERIES.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={1.5}
                dot={{ r: 3, fill: color, stroke: '#0d1117', strokeWidth: 1.5 }}
                activeDot={{ r: 4, stroke: '#0d1117', strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
