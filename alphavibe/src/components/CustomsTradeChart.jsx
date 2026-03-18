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
import { Ship } from 'lucide-react';
import { fetchEquipmentTrade } from '../api/altdata';

const RANGES = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: 'All', months: 9999 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2128] border border-[#21262d] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-[#8b949e] mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: p.color }} className="font-mono font-semibold">
            ${Number(p.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}M
          </span>
          <span className="text-[#8b949e]">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function CustomsTradeChart({ compact = false }) {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [rangeIdx, setRange] = useState(2);

  useEffect(() => {
    fetchEquipmentTrade()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  // Merge imports + exports into one array keyed by date
  const merged = (() => {
    if (!data) return [];
    const map = {};
    for (const pt of data.imports) map[pt.date] = { date: pt.date, label: pt.label, imports: pt.value };
    for (const pt of data.exports) {
      if (map[pt.date]) map[pt.date].exports = pt.value;
      else map[pt.date] = { date: pt.date, label: pt.label, exports: pt.value };
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const filtered = (() => {
    const months = RANGES[rangeIdx].months;
    if (months >= 9999) return merged;
    return merged.slice(-months);
  })();

  const lastImport = filtered[filtered.length - 1]?.imports;
  const lastExport = filtered[filtered.length - 1]?.exports;
  const prevImport = filtered[filtered.length - 2]?.imports;
  const prevExport = filtered[filtered.length - 2]?.exports;
  const importDelta = prevImport ? ((lastImport - prevImport) / prevImport * 100).toFixed(1) : null;
  const exportDelta = prevExport ? ((lastExport - prevExport) / prevExport * 100).toFixed(1) : null;

  const chartHeight = compact ? 160 : 240;

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
               style={{ background: '#e7cd7920', border: '1px solid #e7cd7940' }}>
            <Ship size={12} style={{ color: '#e7cd79' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#e6edf3]">
              Taiwan HS-8486 Equipment Trade
            </h3>
            {!compact && (
              <p className="text-[11px] text-[#8b949e]">
                Semiconductor equipment imports & exports — USD Millions
              </p>
            )}
          </div>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium ml-1">
            LIVE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399] rounded font-medium">
            TSMC
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[#0d1117] rounded-md p-0.5 border border-[#21262d]">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRange(i)}
              className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                i === rangeIdx
                  ? 'bg-[#467897]/20 text-[#467897] font-medium'
                  : 'text-[#8b949e] hover:text-[#e6edf3]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {!compact && data && (
        <div className="flex gap-4 mb-3">
          <div>
            <span className="text-[10px] text-[#8b949e]">Last Import</span>
            <div className="text-sm font-mono font-semibold text-[#467897]">
              ${lastImport?.toLocaleString('en-US', { maximumFractionDigits: 0 })}M
              {importDelta && (
                <span className={`ml-1.5 text-[11px] ${Number(importDelta) >= 0 ? 'text-[#467897]' : 'text-red-400'}`}>
                  {Number(importDelta) >= 0 ? '+' : ''}{importDelta}% MoM
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[#21262d]" />
          <div>
            <span className="text-[10px] text-[#8b949e]">Last Export</span>
            <div className="text-sm font-mono font-semibold text-[#e7cd79]">
              ${lastExport?.toLocaleString('en-US', { maximumFractionDigits: 0 })}M
              {exportDelta && (
                <span className={`ml-1.5 text-[11px] ${Number(exportDelta) >= 0 ? 'text-[#e7cd79]' : 'text-red-400'}`}>
                  {Number(exportDelta) >= 0 ? '+' : ''}{exportDelta}% MoM
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[#21262d]" />
          <div>
            <span className="text-[10px] text-[#8b949e]">Source</span>
            <div className="text-[11px] text-[#484f58]">Taiwan Customs · HS 8486</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {error ? (
        <div className="flex items-center justify-center text-xs text-[#8b949e]" style={{ height: chartHeight }}>
          {error}
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center text-xs text-[#484f58]" style={{ height: chartHeight }}>
          Loading…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#484f58' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#484f58' }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}B`}
            />
            <Tooltip content={<CustomTooltip />} />
            {!compact && (
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#8b949e', paddingTop: 8 }}
                formatter={(val) => <span style={{ color: '#8b949e' }}>{val}</span>}
              />
            )}
            <Line
              type="monotone"
              dataKey="imports"
              name="Imports"
              stroke="#467897"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#467897', stroke: '#0d1117', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="exports"
              name="Exports"
              stroke="#e7cd79"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#e7cd79', stroke: '#0d1117', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
