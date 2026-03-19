import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { fetchFredMacro } from '../api/altdata';

const ACCENT = '#467897';

const SERIES_CONFIG = [
  {
    key:   'capacity_utilization',
    color: '#e7cd79',
    yFmt:  (v) => `${v.toFixed(1)}%`,
  },
  {
    key:   'industrial_production',
    color: '#34d399',
    yFmt:  (v) => v.toFixed(1),
  },
  {
    key:   'durable_goods_orders',
    color: '#a78bfa',
    yFmt:  (v) => `$${(v / 1000).toFixed(0)}B`,
  },
  {
    key:   'mfg_employment',
    color: '#fb923c',
    yFmt:  (v) => `${(v / 1000).toFixed(1)}M`,
  },
  {
    key:   'pce_durables',
    color: '#38bdf8',
    yFmt:  (v) => `$${v.toFixed(0)}B`,
  },
];

// Trim to last N months
function lastN(obs, n = 60) {
  return obs.slice(-n);
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

function MiniChart({ series, config }) {
  if (!series) return null;
  const obs   = lastN(series.observations ?? []);
  const vals  = obs.map((o) => o.value);
  const latest = vals[vals.length - 1];
  const prev   = vals[vals.length - 2];
  const chg    = prev ? latest - prev : null;
  const up     = chg != null && chg >= 0;

  return (
    <div
      className="rounded-lg p-3 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Mini header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-[var(--fg)] leading-tight">{series.label}</div>
          <div className="text-[9px] text-[var(--muted)] mt-0.5">{series.id} · {series.unit}</div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <div className="text-sm font-mono font-bold" style={{ color: config.color }}>
            {latest != null ? config.yFmt(latest) : '—'}
          </div>
          {chg != null && (
            <div className={`text-[9px] font-mono ${up ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
              {up ? '+' : ''}{config.yFmt(chg)} MoM
            </div>
          )}
        </div>
      </div>

      {series.error ? (
        <div className="text-[10px] text-[var(--muted)] py-6 text-center">{series.error}</div>
      ) : obs.length === 0 ? (
        <div className="text-[10px] text-[var(--muted)] py-6 text-center">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={obs} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 8, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              interval={Math.ceil(obs.length / 5) - 1}
              tickFormatter={fmtDate}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    className="rounded px-2 py-1 text-[10px] border"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="text-[var(--muted)] mb-0.5">{fmtDate(label)}</div>
                    <div className="font-mono font-semibold" style={{ color: config.color }}>
                      {config.yFmt(payload[0].value)}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: config.color, stroke: 'var(--bg)', strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function FredMacroPanel({ compact = false }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFredMacro()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT + '20', border: `1px solid ${ACCENT}40` }}
        >
          <TrendingUp size={12} style={{ color: ACCENT }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--fg)]">FRED Macro Indicators</h3>
          {!compact && (
            <p className="text-[11px] text-[var(--sub)]">
              Federal Reserve Economic Data · US semiconductor &amp; manufacturing signals
            </p>
          )}
        </div>
        <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium">
          LIVE
        </span>
        <span
          className="px-1.5 py-0.5 text-[9px] rounded font-medium"
          style={{ background: ACCENT + '10', border: `1px solid ${ACCENT}30`, color: ACCENT }}
        >
          Macro
        </span>
        {data?.as_of && (
          <span className="text-[9px] text-[var(--muted)]">as of {data.as_of}</span>
        )}
      </div>

      {error && (
        <div className="text-xs text-[var(--muted)] py-8 text-center">{error}</div>
      )}
      {!data && !error && (
        <div className="text-xs text-[var(--muted)] py-8 text-center">Loading…</div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SERIES_CONFIG.map((cfg) => (
            <MiniChart
              key={cfg.key}
              series={data[cfg.key]}
              config={cfg}
            />
          ))}
        </div>
      )}
    </div>
  );
}
