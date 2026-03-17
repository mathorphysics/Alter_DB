import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useState } from 'react';

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 9999 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#1c2128] border border-[#21262d] rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="text-[#8b949e] mb-1">{label}</div>
      <div className="text-[#e7cd79] font-mono font-semibold text-sm">
        ${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export default function PriceChart({ data, symbol }) {
  const [rangeIdx, setRangeIdx] = useState(4);

  const filteredData = (() => {
    const days = RANGES[rangeIdx].days;
    if (days >= 9999) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter((d) => new Date(d.date) >= cutoff);
  })();

  const prices = filteredData.map((d) => d.close).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const firstPrice = filteredData[0]?.close;
  const lastPrice = filteredData[filteredData.length - 1]?.close;
  const isUp = lastPrice >= firstPrice;

  const strokeColor = isUp ? '#467897' : '#f87171';
  const fillId = isUp ? 'priceGradientUp' : 'priceGradientDown';
  const fillColorStart = isUp ? 'rgba(70,120,151,0.25)' : 'rgba(248,113,113,0.2)';

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#e6edf3]">
            {symbol} <span className="text-[#8b949e] font-normal">Price History</span>
          </h3>
          <p className="text-xs text-[#8b949e] mt-0.5">{filteredData.length} trading sessions</p>
        </div>

        <div className="flex items-center gap-1 bg-[#0d1117] rounded-md p-0.5 border border-[#21262d]">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`px-2.5 py-1 text-xs rounded transition-all ${
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

      {filteredData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-[#8b949e]">
          No data available for this range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={filteredData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGradientUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#467897" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#467897" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="priceGradientDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#484f58' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => {
                const d = new Date(val);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={[minPrice * 0.97, maxPrice * 1.03]}
              tick={{ fontSize: 10, fill: '#484f58' }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(val) =>
                `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              }
            />

            <Tooltip content={<CustomTooltip />} />

            {firstPrice && (
              <ReferenceLine
                y={firstPrice}
                stroke="#8b949e"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#${fillId})`}
              dot={false}
              activeDot={{ r: 4, fill: strokeColor, stroke: '#0d1117', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
