import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchEquipmentImports } from '../../api/altdata';

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{
        background: 'rgba(22,27,34,0.92)',
        border: '1px solid rgba(52,211,153,0.25)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-[#8b949e] mb-0.5">{label}</p>
      <p className="font-semibold font-mono text-emerald-400">
        ${value != null ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}M
      </p>
    </div>
  );
}

// ── Tick formatters ────────────────────────────────────────────────────────────
function tickY(v) {
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}B`;
  return `$${v}M`;
}

// Show every 6th label to avoid crowding
function makeTickX(data) {
  return (value, index) => {
    if (index % 6 !== 0) return '';
    return value;
  };
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function Stats({ data }) {
  if (!data?.length) return null;
  const values = data.map((d) => d.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  const mom = prev ? ((latest - prev) / prev) * 100 : null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        { label: 'Latest',  value: `$${latest?.toFixed(0)}M` },
        { label: 'Avg / Mo',value: `$${avg.toFixed(0)}M` },
        { label: '5Y Peak', value: `$${max.toFixed(0)}M` },
      ].map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg px-3 py-2.5 text-center"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)' }}
        >
          <p className="text-[9px] uppercase tracking-widest text-[#8b949e] mb-1">{label}</p>
          <p className="text-sm font-bold font-mono text-emerald-400">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function AlternativeDataModal({ open, onClose }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch once when first opened
  useEffect(() => {
    if (!open || data || loading) return;
    setLoading(true);
    setError(null);
    fetchEquipmentImports(60)
      .then((res) => {
        setData(res.results ?? res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  // Compute average for reference line
  const avg = data?.length
    ? data.reduce((a, b) => a + b.value, 0) / data.length
    : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(1,4,9,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-2xl rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(22,27,34,0.97) 0%, rgba(13,17,23,0.98) 100%)',
                border: '1px solid rgba(52,211,153,0.18)',
                boxShadow: '0 0 60px rgba(52,211,153,0.08), 0 24px 64px rgba(0,0,0,0.6)',
              }}
            >
              {/* Accent bar */}
              <div
                className="h-px w-full"
                style={{
                  background: 'linear-gradient(90deg, rgba(52,211,153,0) 0%, rgba(52,211,153,0.6) 40%, rgba(52,211,153,0) 100%)',
                }}
              />

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-4 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={14} className="text-emerald-400" />
                    <h3 className="text-sm font-bold text-[#e6edf3]">
                      Taiwan Semiconductor Equipment Imports
                    </h3>
                  </div>
                  <p className="text-[10px] text-[#484f58] leading-relaxed">
                    HS Code 8486 · Monthly · USD Millions ·{' '}
                    <span className="text-[#8b949e]">
                      Source: Taiwan Customs Administration (關務署)
                    </span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 text-[#484f58] hover:text-[#e6edf3] transition-colors ml-4 mt-0.5 rounded-md p-1 hover:bg-white/5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pb-5">
                {loading && (
                  <div className="flex items-center justify-center py-16 gap-2 text-[#8b949e] text-xs">
                    <Loader2 size={14} className="animate-spin text-emerald-400" />
                    Loading import data…
                  </div>
                )}

                {error && (
                  <div
                    className="flex items-start gap-2 rounded-lg px-3 py-3 text-xs"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
                  >
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium mb-0.5">Failed to load data</p>
                      <p className="text-[#8b949e]">{error}</p>
                      <p className="text-[#484f58] mt-1 text-[10px]">
                        Ensure the FastAPI server is running on port 3001 and a CSV has been uploaded.
                      </p>
                    </div>
                  </div>
                )}

                {data && !loading && (
                  <>
                    <Stats data={data} />

                    {/* Chart */}
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={data}
                          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="equipFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.28} />
                              <stop offset="95%" stopColor="#34d399" stopOpacity={0.01} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.04)"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#484f58', fontSize: 9 }}
                            tickFormatter={makeTickX(data)}
                          />

                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#484f58', fontSize: 9 }}
                            tickFormatter={tickY}
                            width={42}
                          />

                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(52,211,153,0.2)', strokeWidth: 1 }} />

                          {avg != null && (
                            <ReferenceLine
                              y={avg}
                              stroke="rgba(52,211,153,0.25)"
                              strokeDasharray="4 4"
                              label={{
                                value: 'Avg',
                                position: 'insideTopRight',
                                fill: '#484f58',
                                fontSize: 8,
                              }}
                            />
                          )}

                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#34d399"
                            strokeWidth={1.5}
                            fill="url(#equipFill)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Footer metadata */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#21262d]">
                      <span className="text-[9px] text-[#484f58]">
                        {data.length} monthly observations ·{' '}
                        {data[0]?.label} – {data[data.length - 1]?.label}
                      </span>
                      <span className="text-[9px] text-[#484f58]">
                        Values in USD millions
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
