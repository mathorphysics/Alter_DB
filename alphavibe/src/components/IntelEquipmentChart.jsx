import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { fetchIntelOregonEquipment } from '../api/altdata';

const INTEL_COLOR   = '#a78bfa';
const FLAG_COLOR    = '#f59e0b';   // amber — possible High-NA delivery
const AIR_COLOR     = '#a78bfa44';

const RANGES = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: 'All', months: 9999 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-[#1c2128] border border-[#21262d] rounded-lg px-3 py-2.5 shadow-xl text-xs min-w-[180px]">
      <div className="text-[#8b949e] mb-2 font-medium">{label}</div>

      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ background: d.flagged ? FLAG_COLOR : INTEL_COLOR }} />
        <span className="font-mono font-semibold" style={{ color: d.flagged ? FLAG_COLOR : INTEL_COLOR }}>
          ${Number(d.value).toLocaleString('en-US', { maximumFractionDigits: 1 })}M
        </span>
        <span className="text-[#8b949e]">customs value</span>
      </div>

      {d.air_pct != null && (
        <div className="text-[#484f58] mt-1">
          Air freight: <span className="text-[#8b949e] font-mono">{d.air_pct}%</span>
        </div>
      )}

      {d.flagged && (
        <div className="mt-2 px-2 py-1 rounded text-[10px] font-semibold"
             style={{ background: FLAG_COLOR + '20', color: FLAG_COLOR, border: `1px solid ${FLAG_COLOR}40` }}>
          ★ Possible High-NA / EUV Delivery
        </div>
      )}
    </div>
  );
}

export default function IntelEquipmentChart({ compact = false }) {
  const [data, setData]      = useState(null);
  const [error, setError]    = useState(null);
  const [rangeIdx, setRange] = useState(1);

  useEffect(() => {
    fetchIntelOregonEquipment()
      .then((res) => setData(res.results ?? []))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = (() => {
    if (!data) return [];
    const months = RANGES[rangeIdx].months;
    return months >= 9999 ? data : data.slice(-months);
  })();

  const flaggedCount = filtered.filter((d) => d.flagged).length;
  const last = filtered[filtered.length - 1];
  const prev = filtered.findLast((d) => d.value > 0 && d !== last);
  const momDelta = last?.value && prev?.value
    ? ((last.value - prev.value) / prev.value * 100).toFixed(1)
    : null;

  const chartHeight = compact ? 160 : 240;

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
               style={{ background: INTEL_COLOR + '20', border: `1px solid ${INTEL_COLOR}40` }}>
            <TrendingUp size={12} style={{ color: INTEL_COLOR }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#e6edf3]">
              ASML → Intel D1X Equipment Inflow
            </h3>
            {!compact && (
              <p className="text-[11px] text-[#8b949e]">
                Netherlands → Oregon HS-848620 imports · US Census statehs · USD Millions
              </p>
            )}
          </div>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium ml-1">
            LIVE
          </span>
          <span className="px-1.5 py-0.5 text-[9px] rounded font-medium"
                style={{ background: INTEL_COLOR + '10', border: `1px solid ${INTEL_COLOR}30`, color: INTEL_COLOR }}>
            Intel
          </span>
        </div>

        <div className="flex items-center gap-1 bg-[#0d1117] rounded-md p-0.5 border border-[#21262d]">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRange(i)}
              className={`px-2 py-0.5 text-[11px] rounded transition-all ${
                i === rangeIdx
                  ? 'font-medium'
                  : 'text-[#8b949e] hover:text-[#e6edf3]'
              }`}
              style={i === rangeIdx ? { background: INTEL_COLOR + '20', color: INTEL_COLOR } : {}}
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
            <span className="text-[10px] text-[#8b949e]">Latest Month</span>
            <div className="text-sm font-mono font-semibold" style={{ color: INTEL_COLOR }}>
              ${last.value?.toLocaleString('en-US', { maximumFractionDigits: 1 })}M
              {momDelta && (
                <span className={`ml-1.5 text-[11px] ${Number(momDelta) >= 0 ? '' : 'text-red-400'}`}
                      style={Number(momDelta) >= 0 ? { color: INTEL_COLOR } : {}}>
                  {Number(momDelta) >= 0 ? '+' : ''}{momDelta}% MoM
                </span>
              )}
            </div>
          </div>
          <div className="w-px bg-[#21262d]" />
          <div>
            <span className="text-[10px] text-[#8b949e]">Flagged Months</span>
            <div className="text-sm font-mono font-semibold" style={{ color: FLAG_COLOR }}>
              {flaggedCount}
              <span className="ml-1 text-[11px] text-[#484f58]">/ {filtered.length}</span>
            </div>
          </div>
          <div className="w-px bg-[#21262d]" />
          <div>
            <span className="text-[10px] text-[#8b949e]">Air Freight</span>
            <div className="text-[11px] text-[#8b949e] font-mono mt-0.5">
              {last.air_pct != null ? `${last.air_pct}%` : '—'}
              <span className="ml-1 text-[#484f58]">(EUV = 100%)</span>
            </div>
          </div>
          <div className="w-px bg-[#21262d]" />
          <div>
            <span className="text-[10px] text-[#8b949e]">Source</span>
            <div className="text-[11px] text-[#484f58]">US Census · HTS 848620</div>
          </div>
        </div>
      )}

      {/* Anomaly legend */}
      {!compact && flaggedCount > 0 && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded"
             style={{ background: FLAG_COLOR + '08', border: `1px solid ${FLAG_COLOR}20` }}>
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: FLAG_COLOR }} />
          <span className="text-[10px]" style={{ color: FLAG_COLOR }}>
            {flaggedCount} month{flaggedCount !== 1 ? 's' : ''} flagged as possible High-NA EUV delivery
            <span className="text-[#484f58] ml-1">(≥$300M or 3× avg, 100% air)</span>
          </span>
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
          <ComposedChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              width={54}
              tickFormatter={(v) => `$${v.toFixed(0)}M`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Import value bars — amber when flagged, purple otherwise */}
            <Bar dataKey="value" name="Import Value" radius={[2, 2, 0, 0]} maxBarSize={20}>
              {filtered.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.flagged ? FLAG_COLOR : INTEL_COLOR}
                  fillOpacity={entry.flagged ? 0.9 : 0.55}
                />
              ))}
            </Bar>

            {/* Air freight value as thin line overlay */}
            <Line
              type="monotone"
              dataKey="air_val"
              name="Air Freight"
              stroke={INTEL_COLOR}
              strokeWidth={1}
              strokeDasharray="3 2"
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
