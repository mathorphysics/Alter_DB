import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { fetchIntelChipsFunding } from '../api/altdata';

const INTEL_COLOR = '#a78bfa';
const SIGNED_COLOR = '#34d399';
const DOD_COLOR = '#467897';

export default function IntelChipsChart({ compact = false }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchIntelChipsFunding()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded flex items-center justify-center"
             style={{ background: INTEL_COLOR + '20', border: `1px solid ${INTEL_COLOR}40` }}>
          <DollarSign size={12} style={{ color: INTEL_COLOR }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--fg)]">
            Intel Federal Awards
          </h3>
          {!compact && (
            <p className="text-[11px] text-[var(--sub)]">
              USAspending.gov · Contracts &amp; Grants · USD
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

      {error && (
        <div className="text-xs text-[var(--sub)] py-8 text-center">{error}</div>
      )}

      {!data && !error && (
        <div className="text-xs text-[var(--muted)] py-8 text-center">Loading…</div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded p-3"
                 style={{ background: SIGNED_COLOR + '08', border: `1px solid ${SIGNED_COLOR}20` }}>
              <div className="text-[10px] text-[var(--sub)] mb-0.5">CHIPS Act Grant (Signed)</div>
              <div className="text-base font-mono font-bold" style={{ color: SIGNED_COLOR }}>
                {data.chips_grant_signed_b != null ? `$${data.chips_grant_signed_b.toFixed(2)}B` : '—'}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">{data.chips_grant_date}</div>
            </div>
            <div className="rounded p-3"
                 style={{ background: INTEL_COLOR + '08', border: `1px solid ${INTEL_COLOR}20` }}>
              <div className="text-[10px] text-[var(--sub)] mb-0.5">USAspending Obligated</div>
              <div className="text-base font-mono font-bold" style={{ color: INTEL_COLOR }}>
                ${(data.usaspending_total_b * 1000).toFixed(1)}M
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">
                {data.usaspending_count} awards · DoD R&amp;D
              </div>
            </div>
          </div>

          {/* Live Awards list */}
          <div className="space-y-1.5">
            {data.live_awards.length === 0 ? (
              <div className="text-xs text-[var(--muted)] py-4 text-center">
                No awards found since {data.chips_act_date}.
              </div>
            ) : (
              data.live_awards.map((a, i) => (
                <div key={i}
                     className="flex items-start gap-3 px-2.5 py-2 rounded"
                     style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-[var(--muted)] font-mono">{a.action_date}</span>
                      <span className="text-[10px] px-1 rounded font-medium"
                            style={{ background: (a.award_type === 'contract' ? DOD_COLOR : INTEL_COLOR) + '15',
                                     color: a.award_type === 'contract' ? DOD_COLOR : INTEL_COLOR }}>
                        {a.award_type}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-[var(--fg)]">
                        ${(a.amount_usd / 1e6).toFixed(1)}M
                      </span>
                      {a.outlays_usd > 0 && (
                        <span className="text-[10px] text-[var(--sub)]">
                          outlays ${(a.outlays_usd / 1e6).toFixed(1)}M
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--sub)] mt-0.5">{a.recipient}</div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">{a.description}</div>
                    <div className="text-[10px] text-[var(--muted)]">{a.sub_agency}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
