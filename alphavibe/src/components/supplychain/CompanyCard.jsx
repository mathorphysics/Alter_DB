import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ExternalLink, BarChart2, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchQuote, fetchFundamentalMetrics } from '../../api/openbb';

function fmt(n, type) {
  if (n == null) return '—';
  if (type === 'price') return `$${Number(n).toFixed(2)}`;
  if (type === 'mcap') {
    const v = Number(n);
    if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
    return `$${v.toLocaleString()}`;
  }
  if (type === 'ratio') return `${Number(n).toFixed(1)}x`;
  if (type === 'pct')   return `${(Number(n) * 100).toFixed(1)}%`;
  return String(n);
}

function Skeleton() {
  return (
    <div className="space-y-2 mt-1">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex justify-between">
          <div className="h-2 w-14 rounded bg-white/5 animate-pulse" />
          <div className="h-2 w-10 rounded bg-white/5 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function CompanyCard({ company, stageColor, altData, onOpenModal }) {
  const [open, setOpen] = useState(false);
  const [fundData, setFundData] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || fetched.current) return;
    fetched.current = true;
    setLoading(true);
    Promise.allSettled([
      fetchQuote(company.ticker),
      fetchFundamentalMetrics(company.ticker),
    ]).then(([q, m]) => {
      setFundData({
        quote:   q.status === 'fulfilled' ? q.value : null,
        metrics: m.status === 'fulfilled' ? m.value : null,
      });
      setLoading(false);
    });
  }, [open, company.ticker]);

  const changePercent =
    fundData?.quote?.prev_close && fundData?.quote?.last_price
      ? ((fundData.quote.last_price - fundData.quote.prev_close) / fundData.quote.prev_close) * 100
      : null;

  return (
    <div
      className="rounded-lg border transition-colors duration-200 overflow-hidden"
      style={{
        background: open ? `${stageColor}0a` : 'rgba(22,27,34,0.55)',
        borderColor: open ? `${stageColor}38` : 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Card header — always visible */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left group"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm flex-shrink-0">{company.flag}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[#e6edf3] leading-tight">
              {company.name}
            </span>
            <span
              className="text-[9px] px-1.5 py-px rounded font-mono font-bold flex-shrink-0"
              style={{ background: `${stageColor}20`, color: stageColor }}
            >
              {company.ticker}
            </span>
          </div>
          <p className="text-[10px] text-[#8b949e] truncate mt-0.5 leading-tight">
            {company.desc}
          </p>
        </div>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-[#484f58] group-hover:text-[#8b949e] transition-colors"
        >
          <ChevronDown size={12} />
        </motion.div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Role badge */}
              <span
                className="inline-block text-[9px] px-1.5 py-px rounded font-semibold"
                style={{
                  background: `${stageColor}15`,
                  color: stageColor,
                  border: `1px solid ${stageColor}30`,
                }}
              >
                {company.role}
              </span>

              {/* ── Fundamental Data ── */}
              <div
                className="rounded-md p-2.5"
                style={{
                  background: 'rgba(70,120,151,0.09)',
                  border: '1px solid rgba(70,120,151,0.2)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-[#467897] uppercase tracking-widest flex items-center gap-1">
                    <BarChart2 size={9} /> Fundamental
                  </span>
                  <button
                    onClick={() => navigate(`/fundamentals?ticker=${company.ticker}`)}
                    className="text-[9px] text-[#467897] hover:text-[#e6edf3] flex items-center gap-0.5 transition-colors"
                  >
                    View <ExternalLink size={8} />
                  </button>
                </div>

                {loading ? (
                  <Skeleton />
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {[
                      { label: 'Price',      value: fmt(fundData?.quote?.last_price,        'price') },
                      { label: 'Mkt Cap',    value: fmt(fundData?.metrics?.market_cap,       'mcap')  },
                      { label: 'P / E',      value: fmt(fundData?.metrics?.pe_ratio,         'ratio') },
                      { label: 'Net Margin', value: fmt(fundData?.metrics?.profit_margin,    'pct')   },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="text-[8px] text-[#484f58] mb-px">{label}</div>
                        <div className="text-[10px] font-mono font-semibold text-[#e6edf3]">{value}</div>
                      </div>
                    ))}

                    {changePercent != null && (
                      <div className="col-span-2 flex items-center gap-1 pt-0.5 border-t border-white/5 mt-0.5">
                        {changePercent >= 0
                          ? <TrendingUp  size={9} className="text-emerald-400" />
                          : <TrendingDown size={9} className="text-red-400" />}
                        <span className={`text-[9px] font-medium ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}% today
                        </span>
                      </div>
                    )}

                    {!fundData?.quote && !fundData?.metrics && (
                      <p className="col-span-2 text-[9px] text-[#484f58]">
                        Data unavailable for {company.ticker}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Alternative Data ── */}
              <div
                className="rounded-md p-2.5"
                style={{
                  background: 'rgba(231,205,121,0.06)',
                  border: '1px solid rgba(231,205,121,0.16)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-[#e7cd79] uppercase tracking-widest flex items-center gap-1">
                    <Zap size={9} /> Alt Data
                  </span>
                  <button
                    onClick={() => {
                      const firstLink = altData?.find((m) => m.link)?.link;
                      navigate(firstLink ?? '/alternatives');
                    }}
                    className="text-[9px] text-[#e7cd79] hover:text-[#e6edf3] flex items-center gap-0.5 transition-colors"
                  >
                    View <ExternalLink size={8} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {altData.map((m) => (
                    <div key={m.label} className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[#8b949e] leading-tight">{m.label}</span>
                      {m.link ? (
                        <button
                          onClick={() => navigate(m.link)}
                          className="text-[9px] font-mono font-semibold flex-shrink-0 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                        >
                          {m.value}
                        </button>
                      ) : m.modal ? (
                        <button
                          onClick={() => onOpenModal?.(m.modal)}
                          className="text-[9px] font-mono font-semibold flex-shrink-0 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                        >
                          {m.value}
                        </button>
                      ) : (
                        <span
                          className="text-[9px] font-mono font-semibold flex-shrink-0"
                          style={{
                            color:
                              m.delta === 'up'   ? '#34d399' :
                              m.delta === 'risk' ? '#f87171' :
                                                   '#e7cd79',
                          }}
                        >
                          {m.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
